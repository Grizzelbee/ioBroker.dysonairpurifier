// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load modules here, e.g.:
const axios  = require('axios');
const crypto = require('crypto');
const mqtt   = require('mqtt');
const adapterName = require('./package.json').name.split('.').pop();

// Variable definitions
const apiUri = 'https://appapi.cp.dyson.com';
const supportedProductTypes = ['358', '438', '455', '469', '475', '520', '527'];


/*
 * Main class of dyson AirPurifier adapter for ioBroker
 */
class dysonAirPurifier extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({...options, name: adapterName});

        this.on('ready', this.onReady.bind(this));
        //this.on('objectChange', this.onObjectChange.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /*
    *  Main
    * It's the main routine of the adapter
    */
    async main() {
        try {
            let myAccount;
            await this.dysonAPILogIn(this.config)
                .then( (response) => {
                    this.log.info('Successful dyson API Login.');
                    // Creates the authorization header for further use
                    myAccount = 'Basic ' + Buffer.from(response.data.Account + ':' + response.data.Password).toString('base64');
                    this.log.debug('[dysonAPILogIn]: Statuscode from Axios: [' + response.status + ']');
                    this.log.debug('[dysonAPILogIn]: Statustext from Axios [' + response.statusText+ ']');
                })
                .catch( (error) => {
                    this.log.error('Error during dyson API login:' + error + ', Callstack: ' + error.stack);
                })
            this.log.debug('Querying devices from dyson API.');
            await this.dysonGetDevicesFromApi(myAccount)
            .then( (response) => {
                for (let device in response.data){
                    this.log.debug('JSON-Data: ' + JSON.stringify(response.data[device]));
                    // 1. create datapoints if device is supported
                    if (!supportedProductTypes.some(function(t) { return t === response.data[device].ProductType; })) {
                        this.log.info('Device with serial number [' + response.data[device].Serial + '] not added, hence it is not supported by this adapter. Product type: [' + response.data[device].ProductType + ']');
                        continue;
                    } else {
                        // 2. Search Network for IP-Address of current device
                        // 2a. Store IP-Address in additional persistant datafield
                        // createOrUpdateDevice()
                        // 3. query local data from each device
/*
                        // Gets the corresponding device configuration
                        let config = platform.config.devices.find(function(d) { return d.serialNumber === apiConfig.Serial; });
                        if (!config) {
                            platform.log.warn('No IP address provided for device with serial number ' + apiConfig.Serial + '.');
                            continue;
                        }
*/
                        // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
                        const key = Uint8Array.from(Array(32), (_, index) => index + 1);
                        const initializationVector = new Uint8Array(16);
                        const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
                        const decryptedPasswordString = decipher.update(response.data[device].LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
                        const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
                        const password = decryptedPasswordJson.apPasswordHash;

                        // this.log.debug('decryptedPasswordJson : [' + JSON.stringify(decryptedPasswordJson) + ']');
                        this.log.debug('Password: [' + password + ']');

                        // Initializes the MQTT client for local communication with the device
                        let mqttClient = mqtt.connect('mqtt://192.168.175.88' , {
                            username: response.data[device].Serial,
                            password: password,
                            protocolVersion: 3,
                            protocolId: 'MQIsdp'
                        });
                        this.log.debug(response.data[device].Serial + ' - MQTT connection requested for 192.168.175.88'+'.');
                        let updateIntervalHandle = null;
                        let adapter = this;
                        // Subscribes for events of the MQTT client
                        mqttClient.on('connect', function () {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT connection established.');

                            // Subscribes to the status topic to receive updates
                            mqttClient.subscribe(response.data[device].ProductType + '/' + response.data[device].Serial + '/status/current', function () {

                                // Sends an initial request for the current state
                                mqttClient.publish(response.data[device].ProductType + '/' + response.data[device].Serial + '/command', JSON.stringify({
                                    msg: 'REQUEST-CURRENT-STATE',
                                    time: new Date().toISOString()
                                }));
                            })
                        });

                        mqttClient.on('message', function (_, payload) {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT message received: ' + payload.toString());
                        });
                        mqttClient.on('error', function (error) {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT error: ' + error);
                        });
                        mqttClient.on('reconnect', function () {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT reconnecting.');
                        });
                        mqttClient.on('close', function () {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT disconnected.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });
                        mqttClient.on('offline', function () {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT offline.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });
                        mqttClient.on('end', function () {
                            adapter.log.debug(response.data[device].Serial + ' - MQTT ended.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });


                        /*
                        // Creates the device instance and adds it to the list of all devices
                        if (platform.config.supportedProductTypes.some(function(t) { return t === apiConfig.ProductType; })) {
                            apiConfig.password = password;

                            // Prints out the credentials hint
                            platform.log.info('Credentials for device with serial number ' + apiConfig.Serial + ' are: ' + Buffer.from(JSON.stringify(apiConfig)).toString('base64'));

                            // Creates the device
                            platform.devices.push(new DysonPureCoolDevice(platform, apiConfig.Name, apiConfig.Serial, apiConfig.ProductType, apiConfig.Version, password, config));
                        }
                        */





                    }
                }
            })
            .catch( (error) => {
                    this.log.error('[dysonGetDevicesFromApi] Error: ('+error.statuscode+')' + error + ', Callstack: ' + error.stack);
                })


        } catch (error) {
            this.log.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    /*
    * configIsValid
    * {promise} Tests whether the given adapters config is valid
    *           resolves if the config is valid
    *           rejects if the config is invalid
    *
    * @param config {object} config-object to test
    *
    * */
    async configIsValid(config){
        this.log.debug('Entering Function [configIsValid]');
        // Log the current config given to the function
        this.log.debug(`eMail: ${config.email}`);
        this.log.debug(`enc. Password: ${config.Password}`);
        this.log.debug(`Locale: ${config.country}`);
        // TODO Do more precise tests. This is very rough
        const promise = new Promise(
            function(resolve, reject) {
                if (   (!config.email    || config.email === '')
                    || (!config.Password || config.Password === '')
                    || (!config.country  || config.country === '') ) {
                    reject('Given adapter config is invalid. Please fix.');
                } else
                    resolve('Given config seems to be valid. Please continue ...');
                })
    }

    /*
    * onReady
    * Is called when databases are connected and adapter received configuration.
    */
    async onReady() {
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            await this.configIsValid(this.config)
            .then((result) => {
                this.log.debug(result);
                // configisValid! Noe decrypt password
                this.getForeignObject('system.config', (err, obj) => {
                    if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                        this.log.debug('System secrect resolved. Using for decryption.');
                        this.config.Password = this.decrypt(obj.native.secret, this.config.Password);
                    } else {
                        //noinspection JSUnresolvedVariable
                        this.log.debug('System secrect rejected. Using SALT for decryption.');
                        this.config.Password = this.decrypt('Zgfr56gFe87jJOM', this.config.Password);
                    }

                    // config is valid and password is decrypted -> run main() function
                    this.main();
                })
            })
            .catch((error) => {
                this.log.error('Error during Password decryption: ' + error);
                this.setState('info.connection', false);
                this.terminate('Terminate Adapter until Configuration is completed', 11);
            })
        } catch (error) {
            this.log.error(`[onReady] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    /***********************************************
     * Misc helper functions                       *
    ***********************************************/
    //  Create or extend object
    createOrExtendObject(id, objData, value, callback) {
        const self = this;
        this.getObject(id, function (err, oldObj) {
            if (!err && oldObj) {
                self.extendObject(id, objData, callback);
            } else {
                self.setObjectNotExists(id, objData, callback);
            }
            self.setState(id, value, true);
        });
    }

    // Decrypt passwords
    decrypt(key, value) {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
    }

    /***********************************************
    * dyson API functions                         *
    ***********************************************/
    /*
     * dysonAPILogin
     *
     * @param config {object} Object which contains all the adapter config
     *
     * @returns promise {Promise} Promise that fulfills when dyson login worked and rejects on any http error.
     */
    async dysonAPILogIn(config){
        // Sends the login request to the API
        this.log.debug('Signing in into dyson API.');
        return axios.post( apiUri + "/v1/userregistration/authenticate?country=" + config.country,
             { Email: config.email,
                    Password: config.Password },
            {rejectUnauthorized:false});
    }

    async dysonGetDevicesFromApi(auth) {

        // Sends a request to the API to get all devices of the user
        return axios.get(apiUri + '/v2/provisioningservice/manifest',
            {
              headers: { 'Authorization': auth },
              json: true,
              rejectUnauthorized: false
            });
    }



            // Exit adapter
    onUnload(callback) {
        try {
            this.log.info('Cleaned up everything...');
            callback();
        } catch (e) {
            callback();
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new dysonAirPurifier(options);
} else {
    // otherwise start the instance directly
    new dysonAirPurifier();
}
/*

DysonPureCoolPlatform.prototype.getDevicesFromApi = function (callback) {
    const platform = this;

    // Checks if the user is signed in
    if (!platform.authorizationHeader) {
        return platform.signIn(function (result) {
            if (result) {
                return platform.getDevicesFromApi(callback);
            } else {
                return callback(false);
            }
        });
    }

    // Sends a request to the API to get all devices of the user
    request({
        uri: platform.config.apiUri + '/v2/provisioningservice/manifest',
        method: 'GET',
        headers: {
            'Authorization': platform.authorizationHeader
        },
        json: true,
        rejectUnauthorized: false
    }, function (error, response, body) {

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body) {
            if (error) {
                platform.log.warn('Error while retrieving the devices from the API. Error: ' + error);
            } else if (response.statusCode != 200) {
                platform.log.warn('Error while retrieving the devices from the API. Status Code: ' + response.statusCode);
            } else if (!body) {
                platform.log.warn('Error while retrieving the devices from the API. Could not get devices from response: ' + JSON.stringify(body));
            }
            return callback(false);
        }

        // Initializes a device for each device from the API
        for (let i = 0; i < body.length; i++) {
            const apiConfig = body[i];

            // Checks if the device is supported by this plugin
            if (!platform.config.supportedProductTypes.some(function(t) { return t === apiConfig.ProductType; })) {
                platform.log.info('Device with serial number ' + apiConfig.Serial + ' not added, as it is not supported by this plugin. Product type: ' + apiConfig.ProductType);
                continue;
            }

            // Gets the corresponding device configuration
            let config = platform.config.devices.find(function(d) { return d.serialNumber === apiConfig.Serial; });
            if (!config) {
                platform.log.warn('No IP address provided for device with serial number ' + apiConfig.Serial + '.');
                continue;
            }

            // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
            const key = Uint8Array.from(Array(32), (_, index) => index + 1);
            const initializationVector = new Uint8Array(16);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
            const decryptedPasswordString = decipher.update(apiConfig.LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
            const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
            const password = decryptedPasswordJson.apPasswordHash;

            // Creates the device instance and adds it to the list of all devices
            if (platform.config.supportedProductTypes.some(function(t) { return t === apiConfig.ProductType; })) {
                apiConfig.password = password;

                // Prints out the credentials hint
                platform.log.info('Credentials for device with serial number ' + apiConfig.Serial + ' are: ' + Buffer.from(JSON.stringify(apiConfig)).toString('base64'));

                // Creates the device
                platform.devices.push(new DysonPureCoolDevice(platform, apiConfig.Name, apiConfig.Serial, apiConfig.ProductType, apiConfig.Version, password, config));
            }
        }

        // Removes the accessories that are not bound to a device
        let unusedAccessories = platform.accessories.filter(function(a) { return !platform.devices.some(function(d) { return d.serialNumber === a.context.serialNumber; }); });
        for (let i = 0; i < unusedAccessories.length; i++) {
            const unusedAccessory = unusedAccessories[i];
            platform.log.info('Removing accessory with serial number ' + unusedAccessory.context.serialNumber + ' and kind ' + unusedAccessory.context.kind + '.');
            platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
        }
        platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);

        // Returns a positive result
        platform.log.info('Got devices from the Dyson API.');
        return callback(true);
    });
}

/**
 * Gets the devices of the user from the config.json.
 */
/*
DysonPureCoolPlatform.prototype.getDevicesFromConfig = function () {
    const platform = this;

    // Checks if there are credentials for all devices
    if (platform.config.devices.some(function(d) { return !d.credentials; })) {
        platform.log.info('Device credentials not stored, asking Dyson API. If you want to prevent communication with the Dyson API, copy the credentials for each device from the coming log entries to the config.json.');
        return false;
    }

    // Cycles over all devices from the config and tests whether the credentials can be parsed
    for (let i = 0; i < platform.config.devices.length; i++) {
        const config = platform.config.devices[i];

        // Decodes the API configuration that has been stored
        try {
            JSON.parse(Buffer.from(config.credentials.trim(), 'base64').toString('ascii'));
        } catch (e) {
            platform.log.warn('Invalid device credentials for device with serial number ' + config.serialNumber + '. Make sure you copied it correctly.');
            return false;
        }
    }

    // Cycles over all devices from the config and creates them
    for (let i = 0; i < platform.config.devices.length; i++) {
        const config = platform.config.devices[i];

        // Decodes the API configuration that has been stored
        let apiConfig = JSON.parse(Buffer.from(config.credentials.trim(), 'base64').toString('ascii'));

        // Creates the device instance and adds it to the list of all devices
        platform.devices.push(new DysonPureCoolDevice(platform, apiConfig.Name, apiConfig.Serial, apiConfig.ProductType, apiConfig.Version, apiConfig.password, config));
    }

    // Removes the accessories that are not bound to a device
    let unusedAccessories = platform.accessories.filter(function(a) { return !platform.devices.some(function(d) { return d.serialNumber === a.context.serialNumber; }); });
    for (let i = 0; i < unusedAccessories.length; i++) {
        const unusedAccessory = unusedAccessories[i];
        platform.log.info('Removing accessory with serial number ' + unusedAccessory.context.serialNumber + ' and kind ' + unusedAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);

    // Returns a positive result
    platform.log.info('Got devices from config.');
    return true;
}

 */
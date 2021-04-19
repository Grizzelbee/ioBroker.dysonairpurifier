'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const axios  = require('axios');
const path = require('path');
const https = require('https');
const rootCas = require('ssl-root-cas').create();
const {stringify} = require('flatted');
const httpsAgent = new https.Agent({ca: rootCas});
const apiUri = 'https://appapi.cp.dyson.com';
const dysonConstants = require('./dysonConstants.js');
rootCas.addFile(path.resolve(__dirname, 'certificates/intermediate.pem'));

// class DysonUtils {
//     DysonUtils() {}
// }

/**
 * Function zeroFill
 *
 * Formats a number as a string with leading zeros
 *
 * @param number {string} Value thats needs to be filled up with leading zeros
 * @param width  {number} width of the complete new string incl. number and zeros
 *
 * @returns The given number filled up with leading zeros to a given width (excluding the negative sign), returns empty string if number is not an actual number.
 */
module.exports.zeroFill = function (number, width) {
    const num = parseInt(number);

    if (isNaN(num)) {
        return '';
    }

    const negativeSign = num < 0 ? '-' : '';
    const str = '' + Math.abs(num);

    return `${negativeSign}${_.padStart(str, width, '0')}`;
};

/**
 * checkAdapterConfig
 *
 * {promise} Tests whether the given adapters config is valid
 *           resolves if the config is valid
 *           rejects if the config is invalid
 *
 * @param adapter {object} ioBroker adapter which contains the configuration that should be checked
 */
module.exports.checkAdapterConfig = async function (adapter) {
    const config = adapter.config;
    // Prepare masked Config for debugging
    const logConfig = JSON.stringify(this.maskConfig(config));

    return new Promise(
        function (resolve, reject) {
            if ((!config.email || config.email === '')
                || (!config.Password || config.Password === '')
                || (!config.country || config.country === '')) {
                adapter.log.error(`Invalid configuration provided: ${logConfig}`);
                if (!config.email || config.email === '') {
                    adapter.log.error(`Invalid configuration provided: eMail address is missing. Please enter your eMail address.`);
                }
                if (!config.Password || config.Password === '') {
                    adapter.log.error(`Invalid configuration provided: password is missing. Please enter your password.`);
                }
                if (!config.country || config.country === '') {
                    adapter.log.error(`Invalid configuration provided: Country is missing. Please select your country.`);
                }
                if (!config.temperatureUnit || config.temperatureUnit === '') {
                    adapter.log.error(`Invalid configuration provided: Temperature unit is missing. Please select a temperature unit.`);
                }
                if (!config.pollInterval || config.pollInterval === '' || config.pollInterval < 1) {
                    adapter.log.error(`Invalid configuration provided: Poll interval is not valid. Please enter a valid poll interval (> 0s).`);
                }
                reject('Given adapter config is invalid. Please fix.');
            } else {
                resolve(true);
            }
        });
};

/**
 * Function decryptMqttPasswd
 * decrypts the fans local mqtt password and returns a value you can connect with
 *
 * @param LocalCredentials  {string} encrypted mqtt password
 *
 * @returns {string} The decrypted MQTT password
 */
module.exports.decryptMqttPasswd = function(LocalCredentials) {
    // Gets the MQTT credentials from the thisDevice (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
    const key = Uint8Array.from(Array(32), (_, index) => index + 1);
    const initializationVector = new Uint8Array(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
    const decryptedPasswordString = decipher.update(LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
    const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
    return decryptedPasswordJson.apPasswordHash;
};

/**
 * Function getDevices
 * Queries the devices stored in a given dyson online account
 *
 * @param myAccount  {Object} JSON Object containing your dyson account details
 * @param adapter {Object} link to the adapter
 * @returns {ANY}
 *      resolves with a List of dyson devices connected to the given account
 *      rejects with an error message
 */
module.exports.getDevices = async function(myAccount, adapter) {
    return new Promise((resolve, reject) => {
        this.dysonGetDevicesFromApi(myAccount)
            .then((response) => {
                const devices = [];
                for (const thisDevice in response.data) {
                    adapter.log.debug('Data received from dyson API: ' + JSON.stringify(response.data[thisDevice]));
                    // TODO Try to switch from SUPPORTED_PRODUCT_TYPES-array to PRODUCTS-object
                    if (!dysonConstants.SUPPORTED_PRODUCT_TYPES.some(function (t) {
                        return t === response.data[thisDevice].ProductType;
                    })) {
                        adapter.log.warn('Device with serial number [' + response.data[thisDevice].Serial + '] not added, hence it is not supported by this adapter. Product type: [' + response.data[thisDevice].ProductType + ']');
                        adapter.log.warn('Please open an Issue on github if you think your device should be supported.');
                    } else {
                        // productType is supported: Push to Array and create in devicetree
                        response.data[thisDevice].hostAddress = undefined;
                        response.data[thisDevice].mqttClient = null;
                        response.data[thisDevice].mqttPassword = this.decryptMqttPasswd(response.data[thisDevice].LocalCredentials);
                        response.data[thisDevice].updateIntervalHandle = null;
                        devices.push(response.data[thisDevice]);
                    }
                }
                resolve(devices);
            })
            .catch((error) => {
                // adapterLog.error('[dysonGetDevicesFromApi] Error: (' + error.statuscode + ') ' + error + ', Callstack: ' + error.stack);
                reject('[dysonGetDevicesFromApi] Error: (' + error.statuscode + ') ' + error + ', Callstack: ' + error.stack);
            });
    });
};

/**
 * dysonAPILogin
 *
 * @param adapter {object} Object which contains a reference to the adapter
 *
 * @returns {Promise} 
 *      resolves when dyson login worked
 *      rejects on any http error.
 */
module.exports.dysonAPILogIn = async function(adapter) {
    adapter.log.info('Signing in into dyson cloud API ...');
    const headers = {
        'User-Agent': 'DysonLink/29019 CFNetwork/1188 Darwin/20.0.0',
        'Content-Type': 'application/json'
    };
    const payload = {
        'Email': adapter.config.email,
        'Password': adapter.config.Password
    };

    const response = await axios.get(apiUri + `/v1/userregistration/userstatus?country=${adapter.config.country}&email=${adapter.config.email}`,
        { httpsAgent,
            headers: headers,
            json: true
        });
    if (response.data.accountStatus === 'ACTIVE') {
        adapter.log.info(`Result from API-Status request -> Account is: ${response.data.accountStatus}`);
    } else {
        adapter.log.warn(`Result from API-Status request -> Account is: ${response.data.accountStatus}`);
    }
    // Sends the login request to the API
    return await axios.post(apiUri + '/v1/userregistration/authenticate?country=' + adapter.config.country,
        payload,
        { httpsAgent,
            headers: headers,
            json   : true
        });
};

/**
 * dysonGetDevicesFromApi
 *
 * @param auth {object} Object which contains required authentication data
 *
 * @returns {Promise}
 *      resolves with dysons device data
 *      rejects on any http error.
 */module.exports.dysonGetDevicesFromApi = async function(auth) {
    // Sends a request to the API to get all devices of the user
    return await axios.get(apiUri + '/v2/provisioningservice/manifest',
        {
            httpsAgent,
            headers: { 'Authorization': auth },
            json: true
        }
    );
};

/**
 * Function getMqttCredentials
 *
 *
 * @param adapter {Object} link to the adapters
 * @returns Promise  {string} resolves with the MQTT Basic-Auth of the device, rejects with the error which occurred.
 */
module.exports.getMqttCredentials = function(adapter) {
    return new Promise((resolve, reject) => {
        this.dysonAPILogIn(adapter)
            .then((response) => {
                adapter.log.debug('Successful logged in into the Dyson API.');
                adapter.log.debug('[dysonAPILogIn]: Statuscode from Axios: [' + response.status + ']');
                adapter.log.debug('[dysonAPILogIn]: Statustext from Axios [' + response.statusText + ']');
                // Creates the authorization header for further use
                resolve( 'Basic ' + Buffer.from(response.data.Account + ':' + response.data.Password).toString('base64'));
            })
            .catch((error) => {
                adapter.log.error('Error during dyson cloud API login:' + error + ', Callstack: ' + error.stack);
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    switch (error.response.status) {
                        case 401 : // unauthorized
                            adapter.log.error('Error: Unable to authenticate user! Your credentials seem to be invalid. Please double check and fix them.');
                            adapter.log.error(`Credentials used for login: User:[${adapter.config.email}] - Password:[${adapter.config.Password}] - Country:[${adapter.config.country}]`);
                            break;
                        case 429: // endpoint currently not available
                            adapter.log.error('Error: Endpoint: ' + apiUri + '/v1/userregistration/authenticate?country=' + adapter.config.country);
                            break;
                        default:
                            adapter.log.error('[error.response.data]: ' + ((typeof error.response.data === 'object') ? stringify(error.response.data) : error.response.data));
                            adapter.log.error('[error.response.status]: ' + ((typeof error.response.status === 'object') ? stringify(error.response.status) : error.response.status));
                            adapter.log.error('[error.response.headers]: ' + ((typeof error.response.headers === 'object') ? stringify(error.response.headers) : error.response.headers));
                            break;
                    }
                } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    adapter.log.error('[error.request]: ' + ((typeof error.request === 'object') ? stringify(error.request) : error.request));
                } else {
                    // Something happened in setting up the request that triggered an Error
                    adapter.log.error('[Error]: ' + error.message);
                }
                reject('Error during dyson cloud API login:' + error );
            });
    });
};

/**
 * Returns a masked and cloned copy of provided config
 * @param unmaskedConfig The unmasked config
 */
module.exports.maskConfig = function (unmaskedConfig) {
    // Masking sensitive fields (password) for logging configuration (creating a deep copy of the config)
    const maskedConfig = JSON.parse(JSON.stringify(unmaskedConfig));
    maskedConfig.Password = '(***)';
    return maskedConfig;
};

/**
 * Parse an incoming JSON message payload from the Dyson device
 * 
 * @param msg Incoming JSON message
 */
module.exports.parseDysonMessage = function (msg) {
    if (null == msg || '' === msg) return;

    // TODO incomplete

    // const data = JSON.parse(msg);
    // console.log(data);
    return;
};

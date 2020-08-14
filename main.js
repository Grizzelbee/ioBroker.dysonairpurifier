// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

/*
 * Created with @iobroker/create-adapter v1.20.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load modules here, e.g.:
// const dyson = require('dyson-purelink');
const DysonCloud = require('dyson-cloud');
// Variable definitions

const adapterName = require('./package.json').name.split('.').pop();

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

    async main() {
        try {

            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            let Password = this.config.Password;
            // Check if credentials are not empty and decrypt stored password
            if (Password && Password !== '')  {
                await this.getForeignObjectAsync('system.config').then(obj => {
                    if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                        Password = this.decrypt(obj.native.secret, Password);
                    } else {
                        //noinspection JSUnresolvedVariable
                        Password = this.decrypt('Zgfr56gFe87jJOM', Password);
                    }
                }).catch(err => {
                    this.log.error(JSON.stringify(err));
                });
            } else {
                this.log.error('[Credentials] error: Password missing or empty in Adapter Settings');
            }

            let myAccount = DysonCloud.build(this.config.email, 'Bullshit!');

            this.log.debug(`dyson cloud eMail: ${this.config.email}`);
            this.log.debug(`dyson cloud password: ${Password}`);
            this.log.debug(`country: ${this.config.country}`);
            this.log.debug(`Poll Interval: ${this.config.pollInterval}`);
            if (!myAccount || myAccount === 'undefined'){
                this.log.info('myAccount is not valid.')
            } else {
                this.log.info(myAccount._authToken)
            }
            await myAccount.getDevices().then(devices => {
                this.log.info('getDevices has been called.')
                if(!Array.isArray(devices) || devices.length === 0) {
                    this.log.info('No devices found')
                } else {
                    this.log.info('Found device: ' + devices.toString())
                }
            }).catch(err => console.error(err))

            /*
            // Connection state handler
            ctx.connection.on('connectionState', (connectionState) => {
                this.log.debug('Connection state changed to ' + connectionState);
                if (connectionState === 'CONNECTED') {
                    this.log.info('Connection established');
                    this.setStateAsync('info.connection', true, true);
                } else {
                    this.setStateAsync('info.connection', false, true);
                }
            });
            */

            // Establish connection
            this.log.info('Wait for Connection...');
            // await ctx.connection.connect();
        } catch (error) {
            this.log.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    // Is called when databases are connected and adapter received configuration.
    async onReady() {
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            if (this.config !== 'undefined') {
                this.log.info('Awaiting main:');
                await this.main();
            } else {
                this.setState('info.connection', false);
                this.terminate('Terminate Adapter until Configuration is completed', 11);
            }
        } catch (error) {
            this.log.error(`[onReady] error: ${error.message}, stack: ${error.stack}`);
        }
    }

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

    // Exit adapter 
    onUnload(callback) {
        try {
            this.connection.disconnect();
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

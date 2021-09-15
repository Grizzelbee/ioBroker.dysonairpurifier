/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint esversion: 6 */
/* jslint node: true */
'use strict';

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop();

// Load additional modules
const mqtt   = require('mqtt');
// const {stringify} = require('flatted');

// Load utils for this adapter
const dysonUtils = require('./dyson-utils.js');
const dysonConstants = require('./dysonConstants.js');

// Variable definitions
let adapter = null;
let adapterIsSetUp = false;
let devices = [];
let NO2  = 0; // Numeric representation of current NO2Index
let VOC  = 0; // Numeric representation of current VOCIndex
let PM25 = 0; // Numeric representation of current PM25Index
let PM10 = 0; // Numeric representation of current PM10Index
let Dust = 0; // Numeric representation of current DustIndex




/**
 * Main class of dyson AirPurifier adapter for ioBroker
 */
class dysonAirPurifier extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({...options, name: adapterName});

        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }



    /**
     * onMessage
     *
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     * This function exchanges information between the admin frontend and the backend.
     * In detail: it performs the 2 FA login at the dyson API. Therefore it receives messages from admin,
     * sends them to dyson and reaches the received data back to admin.
     *
     * @param {object} msg - Message object containing all necessary data to request the needed information
     */
    async onMessage( msg ) {
        if (typeof msg === 'object' && msg.callback && msg.from && msg.from.startsWith('system.adapter.admin') ) {
            if (msg.command === 'getDyson2faMail'){
                dysonUtils.getDyson2faMail(this, msg.message.email, msg.message.password, msg.message.country, msg.message.locale)
                    .then((response) => this.sendTo(msg.from, msg.command, response, msg.callback))
                    .catch((e) => {
                        this.log.warn(`Couldn't handle getDyson2faMail message: ${e}`);
                        this.sendTo(msg.from, msg.command, { error: e || 'No data' }, msg.callback);
                    });
            }
            if (msg.command === 'getDysonToken') {
                this.log.debug('OnMessage: getting Dyson-Token');
                dysonUtils.getDysonToken(this, msg.message.email, msg.message.password,msg.message.country, msg.message.challengeId, msg.message.PIN)
                    .then((response) => this.sendTo(msg.from, msg.command, response, msg.callback))
                    .catch((e) => {
                        this.log.warn(`Couldn't handle getDysonToken message: ${e}`);
                        this.sendTo(msg.from, msg.command, { error: e || 'No data' }, msg.callback);
                    });
            }
        }
    }

    /**
     * onStateChange
     *
     * Sends the control mqtt message to your device in case you changed a value
     *
     * @param id    {string} id of the datapoint that was changed
     * @param state {object} new state-object of the datapoint after change
     */
    async onStateChange(id, state) {
        // id=dysonairpurifier.0.VS9-EU-NAB0887A.OscillationAngle
        const thisDevice = id.split('.')[2];
        const action = id.split('.').pop();
        // Warning, state can be null if it was deleted
        if (state && !state.ack) {
            // you can use the ack flag to detect if it is status (true) or command (false)
            // get the whole data field array
            let dysonAction = await this.getDatapoint( action );
            if ( typeof dysonAction === 'undefined' ) {
                // if dysonAction is undefined it's an adapter internal action and has to be handled with the given Name
                dysonAction = action;
            } else {
                // pick the dyson internal Action from the result row
                dysonAction = dysonAction[0];
            }
            this.log.debug('onStateChange: Using dysonAction: [' + dysonAction + ']');
            let messageData = {[dysonAction]: state.val};
            switch (dysonAction) {
                case 'Hostaddress' :
                    for (const mqttDevice in devices){
                        //noinspection JSUnresolvedVariable
                        if (devices[mqttDevice].Serial === thisDevice){
                            if (!state.val || typeof state.val === undefined || state.val === '') {
                                devices[mqttDevice].Hostaddress = thisDevice;
                            } else {
                                devices[mqttDevice].Hostaddress = state.val;
                            }
                            this.log.info(`Host address of device [${devices[mqttDevice].Serial}] has changed. Reconnecting with new address: [${devices[mqttDevice].Hostaddress}].`);
                            devices[mqttDevice].mqttClient = mqtt.connect('mqtt://' + devices[mqttDevice].Hostaddress, {
                                username: devices[mqttDevice].Serial,
                                password: devices[mqttDevice].mqttPassword,
                                protocolVersion: 3,
                                protocolId: 'MQIsdp'
                            });
                        }
                    }
                    break;
                case 'fnsp' :
                    // when AUTO set AUTO to true also
                    if (state.val === 'AUTO') {
                        // add second value to message to get auto mode working
                        messageData.auto = 'ON';
                    }
                    break;
                case 'hmax':{
                    // Target temperature for heating in KELVIN!
                    // convert temperature to configured unit
                    let value = Number.parseInt(state.val, 10);
                    switch (this.config.temperatureUnit) {
                        case 'K' : value *= 10;
                            break;
                        case 'C' :
                            value = Number((value*10) + 273.15).toFixed(2);
                            break;
                        case 'F' :
                            value = Number(((value*10) + 273.15) * (9/5) + 32).toFixed(2);
                            break;
                    }
                    messageData = {[dysonAction]: dysonUtils.zeroFill(value, 4)};
                    break;
                }
                case 'ancp':
                case 'osal':
                case 'osau': {
                    const result = await dysonUtils.getAngles(this, dysonAction, id, state);
                    this.log.debug(`Result of getAngles: ${JSON.stringify(result)}`);
                    result.ancp = Number.parseInt(result.ancp.val);
                    result.osal = Number.parseInt(result.osal.val);
                    result.osau = Number.parseInt(result.osau.val);
                    if (result.osal + result.ancp > 355) {
                        result.osau = 355;
                        result.osal = 355 - result.ancp;
                    } else if (result.osau - result.ancp < 5) {
                        result.osal = 5;
                        result.osau = 5 + result.ancp;
                    } else {
                        result.osau = result.osal + result.ancp;
                    }
                    messageData = {
                        ['osal']: dysonUtils.zeroFill(result.osal, 4),
                        ['osau']: dysonUtils.zeroFill(result.osau, 4),
                        ['ancp']: 'CUST',
                        ['oson']: 'ON'
                    };
                }
                    break;

            }
            // only send to device if change should set a device value
            if (action !== 'Hostaddress'){
                // build the message to be send to the device
                const message = {'msg': 'STATE-SET',
                    'time': new Date().toISOString(),
                    'mode-reason': 'LAPP',
                    'state-reason':'MODE',
                    'data': messageData
                };
                for (const mqttDevice in devices){
                    //noinspection JSUnresolvedVariable
                    if (devices[mqttDevice].Serial === thisDevice){
                        this.log.debug('MANUAL CHANGE: device [' + thisDevice + '] -> [' + action +'] -> [' + state.val + ']');
                        this.log.info('SENDING this data to device (' + thisDevice + '): ' + JSON.stringify(message));
                        //noinspection JSUnresolvedVariable
                        devices[mqttDevice].mqttClient.publish(
                            devices[mqttDevice].ProductType + '/' + thisDevice + '/command',
                            JSON.stringify(message)
                        );
                    }
                }
            }
        } else if (state && state.ack) {
            // state changes by hardware or adapter depending on hardware values
            // check if it is an Index calculation
            if ( action.substr( action.length-5, 5 ) === 'Index' ) {
                // if some index has changed recalculate overall AirQuality
                this.createOrExtendObject(thisDevice + '.AirQuality', {
                    type: 'state',
                    common: {
                        name: 'Overall AirQuality (worst value of all indexes)',
                        'read': true,
                        'write': false,
                        'role': 'value',
                        'type': 'number',
                        'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
                    },
                    native: {}
                }, Math.max(NO2, VOC, Dust, PM25, PM10));
            }
        }
    }




    /**
     * CreateOrUpdateDevice
     *
     * Creates the base device information
     *
     * @param device  {object} data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     * @param {string} device.Serial Serial number of the device
     * @param {string} device.ProductType Product type of the device
     * @param {string} device.Version
     * @param {string} device.AutoUpdate
     * @param {string} device.NewVersionAvailable
     * @param {string} device.ConnectionType
     * @param {string} device.Name
     * @param {string} device.hostAddress
     */
    async CreateOrUpdateDevice(device){
        try {
            // create device folder
            this.log.debug('Creating device folder.');
            await this.createOrExtendObject(device.Serial, {
                type: 'device',
                common: {name: dysonConstants.PRODUCTS[device.ProductType].name, icon: dysonConstants.PRODUCTS[device.ProductType].icon, type:'string'},
                native: {}
            }, null);
            await this.createOrExtendObject(device.Serial + '.Firmware', {
                type: 'channel',
                common: {name: 'Information on device\'s firmware', 'read': true, 'write': false, type:'string', role:'value'},
                native: {}
            }, null);
            await this.createOrExtendObject(device.Serial + '.Firmware.Version', {
                type: 'state',
                common: {
                    name: 'Current firmware version',
                    'read': true,
                    'write': false,
                    'role': 'value',
                    'type': 'string'
                },
                native: {}
            }, device.Version);
            await this.createOrExtendObject(device.Serial + '.Firmware.Autoupdate', {
                type: 'state',
                common: {
                    name: 'Shows whether the device updates it\'s firmware automatically if update is available.',
                    'read': true,
                    'write': true,
                    'role': 'indicator',
                    'type': 'boolean'
                },
                native: {}
            }, device.AutoUpdate);
            await this.createOrExtendObject(device.Serial + '.Firmware.NewVersionAvailable', {
                type: 'state',
                common: {
                    name: 'Shows whether a firmware update for this device is available online.',
                    'read': true,
                    'write': false,
                    'role': 'indicator',
                    'type': 'boolean'
                },
                native: {}
            }, device.NewVersionAvailable);
            await this.createOrExtendObject(device.Serial + '.ProductType', {
                type: 'state',
                common: {
                    name: 'dyson internal productType.',
                    'read': true,
                    'write': false,
                    'role': 'value',
                    'type': 'string'
                },
                native: {}
            }, device.ProductType);
            await this.createOrExtendObject(device.Serial + '.ConnectionType', {
                type: 'state',
                common: {
                    name: 'Type of connection.',
                    'read': true,
                    'write': false,
                    'role': 'value',
                    'type': 'string'
                },
                native: {}
            }, device.ConnectionType);
            await this.createOrExtendObject(device.Serial + '.Name', {
                type: 'state',
                common: {name: 'Name of device.', 'read': true, 'write': true, 'role': 'value', 'type': 'string'},
                native: {}
            }, device.Name);
            this.log.debug('Querying Host-Address of device: ' + device.Serial);
            const hostAddress = await this.getStateAsync(device.Serial + '.Hostaddress');
            this.log.debug('Got Host-Address-object [' + JSON.stringify(hostAddress) + '] for device: ' + device.Serial);
            if (hostAddress  && hostAddress.val && hostAddress.val !== '') {
                this.log.debug('Found valid Host-Address [' + hostAddress.val + '] for device: ' + device.Serial);
                this.createOrExtendObject(device.Serial + '.Hostaddress', {
                    type: 'state',
                    common: {
                        name: 'Local host address (or IP) of device.',
                        'read': true,
                        'write': true,
                        'role': 'value',
                        'type': 'string'
                    },
                    native: {}
                }, hostAddress.val);
            } else {
                // No valid IP address of device found. Without we can't proceed. So terminate adapter.
                this.createOrExtendObject(device.Serial + '.Hostaddress', {
                    type: 'state',
                    common: {
                        name: 'Local host address (IP) of device.',
                        'read': true,
                        'write': true,
                        'role': 'value',
                        'type': 'string'
                    },
                    native: {}
                }, device.Serial);
            }
        } catch(error){
            this.log.error('[CreateOrUpdateDevice] Error: ' + error + ', Callstack: ' + error.stack);
        }
    }

    /**
     * processMsg
     *
     * Processes the current received message and updates relevant data fields
     *
     * @param device  {object} additional data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     * @param path    {string} Additional subfolders can be given here if needed with a leading dot (eg. .Sensor)!
     * @param message {object} Current State of the device. Message is send by device via mqtt due to request or state change.
     */
    async processMsg( device, path, message ) {
        for (const row in message){
            // Is this a "product-state" message?
            if ( row === 'product-state'){
                await this.processMsg(device, '', message[row]);
                return;
            }
            // Is this a "data" message?
            if ( row === 'data'){
                await this.processMsg(device, '.Sensor', message[row]);
                if (Object.prototype.hasOwnProperty.call(message[row], 'pm25')) {
                    this.createPM25(message, row, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[row], 'pm10')) {
                    this.createPM10(message, row, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[row], 'pact')) {
                    this.createDust(message, row, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[row], 'va10')) {
                    this.createVOC(message, row, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[row], 'noxl')) {
                    this.createNO2(message, row, device);
                }
                return;
            }
            // Handle all other message types
            this.log.debug('Processing Message: ' + ((typeof message === 'object')? JSON.stringify(message) : message) );
            const deviceConfig = await this.getDatapoint(row);
            if ( deviceConfig === undefined){
                this.log.debug(`Skipped creating unknown data field for: [${row}], Device:[${device.Serial}], Value:[${((typeof( message[row] ) === 'object')? JSON.stringify(message[row]) : message[row])}]`);
                continue;
            }
            // strip leading zeros from numbers
            let value;
            if (deviceConfig[3]==='number'){
                value = Number.parseInt(message[deviceConfig[0]], 10);
                // TP02: When continuous monitoring is off and the fan ist switched off - temperature and humidity loose their values.
                // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
                if ( message[deviceConfig[0]] === 'OFF' && adapter.config.keepValues ) {
                    continue;
                }
                if (deviceConfig[0] === 'filf') {
                    // create additional data field filterlifePercent converting value from hours to percent; 4300 is the estimated lifetime in hours by dyson
                    this.createOrExtendObject( device.Serial + path + '.FilterLifePercent', { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':'%', 'states': deviceConfig[7]}, native: {} }, Number(value * 100/4300));
                }
            } else {
                if (deviceConfig[5] === 'value.temperature') {
                    // TP02: When continuous monitoring is off and the fan ist switched off - temperature and humidity loose their values.
                    // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
                    if ( message[deviceConfig[0]] === 'OFF' && adapter.config.keepValues ) {
                        continue;
                    }
                    value = Number.parseInt(message[deviceConfig[0]], 10);
                    // convert temperature to configured unit
                    switch (this.config.temperatureUnit) {
                        case 'K' :
                            value /= 10;
                            break;
                        case 'C' :
                            deviceConfig[6] = '°' + this.config.temperatureUnit;
                            value = Number((value / 10) - 273.15).toFixed(2);
                            break;
                        case 'F' :
                            deviceConfig[6] = '°' + this.config.temperatureUnit;
                            value = Number(((value / 10) - 273.15) * (9 / 5) + 32).toFixed(2);
                            break;
                    }
                } else{
                    value = message[deviceConfig[0]];
                }
            }
            // during state-change message only changed values are being updated
            if (typeof (value) === 'object') {
                if (value[0] === value[1]) {
                    this.log.debug('Values for [' + deviceConfig[1] + '] are equal. No update required. Skipping.');
                    continue;
                } else {
                    value = value[1].valueOf();
                }
                this.log.debug(`Value is an object. Converting to value: [${JSON.stringify(value)}] --> [${value.valueOf()}]`);
                value = value.valueOf();
            }
            // deviceConfig.length>7 means the data field has predefined states attached, that need to be handled
            if (deviceConfig.length > 7) {
                this.log.debug(`DeviceConfig: length()=${deviceConfig.length}, 7=[${JSON.stringify(deviceConfig[7])}]`);
                let currentStates={};
                if (deviceConfig[7]===dysonConstants.LOAD_FROM_PRODUCTS){

                    this.log.debug(`Sideloading states for token [${deviceConfig[0]}] - Device:[${device.Serial}], Type:[${device.ProductType}].`);

                    currentStates=dysonConstants.PRODUCTS[device.ProductType][deviceConfig[0]];
                    this.log.debug(`Sideloading: Found states [${JSON.stringify(currentStates)}].`);
                }




                this.createOrExtendObject( device.Serial + path + '.'+ deviceConfig[1], { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':deviceConfig[6], 'states': currentStates}, native: {} }, value);
            } else {
                this.createOrExtendObject( device.Serial + path + '.'+ deviceConfig[1], { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':deviceConfig[6] }, native: {} }, value);
            }
            // deviceConfig[4]=true -> data field is editable, so subscribe for state changes
            if (deviceConfig[4]==='true') {
                //this.log.debug('Subscribing for state changes on :' + device.Serial + path + '.'+ deviceConfig[1] );
                this.subscribeStates(device.Serial + path + '.'+ deviceConfig[1] );
            }
        }
    }

    /**
     * createNO2
     *
     * creates the data fields for the values itself and the index if the device has a NO2 sensor
     *
     * @param message {object} the received mqtt message
     * @param {number} message[].noxl
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createNO2(message, row, device) {
        // NO2 QualityIndex
        // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
        let NO2Index = 0;
        if (message[row].noxl < 4) {
            NO2Index = 0;
        } else if (message[row].noxl >= 4 && message[row].noxl <= 6) {
            NO2Index = 1;
        } else if (message[row].noxl >= 7 && message[row].noxl <= 8) {
            NO2Index = 2;
        } else if (message[row].noxl >= 9) {
            NO2Index = 3;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.NO2Index', {
            type: 'state',
            common: {
                name: 'NO2 QualityIndex. 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number',
                'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
            },
            native: {}
        }, NO2Index);
        NO2 = NO2Index;
        this.subscribeStates(device.Serial + '.Sensor.NO2Index' );
    }

    /**
     * createVOC
     *
     * creates the data fields for the values itself and the index if the device has a VOC sensor
     *
     * @param message {object} the received mqtt message
     * @param {number} message[].va10
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createVOC(message, row, device) {
        // VOC QualityIndex
        // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
        let VOCIndex = 0;
        if (message[row].va10 < 40) {
            VOCIndex = 0;
        } else if (message[row].va10 >= 40 && message[row].va10 < 70) {
            VOCIndex = 1;
        } else if (message[row].va10 >= 70 && message[row].va10 < 90) {
            VOCIndex = 2;
        } else if (message[row].va10 >= 90) {
            VOCIndex = 3;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.VOCIndex', {
            type: 'state',
            common: {
                name: 'VOC QualityIndex. 0-39: Good, 40-69: Medium, 70-89: Bad, >90: very Bad',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number',
                'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
            },
            native: {}
        }, VOCIndex);
        VOC = VOCIndex;
        this.subscribeStates(device.Serial + '.Sensor.VOCIndex' );
    }

    /**
     * createPM10
     *
     * creates the data fields for the values itself and the index if the device has a PM 10 sensor
     *
     * @param message {object} the received mqtt message
     * @param {number} message[].pm10
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createPM10(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying
        let PM10Index = 0;
        if (message[row].pm10 < 51) {
            PM10Index = 0;
        } else if (message[row].pm10 >= 51 && message[row].pm10 <= 75) {
            PM10Index = 1;
        } else if (message[row].pm10 >= 76 && message[row].pm10 <= 100) {
            PM10Index = 2;
        } else if (message[row].pm10 >= 101 && message[row].pm10 <= 350) {
            PM10Index = 3;
        } else if (message[row].pm10 >= 351 && message[row].pm10 <= 420) {
            PM10Index = 4;
        } else if (message[row].pm10 >= 421) {
            PM10Index = 5;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.PM10Index', {
            type: 'state',
            common: {
                name: 'PM10 QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number',
                'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
            },
            native: {}
        }, PM10Index);
        PM10 = PM10Index;
        this.subscribeStates(device.Serial + '.Sensor.PM10Index' );
    }

    /**
     * createDust
     *
     * creates the data fields for the values itself and the index if the device has a simple dust sensor
     *
     * @param message {object} the received mqtt message
     * @param {number} message[].pact
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createDust(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying
        let dustIndex = 0;
        if (message[row].pact < 51) {
            dustIndex = 0;
        } else if (message[row].pact >= 51 && message[row].pact <= 75) {
            dustIndex = 1;
        } else if (message[row].pact >= 76 && message[row].pact <= 100) {
            dustIndex = 2;
        } else if (message[row].pact >= 101 && message[row].pact <= 350) {
            dustIndex =3;
        } else if (message[row].pact >= 351 && message[row].pact <= 420) {
            dustIndex = 4;
        } else if (message[row].pact >= 421) {
            dustIndex = 5;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.DustIndex', {
            type: 'state',
            common: {
                name: 'Dust QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number',
                'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
            },
            native: {}
        }, dustIndex);
        Dust = dustIndex;
        this.subscribeStates(device.Serial + '.Sensor.DustIndex' );
    }

    /**
     * createPM25
     *
     * creates the data fields for the values itself and the index if the device has a PM 2,5 sensor
     *
     * @param message {object} the received mqtt message
     * @param {number} message[].pm25
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createPM25(message, row, device) {
        // PM2.5 QualityIndex
        // 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremely Bad, >251 worrying
        let PM25Index = 0;
        if (message[row].pm25 < 36) {
            PM25Index = 0;
        } else if (message[row].pm25 >= 36 && message[row].pm25 <= 53) {
            PM25Index = 1;
        } else if (message[row].pm25 >= 54 && message[row].pm25 <= 70) {
            PM25Index = 2;
        } else if (message[row].pm25 >= 71 && message[row].pm25 <= 150) {
            PM25Index = 3;
        } else if (message[row].pm25 >= 151 && message[row].pm25 <= 250) {
            PM25Index = 4;
        } else if (message[row].pm25 >= 251) {
            PM25Index = 5;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.PM25Index', {
            type: 'state',
            common: {
                name: 'PM2.5 QualityIndex. 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremely Bad, >251 worrying',
                'read': true,
                'write': false,
                'role': 'value',
                'type': 'number',
                'states' : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremely Bad', 5:'worrying'}
            },
            native: {}
        }, PM25Index);
        PM25 = PM25Index;
        this.subscribeStates(device.Serial + '.Sensor.PM25Index' );
    }

    /**
     * main
     *
     * It's the main routine of the adapter
     */
    async main() {
        const adapterLog = this.log;
        try {
            adapterLog.info('Querying devices from dyson API.');
            devices = await dysonUtils.getDevices(adapter.config.token, adapter);
            if (typeof devices != 'undefined') {
                for (const thisDevice in devices) {
                    await this.CreateOrUpdateDevice(devices[thisDevice]);
                    // Initializes the MQTT client for local communication with the thisDevice
                    if (!devices[thisDevice].hostAddress || devices[thisDevice].hostAddress === '' || devices[thisDevice].hostAddress === 'undefined' || typeof devices[thisDevice].hostAddress === undefined) {
                        adapter.log.info('No host address given. Trying to connect to the device with it\'s default hostname [' + devices[thisDevice].Serial + ']. This should work if you haven\'t changed it and if you\'re running a DNS.');
                        devices[thisDevice].hostAddress = devices[thisDevice].Serial;
                    }
                    // subscribe to changes on host address to re-init adapter on changes
                    this.log.debug('Subscribing for state changes on :' + devices[thisDevice].Serial + '.Hostaddress');
                    this.subscribeStates(devices[thisDevice].Serial + '.Hostaddress');
                    // connect to device
                    adapterLog.info(`Trying to connect to device [${devices[thisDevice].Serial}] via MQTT on host address [${devices[thisDevice].hostAddress}].`);
                    devices[thisDevice].mqttClient = mqtt.connect('mqtt://' + devices[thisDevice].hostAddress, {
                        username: devices[thisDevice].Serial,
                        password: devices[thisDevice].mqttPassword,
                        protocolVersion: 3,
                        protocolId: 'MQIsdp'
                    });
                    //noinspection JSUnresolvedVariable
                    adapterLog.info(devices[thisDevice].Serial + ' - MQTT connection requested for [' + devices[thisDevice].hostAddress + '].');

                    // Subscribes for events of the MQTT client
                    devices[thisDevice].mqttClient.on('connect', function () {
                        //noinspection JSUnresolvedVariable
                        adapterLog.info(devices[thisDevice].Serial + ' - MQTT connection established.');
                        adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'online');

                        // Subscribes to the status topic to receive updates
                        //noinspection JSUnresolvedVariable
                        devices[thisDevice].mqttClient.subscribe(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/status/current', function () {

                            // Sends an initial request for the current state
                            //noinspection JSUnresolvedVariable
                            devices[thisDevice].mqttClient.publish(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/command', JSON.stringify({
                                msg: 'REQUEST-CURRENT-STATE',
                                time: new Date().toISOString()
                            }));
                        });
                        // Sets the interval for status updates
                        adapterLog.info('Starting Polltimer with a ' + adapter.config.pollInterval + ' seconds interval.');
                        // start refresh scheduler with interval from adapters config
                        devices[thisDevice].updateIntervalHandle = setTimeout(function schedule() {
                            //noinspection JSUnresolvedVariable
                            adapterLog.debug('Updating device [' + devices[thisDevice].Serial + '] (polling API scheduled).');
                            try {
                                //noinspection JSUnresolvedVariable
                                devices[thisDevice].mqttClient.publish(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/command', JSON.stringify({
                                    msg: 'REQUEST-CURRENT-STATE',
                                    time: new Date().toISOString()
                                }));
                            } catch (error) {
                                //noinspection JSUnresolvedVariable
                                adapterLog.error(devices[thisDevice].Serial + ' - MQTT interval error: ' + error);
                            }
                            // expect adapter has created all data points after first 20 secs of run.
                            setTimeout(()=> {adapterIsSetUp = true;}, 20000);
                            devices[thisDevice].updateIntervalHandle = setTimeout(schedule, adapter.config.pollInterval * 1000);
                        }, 10);
                    });
                    devices[thisDevice].mqttClient.on('message', async function (_, payload) {
                        // change dataType from Buffer to JSON object
                        payload = JSON.parse(payload.toString());
                        adapterLog.debug('MessageType: ' + payload.msg);
                        switch (payload.msg) {
                            case 'CURRENT-STATE' :
                                await adapter.processMsg(devices[thisDevice], '', payload);
                                break;
                            case 'ENVIRONMENTAL-CURRENT-SENSOR-DATA' :
                                //noinspection JSUnresolvedVariable
                                await adapter.createOrExtendObject(devices[thisDevice].Serial + '.Sensor', {
                                    type: 'channel',
                                    common: {
                                        name: 'Information from device\'s sensors',
                                        type: 'folder',
                                        'read': true,
                                        'write': false
                                    },
                                    native: {}
                                }, null);
                                await adapter.processMsg(devices[thisDevice], '.Sensor', payload);
                                break;
                            case 'STATE-CHANGE':
                                await adapter.processMsg(devices[thisDevice], '', payload);
                                break;
                        }
                        //noinspection JSUnresolvedVariable
                        adapterLog.debug(devices[thisDevice].Serial + ' - MQTT message received: ' + JSON.stringify(payload));
                    });

                    devices[thisDevice].mqttClient.on('error', function (error) {
                        //noinspection JSUnresolvedVariable
                        adapterLog.debug(devices[thisDevice].Serial + ' - MQTT error: ' + error);
                        //noinspection JSUnresolvedVariable
                        adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'error');
                    });

                    devices[thisDevice].mqttClient.on('reconnect', function () {
                        //noinspection JSUnresolvedVariable
                        adapterLog.info(devices[thisDevice].Serial + ' - MQTT reconnecting.');
                        //noinspection JSUnresolvedVariable
                        adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'reconnect');
                    });

                    devices[thisDevice].mqttClient.on('close', function () {
                        //noinspection JSUnresolvedVariable
                        adapterLog.info(devices[thisDevice].Serial + ' - MQTT disconnected.');
                        adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                        //noinspection JSUnresolvedVariable
                        adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'disconnected');
                    });

                    devices[thisDevice].mqttClient.on('offline', function () {
                        //noinspection JSUnresolvedVariable
                        adapterLog.info(devices[thisDevice].Serial + ' - MQTT offline.');
                        adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                        //noinspection JSUnresolvedVariable
                        adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'offline');
                    });

                    devices[thisDevice].mqttClient.on('end', function () {
                        //noinspection JSUnresolvedVariable
                        adapterLog.debug(devices[thisDevice].Serial + ' - MQTT ended.');
                        adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                    });
                }
            } else {
                adapterLog.error(`Unable to retrieve data from dyson servers. May be e.g. a failed login or connection issues. Please check.`);
            }
        } catch (error) {
            this.setState('info.connection', false, true);
            adapterLog.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    /**
     * onReady
     *
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Terminate adapter after first start because configuration is not yet received
        // Adapter is restarted automatically when config page is closed
        adapter = this; // preserve adapter reference to address functions etc. correctly later
        try{
            const configIsValid = await dysonUtils.checkAdapterConfig(adapter);
            if (configIsValid) {
                adapter.getForeignObject('system.config', (err, obj) => {
                    if (adapter.supportsFeature && adapter.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE')) {
                        if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                            adapter.config.Password = this.decrypt(obj.native.secret, adapter.config.Password);
                        }
                        this.main();
                    } else {
                        throw new Error('This adapter requires at least js-controller V3.0.0. Your system is not compatible. Please update your system.');
                    }
                });
            } else {
                adapter.log.warn('This adapter has no or no valid configuration. Starting anyway to give you the opportunity to configure it properly.');
                this.setState('info.connection', false, true);
            }
        } catch(error)  {
            adapter.log.warn('This adapter has no or no valid configuration. Starting anyway to give you the opportunity to configure it properly.');
            this.setState('info.connection', false, true);
        }
    }
    /***********************************************
     * Misc helper functions                       *
     ***********************************************/

    /**
     * Function setDeviceOnlineState
     * Sets an indicator whether the device is reachable via mqtt
     *
     * @param device {string} path to the device incl. Serial
     * @param state  {string} state to set (online, offline, reconnecting, ...)
     */
    setDeviceOnlineState(device,  state) {
        this.createOrExtendObject(device + '.Online', {
            type: 'state',
            common: {
                name: 'Indicator whether device is online or offline.',
                'read': true,
                'write': false,
                'role': 'indicator.reachable',
                'type': 'boolean'
            },
            native: {}
        }, state === 'online');
        this.setState('info.connection', state === 'online', true);
    }

    /**
     * Function Create or extend object
     *
     * Updates an existing object (id) or creates it if not existing.
     *
     * @param id {string} path/id of datapoint to create
     * @param objData {object} details to the datapoint to be created (Device, channel, state, ...)
     * @param value {any} value of the datapoint
     */
    createOrExtendObject(id, objData, value) {
        if (adapterIsSetUp) {
            this.setState(id, value, true);
        } else {
            const self = this;
            this.getObject(id, function (err, oldObj) {
                if (!err && oldObj) {
                    //self.log.debug('Updating existing object [' + id +'] with value: ['+ value+']');
                    self.extendObject(id, objData, () => {self.setState(id, value, true);});
                } else {
                    //self.log.debug('Creating new object [' + id +'] with value: ['+ value+']');
                    self.setObjectNotExists(id, objData, () => {self.setState(id, value, true);});
                }
            });
        }
    }

    /**
     * getDatapoint
     *
     * returns the configDetails for any datapoint
     *
     * @param searchValue {string} dysonCode to search for.
     *
     * @returns {string} returns the configDetails for any given datapoint or undefined if searchValue can't be resolved.
     */
    async getDatapoint( searchValue ){
        // this.log.debug('getDatapoint('+searchValue+')');
        for(let row=0; row < dysonConstants.DATAPOINTS.length; row++){
            if (dysonConstants.DATAPOINTS[row].find(element => element === searchValue)){
                // this.log.debug('FOUND: ' + dysonConstants.DATAPOINTS[row]);
                return dysonConstants.DATAPOINTS[row];
            }
        }
    }

    /**
     * Function clearIntervalHandle
     *
     * sets an intervalHandle (timeoutHandle) to null if it's existing to clear it
        *
     * @param updateIntervalHandle  {any} timeOutHandle to be checked and cleared
     */
    clearIntervalHandle(updateIntervalHandle){
        if (updateIntervalHandle) {
            clearTimeout(updateIntervalHandle);
            return null;
        } else {
            return updateIntervalHandle;
        }
    }

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
            for (const thisDevice in devices)  {
                clearTimeout(devices[thisDevice].updateIntervalHandle);
                this.log.info('Cleaned up timeout for ' + devices[thisDevice].Serial + '.');
            }
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
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new dysonAirPurifier(options);
} else {
    // otherwise start the instance directly
    new dysonAirPurifier();
}
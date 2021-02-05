// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
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

// Variable definitions
let adapter = null;
let adapterIsSetUp = false;
let devices = [];
const products = {  '358':'Dyson Pure Humidify+Cool',
    '438':'Dyson Pure Cool Tower',
    '455':'Dyson Pure Hot+Cool Link',
    '469':'Dyson Pure Cool Link Desk',
    '475':'Dyson Pure Cool Link Tower',
    '520':'Dyson Pure Cool Desk',
    '527':'Dyson Pure Hot+Cool'};
let NO2  = 0; // Numeric representation of current NO2Index
let VOC  = 0; // Numeric representation of current VOCIndex
let PM25 = 0; // Numeric representation of current PM25Index
let PM10 = 0; // Numeric representation of current PM10Index
let Dust = 0; // Numeric representation of current DustIndex


// data structure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ dysonCode, Name of Datapoint, Description, datatype, writable, role, unit, possible values for data field]
const datapoints = [
    ['channel' , 'WIFIchannel'            , 'Number of the used WIFI channel.'                                              , 'number', 'false', 'value'         ,''  ],
    ['ercd' , 'LastErrorCode'             , 'Error code of the last error occurred on this device'                          , 'string', 'false', 'text'          ,''  ],
    ['filf' , 'FilterLife'                , 'Estimated remaining filter life in hours.'                                     , 'number', 'false', 'value'         , 'hours' ],
    ['fmod' , 'FanMode'                   , 'Mode of device'                                                                , 'string', 'false', 'switch'        ,'', {'FAN':'Fan', 'AUTO':'Auto'} ],
    ['fnsp' , 'FanSpeed'                  , 'Current fan speed'                                                             , 'string', 'true',  'switch'        ,'', {'AUTO':'Auto', '0001':'1', '0002':'2', '0003':'3', '0004':'4', '0005':'5', '0006':'6', '0007':'7', '0008':'8', '0009':'9', '0010':'10' } ],
    ['fnst' , 'FanStatus'                 , 'Current Fan state; correlating to Auto-mode'                                   , 'string', 'false', 'text'          ,'' ],
    ['nmod' , 'Nightmode'                 , 'Night mode state'                                                              , 'string', 'true',  'switch.mode.moonlight'  ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['qtar' , 'AirQualityTarget'          , 'Target Air quality for Auto Mode.'                                             , 'string', 'false', 'text'          ,''  ],
    ['rhtm' , 'ContinuousMonitoring'      , 'Continuous Monitoring of environmental sensors even if device is off.'         , 'string', 'true',  'switch'        ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['fpwr' , 'MainPower'                 , 'Main Power of fan.'                                                            , 'string', 'true',  'switch.power'  ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['auto' , 'AutomaticMode'             , 'Fan is in automatic mode.'                                                     , 'string', 'true',  'switch'        ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['nmdv' , 'NightModeMaxFan'           , 'Maximum fan speed in night mode.'                                              , 'number', 'false', 'value'         ,''  ],
    ['cflr' , 'CarbonfilterLifetime'      , 'Remaining lifetime of activated carbon filter.'                                , 'number', 'false', 'value' 	 	 ,'%' ],
    ['fdir' , 'Flowdirection'             , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'string', 'true',  'switch'        ,'', {'OFF': 'Back', 'ON': 'Front'} ],
    ['ffoc' , 'Flowfocus'                 , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'string', 'true',  'switch'        ,'', {'OFF': 'Back', 'ON': 'Front'} ],
    ['hflr' , 'HEPA-FilterLifetime'       , 'Remaining lifetime of HEPA-Filter.'                                            , 'number', 'false', 'value'         ,'%' ],
    ['cflt' , 'Carbonfilter'              , 'Filter type installed in carbon filter port.'                                  , 'string', 'false', 'text'          ,''  ],
    ['hflt' , 'HEPA-Filter'               , 'Filter type installed in HEPA-filter port.'                                    , 'string', 'false', 'text'              ,''  ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer.'                                                                  , 'string', 'false', 'text'              ,''  ],
    ['oscs' , 'OscillationActive'         , 'Fan is currently oscillating.'                                                 , 'string', 'false', 'text'              ,'', {'IDLE':'Idle', 'OFF':'OFF', 'ON':'ON'} ],
    ['oson' , 'Oscillation'               , 'Oscillation of fan.'                                                           , 'string', 'true',  'switch'            ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['osal' , 'OscillationLeft'           , 'OscillationAngle Lower Boundary'                                               , 'string', 'true',  'text'              ,'°' ],
    ['osau' , 'OscillationRight'          , 'OscillationAngle Upper Boundary'                                               , 'string', 'true',  'text'              ,'°' ],
    ['ancp' , 'OscillationAngle'          , 'OscillationAngle'                                                              , 'string', 'true',  'text'              ,'°', {0:'0', 15:'15', 30:'30', 45:'45', 90:'90', 180:'180', 270:'270', 350:'350', 'CUST':'CUST'} ],
    ['rssi' , 'RSSI'                      , 'Received Signal Strength Indication. Quality indicator for WIFI signal.'       , 'number', 'false', 'value'             ,'dBm' ],
    ['pact' , 'Dust'                      , 'Dust'                                                                          , 'number', 'false', 'value'             ,''  ],
    ['hact' , 'Humidity'                  , 'Humidity'                                                                      , 'number', 'false', 'value.humidity'    ,'%' ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer'                                                                   , 'number', 'false', 'value'             ,'Min' ],
    ['tact' , 'Temperature'               , 'Temperature'                                                                   , 'number', 'false', 'value.temperature' ,'' ],
    ['vact' , 'VOC'                       , 'VOC - Volatile Organic Compounds'                                              , 'number', 'false', 'value'             ,'' ],
    ['pm25' , 'PM25'                      , 'PM2.5 - Particulate Matter 2.5µm'                                              , 'number', 'false', 'value'             ,'µg/m³' ],
    ['pm10' , 'PM10'                      , 'PM10 - Particulate Matter 10µm'                                                , 'number', 'false', 'value'             ,'µg/m³' ],
    ['va10' , 'VOC'                       , 'VOC - Volatile Organic Compounds (inside)'                                     , 'number', 'false', 'value'             ,'' ],
    ['noxl' , 'NO2'                       , 'NO2 - Nitrogen dioxide (inside)'                                               , 'number', 'false', 'value'             ,'' ],
    ['p25r' , 'PM25R'                     , 'PM-2.5R - Particulate Matter 2.5µm'                                            , 'number', 'false', 'value'             ,'µg/m³' ],
    ['p10r' , 'PM10R'                     , 'PM-10R - Particulate Matter 10µm'                                              , 'number', 'false', 'value'             ,'µg/m³' ],
    ['hmod' , 'HeaterMode'                , 'Heating Mode [ON/OFF]'                                                         , 'string', 'true',  'switch'            ,'', {'OFF': 'OFF', 'ON': 'ON'} ],
    ['hmax' , 'TemperatureTarget'         , 'Target temperature for heating'                                                , 'number', 'true',  'value'             ,'°' ],
    ['hume' , 'HumidificationMode'        , 'HumidificationMode Switch [ON/OFF]'                                            , 'string', 'true', 'switch'             ,'', {'OFF': 'OFF', 'ON': 'ON'} ],
    ['haut' , 'HumidifyAutoMode'          , 'Humidify AutoMode [ON/OFF]'                                                    , 'string', 'true', 'switch'             ,'', {'OFF': 'OFF', 'ON': 'ON'} ],
    ['humt' , 'HumidificationTarget'      , 'Manual Humidification Target'                                                  , 'string', 'false', 'text'              ,'' ],
    ['cdrr' , 'CleanDurationRemaining'    , 'Clean Duration Remaining'                                                      , 'string', 'false', 'text'              ,'' ],
    ['rect' , 'AutoHumidificationTarget'  , 'Auto Humidification target'                                                    , 'string', 'false', 'text'              ,'' ],
    ['cltr' , 'TimeRemainingToNextClean'  , 'Time Remaining to Next Clean'                                                  , 'string', 'false', 'text'              ,'' ],
    ['wath' , 'WaterHardness'             , 'Water Hardness'                                                                , 'string', 'false', 'text'              ,'' ]
];

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
        // this.on('message', this.onMessage.bind(this));
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
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
            }
            this.log.info('SENDING this data to device (' + thisDevice + '): ' + JSON.stringify(messageData));
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
                    //noinspection JSUnresolvedVariable
                    devices[mqttDevice].mqttClient.publish(
                        devices[mqttDevice].ProductType + '/' + thisDevice + '/command',
                        JSON.stringify(message)
                    );
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
     */
    async CreateOrUpdateDevice(device){
        try {
            // create device folder
            this.log.debug('Creating device folder.');
            this.createOrExtendObject(device.Serial, {
                type: 'device',
                common: {name: products[device.ProductType]},
                native: {}
            }, null);
            this.createOrExtendObject(device.Serial + '.Firmware', {
                type: 'channel',
                common: {name: 'Information on device\'s firmware', 'read': true, 'write': false},
                native: {}
            }, null);
            this.createOrExtendObject(device.Serial + '.Firmware.Version', {
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
            this.createOrExtendObject(device.Serial + '.Firmware.Autoupdate', {
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
            this.createOrExtendObject(device.Serial + '.Firmware.NewVersionAvailable', {
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
            this.createOrExtendObject(device.Serial + '.ProductType', {
                type: 'state',
                common: {
                    name: 'dyson internal productType.',
                    'read': true,
                    'write': false,
                    'role': 'value',
                    'type': 'number'
                },
                native: {}
            }, device.ProductType);
            this.createOrExtendObject(device.Serial + '.ConnectionType', {
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
            this.createOrExtendObject(device.Serial + '.Name', {
                type: 'state',
                common: {name: 'Name of device.', 'read': true, 'write': true, 'role': 'value', 'type': 'string'},
                native: {}
            }, device.Name);
            this.log.debug('Querying Host-Address of device: ' + device.Serial);
            this.getStateAsync(device.Serial + '.Hostaddress')
                .then((state) => {
                    if (state  && state.val !== '') {
                        this.log.debug('Found valid Host-Address.val [' + state.val + '] for device: ' + device.Serial);
                        device.hostAddress = state.val;
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
                        }, device.hostAddress);
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
                        }, undefined);
                        this.log.error(`IP-Address (${device.hostAddress}) of device [${device.Serial}] is invalid or can't be resolved. Please enter the valid IP of this device in your LAN to the device tree.`);
                        this.setState('info.connection', false);
                        this.terminate('Terminating Adapter due to missing or invalid device IP.', 11);
                    }
                })
                .catch( (error) => {
                    this.log.error('[CreateOrUpdateDevice-getSateAsync] Error: ' + error + ', Callstack: ' + error.stack);
                });
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
                continue;
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
                continue;
            }
            // Handle all other message types
            this.log.debug('Processing Message: ' + ((typeof message === 'object')? JSON.stringify(message) : message) );
            const deviceConfig = await this.getDatapoint(row);
            if ( deviceConfig === undefined){
                this.log.info('Skipped creating unknown data field for: [' + row + '] Value: |-> ' + ((typeof( message[row] ) === 'object')? JSON.stringify(message[row]) : message[row]) );
                continue;
            }
            // strip leading zeros from numbers
            let value;
            if (deviceConfig[3]==='number'){
                // convert temperature to configured unit
                value = Number.parseInt(message[deviceConfig[0]], 10);
                if (deviceConfig[5] === 'value.temperature') {
                    switch (this.config.temperatureUnit) {
                        case 'K' : value /= 10;
                            break;
                        case 'C' :
                            deviceConfig[6] = '°' + this.config.temperatureUnit;
                            value = Number((value/10) - 273.15).toFixed(2);
                            break;
                        case 'F' :
                            deviceConfig[6] = '°' + this.config.temperatureUnit;
                            value = Number(((value/10) - 273.15) * (9/5) + 32).toFixed(2);
                            break;
                    }
                }
                if (deviceConfig[0] === 'filf') {
                    // create additional data field filterlifePercent converting value from hours to percent; 4300 is the estimated lifetime in hours by dyson
                    value = Number(value * 100/4300);
                    this.createOrExtendObject( device.Serial + path + '.FilterLifePercent', { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':'%', 'states': deviceConfig[7]}, native: {} }, value);
                }
            } else {
                value = message[deviceConfig[0]];
            }
            // during state-change message only changed values are being updated
            if (typeof (value) === 'object') {
                if (value[0] === value[1]) {
                    this.log.debug('Values for [' + deviceConfig[1] + '] are equal. No update required. Skipping.');
                } else {
                    value = value[1];
                }
            }
            // deviceConfig.length>7 means the data field has predefined states attached, that need to be handled
            if (deviceConfig.length > 7) {
                this.createOrExtendObject( device.Serial + path + '.'+ deviceConfig[1], { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':deviceConfig[6], 'states': deviceConfig[7]}, native: {} }, value);
            } else {
                this.createOrExtendObject( device.Serial + path + '.'+ deviceConfig[1], { type: 'state', common: {name: deviceConfig[2], 'read':true, 'write': deviceConfig[4]==='true', 'role': deviceConfig[5], 'type':deviceConfig[3], 'unit':deviceConfig[6] }, native: {} }, value);
            }
            // deviceConfig[4]=true -> data field is editable, so subscribe for state changes
            if (deviceConfig[4]==='true') {
                this.log.debug('Subscribing for state changes on :' + device.Serial + path + '.'+ deviceConfig[1] );
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
     * @param row     {string} the current data row
     * @param device  {object} the device object the data is valid for
     */
    createDust(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying
        let dustIndex = 0;
        if (message[row].pm10 < 51) {
            dustIndex = 0;
        } else if (message[row].pm10 >= 51 && message[row].pm10 <= 75) {
            dustIndex = 1;
        } else if (message[row].pm10 >= 76 && message[row].pm10 <= 100) {
            dustIndex = 2;
        } else if (message[row].pm10 >= 101 && message[row].pm10 <= 350) {
            dustIndex =3;
        } else if (message[row].pm10 >= 351 && message[row].pm10 <= 420) {
            dustIndex = 4;
        } else if (message[row].pm10 >= 421) {
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
            const myAccount = await dysonUtils.getMqttCredentials(adapter);
            if (typeof myAccount !== 'undefined'){
                adapterLog.debug('Querying devices from dyson API.');
                devices = await dysonUtils.getDevices(myAccount, adapter);
                for (const thisDevice in devices) {
                    this.CreateOrUpdateDevice(devices[thisDevice])
                        .then(() => {
                            // Initializes the MQTT client for local communication with the thisDevice
                            adapterLog.debug('Trying to connect device [' + devices[thisDevice].Serial + '] to mqtt.');
                            if (devices[thisDevice].hostAddress === undefined) {
                                adapterLog.info('No host address given. Trying to connect to the device with it\'s default hostname [' + devices[thisDevice].Serial + ']. This should work if you haven\'t changed it and if you\'re running a DNS.');
                                devices[thisDevice].hostAddress = devices[thisDevice].Serial;
                            }
                            devices[thisDevice].mqttClient = mqtt.connect('mqtt://' + devices[thisDevice].hostAddress, {
                                username: devices[thisDevice].Serial,
                                password: devices[thisDevice].mqttPassword,
                                protocolVersion: 3,
                                protocolId: 'MQIsdp'
                            });
                            //noinspection JSUnresolvedVariable
                            adapterLog.debug(devices[thisDevice].Serial + ' - MQTT connection requested for [' + devices[thisDevice].hostAddress + '].');

                            // Subscribes for events of the MQTT client
                            devices[thisDevice].mqttClient.on('connect', function () {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT connection established.');

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
                            devices[thisDevice].mqttClient.on('message', function (_, payload) {
                                // change dataType from Buffer to JSON object
                                payload = JSON.parse(payload.toString());
                                adapterLog.debug('MessageType: ' + payload.msg);
                                switch (payload.msg) {
                                    case 'CURRENT-STATE' :
                                        adapter.processMsg(devices[thisDevice], '', payload);
                                        break;
                                    case 'ENVIRONMENTAL-CURRENT-SENSOR-DATA' :
                                        //noinspection JSUnresolvedVariable
                                        adapter.createOrExtendObject(devices[thisDevice].Serial + '.Sensor', {
                                            type: 'channel',
                                            common: {
                                                name: 'Information from device\'s sensors',
                                                'read': true,
                                                'write': false
                                            },
                                            native: {}
                                        }, null);
                                        adapter.processMsg(devices[thisDevice], '.Sensor', payload);
                                        break;
                                    case 'STATE-CHANGE':
                                        adapter.processMsg(devices[thisDevice], '', payload);
                                        break;
                                }
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT message received: ' + JSON.stringify(payload));
                                //noinspection JSUnresolvedVariable
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'online');
                            });

                            devices[thisDevice].mqttClient.on('error', function (error) {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT error: ' + error);
                                //noinspection JSUnresolvedVariable
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'error');
                            });

                            devices[thisDevice].mqttClient.on('reconnect', function () {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT reconnecting.');
                                //noinspection JSUnresolvedVariable
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'reconnect');
                            });

                            devices[thisDevice].mqttClient.on('close', function () {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT disconnected.');
                                adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                                //noinspection JSUnresolvedVariable
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'disconnected');
                            });

                            devices[thisDevice].mqttClient.on('offline', function () {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT offline.');
                                adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                                //noinspection JSUnresolvedVariable
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'offline');
                            });

                            devices[thisDevice].mqttClient.on('end', function () {
                                //noinspection JSUnresolvedVariable
                                adapterLog.debug(devices[thisDevice].Serial + ' - MQTT ended.');
                                adapter.clearIntervalHandle(devices[thisDevice].updateIntervalHandle);
                            });
                        })
                        .catch((error) => {
                            adapterLog.error(`[main/CreateOrUpdateDevice] error: ${error.message}, stack: ${error.stack}`);
                        });
                }
            } else{
                adapterLog.error(`[main()] error: myAccount is: [` + myAccount + ']');
                this.terminate('Terminating Adapter due to error with the mqtt credentials.', 11);
            }
        } catch (error) {
            adapterLog.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    /**
     * onReady
     *
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            adapter = this; // preserve adapter reference to address functions etc. correctly later
            dysonUtils.checkAdapterConfig(adapter)
                .then(() => {
                    // configisValid! Decrypt password now
                    adapter.getForeignObject('system.config', (err, obj) => {
                        if (!adapter.supportsFeature || !adapter.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE')) {
                            if (obj && obj.native && obj.native.secret) {
                                //noinspection JSUnresolvedVariable
                                adapter.config.Password = this.decrypt(obj.native.secret, adapter.config.Password);
                            } else {
                                //noinspection JSUnresolvedVariable
                                adapter.config.Password = this.decrypt('Zgfr56gFe87jJOM', adapter.config.Password);
                            }
                        }
                        this.main();
                    });
                })
                .catch((error) => {
                    this.log.error('Error during config validation: ' + error);
                    this.setState('info.connection', false);
                    this.terminate('Terminating adapter until configuration is fixed.', 11);
                });
        } catch (error) {
            this.log.error(`[onReady] error: ${error.message}, stack: ${error.stack}`);
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
    }

    /**
     * Function Create or extend object
     *
     * Updates an existing object (id) or creates it if not existing.
     *
     * @param id {string} path/id of datapoint to create
     * @param objData {object} details to the datapoint to be created (Device, channel, state, ...)
     * @param value {any} value of the datapoint
     * @param callback {callback} callback function
     */
    createOrExtendObject(id, objData, value) {
        if (adapterIsSetUp) {
            this.setState(id, value, true);
        } else {
            const self = this;
            this.getObject(id, function (err, oldObj) {
                if (!err && oldObj) {
                    self.log.debug('Updating existing object [' + id +'] with value: ['+ value+']');
                    self.extendObject(id, objData, () => {self.setState(id, value, true);});
                } else {
                    self.log.debug('Creating new object [' + id +'] with value: ['+ value+']');
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
        this.log.debug('getDatapoint('+searchValue+')');
        for(let row=0; row < datapoints.length; row++){
            if (datapoints[row].find( element => element === searchValue)){
                this.log.debug('FOUND: ' + datapoints[row]);
                return datapoints[row];
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
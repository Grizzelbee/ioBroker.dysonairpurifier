// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop();

// Load additional modules
const axios  = require('axios');
const mqtt   = require('mqtt');
const {stringify} = require('flatted');
const path = require('path');
const https = require('https');
const rootCas = require('ssl-root-cas').create();
rootCas.addFile(path.resolve(__dirname, 'certificates/intermediate.pem'));
const httpsAgent = new https.Agent({ca: rootCas});

// Load utils for this adapter
const dysonUtils = require('./dyson-utils.js');

// Variable definitions
let devices=[]; // Array that contains all local devices
// const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const apiUri = 'https://appapi.cp.dyson.com';
const supportedProductTypes = ['358', '438', '455', '469', '475', '520', '527'];
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


// datastructure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ dysonCode, Name of Datapoint, Description, datatype, writable, role, unit, possible values for data field]
const datapoints = [
    ["channel" , "WIFIchannel"            , "Number of the used WIFI channel."                                              , "number", "false", "value.wifiChannel"           ,"" ],
    ["ercd" , "LastErrorCode"             , "Errorcode of the last error occured on this device"                            , "string", "false", "value.error"                 ,"" ],
    ["filf" , "FilterLife"                , "Estimated remaining filterlife in hours."                                      , "number", "false", "value.lifetime"        , "hours" ],
    ["fmod" , "Mode"                      , "Mode of device"                                                                , "string", "false", "value"                       ,"", {'FAN':'Fan', 'AUTO':'Auto'} ],
    ["fnsp" , "FanSpeed"                  , "Current fanspeed"                                                              , "string", "true",  "value.fanspeed"              ,"", {'AUTO':'Auto', '0001':'1', '0002':'2', '0003':'3', '0004':'4', '0005':'5', '0006':'6', '0007':'7', '0008':'8', '0009':'9', '0010':'10' } ],
    ["fnst" , "FanStatus"                 , "Current Fanstate"                                                              , "string", "true",  "state.fan"                   ,"", {'FAN':'Fan', 'OFF':'OFF', 'ON':'ON'} ],
    ["nmod" , "Nightmode"                 , "Nightmode state"                                                               , "string", "true",  "indicator.nightmode"         ,"", {'OFF':'OFF', 'ON':'ON'} ],
    ["oson" , "Oscillation"               , "Oscillation of fan."                                                           , "string", "true",  "state.oscillation"           ,"", {'OFF':'OFF', 'ON':'ON'} ],
    ["qtar" , "AirQualityTarget"          , "Target Air quality for Auto Mode."                                             , "string", "false", "value"                       ,"" ],
    ["rhtm" , "ContiniousMonitoring"      , "Continious Monitoring of environmental sensors even if device is off."         , "string", "true",  "state.continiousMonitoring"  ,"", {'OFF':'OFF', 'ON':'ON'} ],
    ["fpwr" , "MainPower"                 , "Main Power of fan."                                                            , "string", "true",  "state.power"                 ,"", {'OFF':'OFF', 'ON':'ON'} ],
    ["auto" , "AutomaticMode"             , "Fan is in automatic mode."                                                     , "string", "true",  "state.automatic"             ,"", {'OFF':'OFF', 'ON':'ON'} ],
    ["oscs" , "OscillationActive"         , "Fan is currently oscillating."                                                 , "string", "false", "indicator.oscillation"       ,"", {'IDLE':'Idle', 'OFF':'OFF', 'ON':'ON'} ],
    ["nmdv" , "NightModeMaxFan"           , "Maximum fan speed in night mode."                                              , "number", "false", "value"                       ,"" ],
    ["cflr" , "CarbonfilterLifetime"      , "Remaining lifetime of activated coalfilter."                                   , "number", "false", "state.coalfilter" 		  ,"%" ],
    ["fdir" , "Fandirection"              , "Direction the fan blows to. ON=Front; OFF=Back"                                , "string", "true",  "indicator.fandirection"      ,"", {'OFF': 'Back', 'ON': 'Front'} ],
    ["ffoc" , "Jetfocus    "              , "Jetfocus [ON/OFF]"                                                             , "string", "true",  "indicator.jetfocus"          ,"", {'OFF': 'OFF', 'ON': 'ON'} ],
    ["hflr" , "HEPA-FilterLifetime"       , "Remaining lifetime of HEPA-Filter."                                            , "number", "false", "state.hepaFilter"           ,"%" ],
    ["cflt" , "Carbonfilter"              , "Filtertype installed in carbonfilter port."                                    , "string", "false", "value"                       ,"" ],
    ["hflt" , "HEPA-Filter"               , "Filtertype installed in HEPA-filter port."                                     , "string", "false", "value"                       ,"" ],
    ["sltm" , "Sleeptimer"                , "Sleeptimer."                                                                   , "string", "false", "indicator.sleeptimer"        ,"" ],
    ["osal" , "OscilationLeft"            , "Maximum oscillation to the left. Relative to Ancorpoint."                      , "string", "true",  "value"                      ,"°" ],
    ["osau" , "OscilationRight"           , "Maximum oscillation to the right. Relative to Ancorpoint."                     , "string", "true",  "value"                      ,"°" ],
    ["ancp" , "Anchorpoint"               , "Anchorpoint for oscillation. By default the dyson logo on the bottom plate."   , "string", "true",  "value.anchor"               ,"°" ],
    ["rssi" , "RSSI"                      , "Received Signal Strength Indication. Quality indicator for WIFI signal."       , "number", "false", "value.rssi"               ,"dBm" ],
    ["pact" , "Dust"                      , "Dust"                                                                          , "number", "false", "value.dust"                  ,"" ],
    ["hact" , "Humidity"                  , "Humidity"                                                                      , "number", "false", "value.humidity"             ,"%" ],
    ["sltm" , "Sleeptimer"                , "Sleeptimer"                                                                    , "number", "false", "value.timer"              ,"Min" ],
    ["tact" , "Temperature"               , "Temperature"                                                                   , "number", "false", "value.temperature"           ,"" ],
    ["vact" , "VOC"                       , "VOC - Volatil Organic Compounds"                                               , "number", "false", "value.voc"                   ,"" ],
    ["pm25" , "PM25"                      , "PM2.5 - Particulate Matter 2.5µm"                                              , "number", "false", "value.PM25"             ,"µg/m³" ],
    ["pm10" , "PM10"                      , "PM10 - Particulate Matter 10µm"                                                , "number", "false", "value.PM10"             ,"µg/m³" ],
    ["va10" , "VOC"                       , "VOC - Volatil Organic Compounds (inside)"                                      , "number", "false", "value.VOC"                   ,"" ],
    ["noxl" , "NO2"                       , "NO2 - Nitrogen dioxide (inside)"                                               , "number", "false", "value.NO2"                   ,"" ],
    ["p25r" , "PM25R"                     , "PM-2.5R - Particulate Matter 2.5µm"                                            , "number", "false", "value.PM25"             ,"µg/m³" ],
    ["p10r" , "PM10R"                     , "PM-10R - Particulate Matter 10µm"                                              , "number", "false", "value.PM10"             ,"µg/m³" ],
    ["hmod" , "HeatingMode"               , "Heating Mode [ON/OFF]"                                                         , "string", "true",  "indicator.heating"           ,"", {'OFF': 'OFF', 'ON': 'ON'} ],
    ["hmax" , "HeatingTargetTemp"         , "Target temperature for heating"                                                , "string", "true",  "value.temperature"           ,"" ],
    ["hume" , "DehumidifierState"         , "Dehumidifier State [ON/OFF]"                                                   , "string", "false", "value"                       ,"" ],
    ["haut" , "TargetHumidifierState"     , "Target Humidifier Dehumidifier State"                                          , "string", "false", "value"                       ,"" ],
    ["humt" , "RelativeHumidityThreshold" , "Relative Humidity Humidifier Threshold"                                        , "string", "false", "value"                       ,"" ],
    ["psta" , "psta"                      , "[HP0x] Unknown"                                                                , "string", "false", "value"                       ,"" ],
    ["hsta" , "hsta"                      , "[HP0x] Unknown"                                                                , "string", "false", "value"                       ,"" ],
    ["tilt" , "tilt"                      , "[HP0x] Unknown"                                                                , "string", "false", "value"                       ,"" ],
    ["bril" , "bril"                      , "Unknown"                                                                       , "string", "false", "value"                       ,"" ],
    ["corf" , "corf"                      , "Unknown"                                                                       , "string", "false", "value"                       ,"" ],
    ["fqhp" , "fqhp"                      , "Unknown"                                                                       , "string", "false", "value"                       ,"" ],
    ["msta" , "msta"                      , "Unknown"                                                                       , "string", "false", "value"                       ,"" ],
    ["wacd" , "wacd"                      , "Unknown"                                                                       , "string", "false", "value"                       ,"" ]
];

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
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /*
    * Function onStateChange
    * sends the control mqtt message to your device in case you changed a value
    *
    * @param id    {string} id of the datapoint that was changed
    * @param state {object} new state-object of the datapoint after change
    */
    async onStateChange(id, state) {
        // Warning, state can be null if it was deleted
        if (state && !state.ack) {
            // you can use the ack flag to detect if it is status (true) or command (false)
            let action = id.split('.').pop();
            // get the whole datafield array
            let dysonAction = await this.getDatapoint( action );
            // pick the dyson internal Action
            dysonAction = dysonAction[0];
            let messageData = {[dysonAction]: state.val};
            switch (dysonAction) {
                case 'fnsp' :
                    // when AUTO set AUTO to true also
                    if (state.val === "AUTO") {
                        // add second value to message to get auto mode working
                        messageData.auto = "ON";
                    }
                    break;
                case 'hmax':
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
            this.log.info('SENDING this data to device: ' + JSON.stringify(messageData));
            let thisDevice = id.split('.')[2];
            // build the message to be send to the device
            let message = {"msg": "STATE-SET",
                           "time": new Date().toISOString(),
                           "mode-reason": "LAPP",
                           "data": messageData
                };
            for (let mqttDevice in devices){
                if (devices[mqttDevice].Serial === thisDevice){
                    this.log.debug('CHANGE: device [' + thisDevice + '] -> [' + action +'] -> [' + state.val + ']');
                    devices[mqttDevice].mqttClient.publish(
                        devices[mqttDevice].ProductType + '/' + thisDevice + '/command',
                        JSON.stringify(message)
                    );
                }
            }
        } else if (state && state.ack) {
            // statechanges by hardware or adapter depending on hardware values
            // check if it is an Index calculation
            let action = id.split('.').pop();
            if ( action.substr( action.length-5, 5 ) === 'Index' ) {
                let device = id.split('.'); // convert string into array
                device.pop(); // remove first last element from devicepath
                device.pop(); // remove second last element from devicepath
                this.createOrExtendObject(device.join('.') + '.AirQuality', {
                    type: 'state',
                    common: {
                        name: 'Overall AirQuality (worst value of all indexes)',
                        "read": true,
                        "write": false,
                        "role": "value",
                        "type": "number",
                        "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
                    },
                    native: {}
                }, Math.max(NO2, VOC, Dust, PM25, PM10));
            }

        }
    }

    /*
     * Function CreateOrUpdateDevice
     * Creates the base device information
     * @param device  {object} data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     */
    async CreateOrUpdateDevice(device){
        try {
            // create device folder
            this.log.debug("Creating device folder.");
            this.createOrExtendObject(device.Serial, {
                type: 'device',
                common: {name: products[device.ProductType]},
                native: {}
            });
            this.createOrExtendObject(device.Serial + '.Firmware', {
                type: 'channel',
                common: {name: 'Information on device\'s firmware', "read": true, "write": false},
                native: {}
            });
            this.createOrExtendObject(device.Serial + '.Firmware.Version', {
                type: 'state',
                common: {
                    name: 'Current firmware version',
                    "read": true,
                    "write": false,
                    "role": "value",
                    "type": "string"
                },
                native: {}
            }, device.Version);
            this.createOrExtendObject(device.Serial + '.Firmware.Autoupdate', {
                type: 'state',
                common: {
                    name: 'Shows whether the device updates it\'s firmware automatically if update is avaliable.',
                    "read": true,
                    "write": true,
                    "role": "indicator.autoupdate",
                    "type": "boolean"
                },
                native: {}
            }, device.AutoUpdate);
            this.createOrExtendObject(device.Serial + '.Firmware.NewVersionAvailable', {
                type: 'state',
                common: {
                    name: 'Shows whether a firmware update for this device is avaliable online.',
                    "read": true,
                    "write": false,
                    "role": "indicator.firmwareupdate",
                    "type": "boolean"
                },
                native: {}
            }, device.NewVersionAvailable);
            this.createOrExtendObject(device.Serial + '.ProductType', {
                type: 'state',
                common: {
                    name: 'dyson internal productType.',
                    "read": true,
                    "write": false,
                    "role": "value",
                    "type": "number"
                },
                native: {}
            }, device.ProductType);
            this.createOrExtendObject(device.Serial + '.ConnectionType', {
                type: 'state',
                common: {
                    name: 'Type of connection.',
                    "read": true,
                    "write": false,
                    "role": "value",
                    "type": "string"
                },
                native: {}
            }, device.ConnectionType);
            this.createOrExtendObject(device.Serial + '.Name', {
                type: 'state',
                common: {name: 'Name of device.', "read": true, "write": true, "role": "value", "type": "string"},
                native: {}
            }, device.Name);
            this.createOrExtendObject(device.Serial + '.MqttCredentials', {
                type: 'state',
                common: {
                    name: 'Local MQTT password of device.',
                    "read": true,
                    "write": false,
                    "role": "value",
                    "type": "string"
                },
                native: {}
            }, device.mqttPassword);
            this.log.debug('Querying Host-Address of device: ' + device.Serial);
            await this.getStateAsync(device.Serial + '.Hostaddress')
                .then((state) => {
                    if (state  && state.val !== '') {
                        this.log.debug('Found valid Host-Address.val [' + state.val + '] for device: ' + device.Serial);
                        device.hostAddress = state.val;
                        this.createOrExtendObject(device.Serial + '.Hostaddress', {
                            type: 'state',
                            common: {
                                name: 'Local host address (IP) of device.',
                                "read": true,
                                "write": true,
                                "role": "value",
                                "type": "string"
                            },
                            native: {}
                        }, device.hostAddress);
                    } else {
                        // No valid IP address of device found. Without we can't proceed. So terminate adapter.
                        this.createOrExtendObject(device.Serial + '.Hostaddress', {
                            type: 'state',
                            common: {
                                name: 'Local host address (IP) of device.',
                                "read": true,
                                "write": true,
                                "role": "value",
                                "type": "string"
                            },
                            native: {}
                        }, undefined);
                        this.log.error('IP-Address of device ['+ device.Serial +'] is invalid. Please enter the valid IP of this device in your LAN to the devicetree.');
                        this.setState('info.connection', false);
                        this.terminate('Terminating Adapter due to missing or invalid device IP.', 11);
                    }
                })
                .catch( (error) => {
                    this.log.error("[CreateOrUpdateDevice-getSateAsync] Error: " + error + ", Callstack: " + error.stack);
                });
        } catch(error){
            this.log.error("[CreateOrUpdateDevice] Error: " + error + ", Callstack: " + error.stack);
        }
    }

    /*
     * Function processMsg
     * processes the current received message and updates relevant data fields
     *
     * @param device  {object} additional data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     * @param path    {string} Additional subfolders can be given here if needed with a leading dot (eg. .Sensor)!
     * @param message {object} Current State of the device. Message is send by device via mqtt due to request or state change.
     */
    async processMsg( device, path, message ) {
        for (let row in message){
            // Is this a "product-state" message?
            if ( row === "product-state"){
                this.processMsg(device, "", message[row]);
                continue;
            }
            // Is this a "data" message?
            if ( row === "data"){
                this.processMsg(device, ".Sensor", message[row]);
                if ( message[row].hasOwnProperty('pm25') ) {
                    this.createPM25(message, row, device);
                }
                if ( message[row].hasOwnProperty('pm10') ) {
                    this.createPM10(message, row, device);
                }
                if ( message[row].hasOwnProperty('pact') ) {
                    this.createDust(message, row, device);
                }
                if ( message[row].hasOwnProperty('va10') ) {
                    this.createVOC(message, row, device);
                }
                if ( message[row].hasOwnProperty('noxl') ) {
                    this.createNO2(message, row, device);
                }
                continue;
            }
            // Handle all other message types
            this.log.debug('Processing Message: ' + ((typeof message === 'object')? JSON.stringify(message) : message) );
            const helper = await this.getDatapoint(row);
            if ( helper === undefined){
                this.log.info("Skipped creating unknown datafield for: [" + row + "] Value: |-> " + ((typeof( message[row] ) === "object")? JSON.stringify(message[row]) : message[row]) );
                continue;
            }
            // strip leading zeros from numbers
            let value;
            if (helper[3]==="number"){
                // convert temperature to configured unit
                value = Number.parseInt(message[helper[0]], 10);
                if (helper[5] === "value.temperature") {
                    switch (this.config.temperatureUnit) {
                        case 'K' : value /= 10;
                            break;
                        case 'C' :
                            helper[6] = '°' + this.config.temperatureUnit;
                            value = Number((value/10) - 273.15).toFixed(2);
                            break;
                        case 'F' :
                            helper[6] = '°' + this.config.temperatureUnit;
                            value = Number(((value/10) - 273.15) * (9/5) + 32).toFixed(2);
                            break;
                    }
                }
                if (helper[0] === 'filf') {
                    // create additional data field filterlifePercent converting value from hours to percent; 4300 is the estimated lifetime in hours by dyson
                    value = Number(value * 100/4300);
                    helper[5] = '%';
                    this.createOrExtendObject( device.Serial + path + '.FilterLifePercent', { type: 'state', common: {name: helper[2], "read":true, "write": helper[4]==="true", "role": helper[5], "type":helper[3], "unit":helper[6], "states": helper[7]}, native: {} }, value );
                }
            } else {
                value = message[helper[0]];
            }
            // during state-change message only changed values are being updated
            if (typeof(value)==="object"){
               if (value[0] === value[1]){
                    this.log.debug('Values for [' + helper[1] + '] are equal. No update required. Skipping.');
                    continue;
                } else {
                   value = value[1];
               }
            }
            if (helper.length > 7) {
                this.createOrExtendObject( device.Serial + path + '.'+ helper[1], { type: 'state', common: {name: helper[2], "read":true, "write": helper[4]==="true", "role": helper[5], "type":helper[3], "unit":helper[6], "states": helper[7]}, native: {} }, value );
            } else {
                this.createOrExtendObject( device.Serial + path + '.'+ helper[1], { type: 'state', common: {name: helper[2], "read":true, "write": helper[4]==="true", "role": helper[5], "type":helper[3], "unit":helper[6] }, native: {} }, value );
            }
            if (helper[4]==="true") {
                this.log.debug('Subscribing for statechanges on :' + device.Serial + path + '.'+ helper[1] );
                this.subscribeStates(device.Serial + path + '.'+ helper[1] );
            }
        }
    }

    /*
     * createNO2
     * creates the data fields for the values itself and the index if the device has a NO2 sensor
     *
     * @param message {object} the received mqtt message
     * @param row     {string} the current datarow
     * @param device  {object} the deviceobject the data is valid for
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
                "read": true,
                "write": false,
                "role": "value",
                "type": "number",
                "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
            },
            native: {}
        }, NO2Index);
        NO2 = NO2Index;
        this.subscribeStates(device.Serial + '.Sensor.NO2Index' );
    }

    /*
     * createVOC
     * creates the data fields for the values itself and the index if the device has a VOC sensor
     *
     * @param message {object} the received mqtt message
     * @param row     {string} the current datarow
     * @param device  {object} the deviceobject the data is valid for
     */
    createVOC(message, row, device) {
        // VOC QualityIndex
        // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
        let VOCIndex = 0;
        if (message[row].va10 < 4) {
            VOCIndex = 0;
        } else if (message[row].va10 >= 4 && message[row].va10 <= 6) {
            VOCIndex = 1;
        } else if (message[row].va10 >= 7 && message[row].va10 <= 8) {
            VOCIndex = 2;
        } else if (message[row].va10 >= 9) {
            VOCIndex = 3;
        }
        this.createOrExtendObject(device.Serial + '.Sensor.VOCIndex', {
            type: 'state',
            common: {
                name: 'VOC QualityIndex. 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad',
                "read": true,
                "write": false,
                "role": "value",
                "type": "number",
                "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
            },
            native: {}
        }, VOCIndex);
        VOC = VOCIndex;
        this.subscribeStates(device.Serial + '.Sensor.VOCIndex' );
    }

    /*
     * createPM10
     * creates the data fields for the values itself and the index if the device has a PM 10 sensor
     *
     * @param message {object} the received mqtt message
     * @param row     {string} the current datarow
     * @param device  {object} the deviceobject the data is valid for
     */
    createPM10(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying
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
                name: 'PM10 QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying',
                "read": true,
                "write": false,
                "role": "value",
                "type": "number",
                "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
            },
            native: {}
        }, PM10Index);
        PM10 = PM10Index;
        this.subscribeStates(device.Serial + '.Sensor.PM10Index' );
    }

    /*
     * createDust
     * creates the data fields for the values itself and the index if the device has a simple dust sensor
     *
     * @param message {object} the received mqtt message
     * @param row     {string} the current datarow
     * @param device  {object} the deviceobject the data is valid for
     */
    createDust(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying
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
                name: 'Dust QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying',
                "read": true,
                "write": false,
                "role": "value",
                "type": "number",
                "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
            },
            native: {}
        }, dustIndex);
        Dust = DustIndex;
        this.subscribeStates(device.Serial + '.Sensor.DustIndex' );
    }

    /*
     * createPM25
     * creates the data fields for the values itself and the index if the device has a PM 2,5 sensor
     *
     * @param message {object} the received mqtt message
     * @param row     {string} the current datarow
     * @param device  {object} the deviceobject the data is valid for
     */
    createPM25(message, row, device) {
        // PM2.5 QualityIndex
        // 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremly Bad, >251 worrying
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
                name: 'PM2.5 QualityIndex. 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremly Bad, >251 worrying',
                "read": true,
                "write": false,
                "role": "value",
                "type": "number",
                "states" : {0:'Good', 1:'Medium', 2:'Bad', 3:'very Bad', 4:'extremly Bad', 5:'worrying'}
            },
            native: {}
        }, PM25Index);
        PM25 = PM25Index;
        this.subscribeStates(device.Serial + '.Sensor.PM25Index' );
    }

    /*
        *  Main
        * It's the main routine of the adapter
        */
    async main() {
        let updateIntervalHandle;
        try {
            let myAccount;
            const adapter = this;
            await this.dysonAPILogIn(this.config)
                .then( (response) => {
                    this.log.debug('Successful dyson API Login.');
                    // Creates the authorization header for further use
                    myAccount = 'Basic ' + Buffer.from(response.data.Account + ':' + response.data.Password).toString('base64');
                    this.log.debug('[dysonAPILogIn]: Statuscode from Axios: [' + response.status + ']');
                    this.log.debug('[dysonAPILogIn]: Statustext from Axios [' + response.statusText+ ']');
                })
                .catch( (error) => {
                    this.log.error('Error during dyson API login:' + error + ', Callstack: ' + error.stack);
                    if (error.response) {
                        // The request was made and the server responded with a status code
                        // that falls out of the range of 2xx
                        switch (error.response.status){
                            case 401 : // unauthorized
                                this.log.error('Error: Unable to authenticate user! Your credentials are invalid. Please doublecheck and fix them. This adapter has a maximum Pwd length of 32 chars.');
                                break;
                            default:
                                this.log.error('[error.response.data]: '    + ( (typeof error.response.data    === 'object')? stringify(error.response.data):error.response.data ) );
                                this.log.error('[error.response.status]: '  + ( (typeof error.response.status  === 'object')? stringify(error.response.status):error.response.status ) );
                                this.log.error('[error.response.headers]: ' + ( (typeof error.response.headers === 'object')? stringify(error.response.headers):error.response.headers ) );
                                break;
                        }
                    } else if (error.request) {
                        // The request was made but no response was received
                        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                        // http.ClientRequest in node.js
                        this.log.error('[error.request]: ' + ((typeof error.request === 'object')? stringify(error.request):error.request ) );
                    } else {
                        // Something happened in setting up the request that triggered an Error
                        this.log.error('[Error]: ', error.message);
                    }
                    this.log.error('[error.config]:' + JSON.stringify(error.config));
                    this.terminate('Terminating Adapter due to error during querying dyson API. Most common errors are missing or bad dyson credentials.', 11);
                })
            if (typeof myAccount !== 'undefined'){
                this.log.debug('Querying devices from dyson API.');
                await this.dysonGetDevicesFromApi(myAccount)
                    .then( (response) => {
                        for (let thisDevice in response.data) {
                            this.log.debug('Data received from dyson API: ' + JSON.stringify(response.data[thisDevice]));
                            // 1. create datapoints if device is supported
                            if (!supportedProductTypes.some(function (t) {
                                return t === response.data[thisDevice].ProductType;
                            })) {
                                this.log.warn('Device with serial number [' + response.data[thisDevice].Serial + '] not added, hence it is not supported by this adapter. Product type: [' + response.data[thisDevice].ProductType + ']');
                                this.log.warn('Please open an Issue on github if you think your device should be supported.');
                                continue;
                            } else {
                                // productType is supported: Push to Array and create in devicetree
                                response.data[thisDevice].hostAddress  = undefined;
                                response.data[thisDevice].mqttClient   = null;
                                response.data[thisDevice].mqttPassword = dysonUtils.decryptMqttPasswd(response.data[thisDevice].LocalCredentials);
                                devices.push(response.data[thisDevice]);
                            }
                        }
                    })
                    .catch( (error) => {
                        this.log.error('[dysonGetDevicesFromApi] Error: ('+error.statuscode+')' + error + ', Callstack: ' + error.stack);
                    })
                // 2. Search Network for IP-Address of current thisDevice
                // 2a. Store IP-Address in additional persistant datafield
                // 3. query local data from each thisDevice
                for (let thisDevice in devices) {
                    await this.CreateOrUpdateDevice(devices[thisDevice])
                        .then((response) => {
                            // Initializes the MQTT client for local communication with the thisDevice
                            this.log.debug('Trying to connect device [' + devices[thisDevice].Serial + '] to mqtt.');
                            devices[thisDevice].mqttClient = mqtt.connect('mqtt://' + devices[thisDevice].hostAddress, {
                                username: devices[thisDevice].Serial,
                                password: devices[thisDevice].mqttPassword,
                                protocolVersion: 3,
                                protocolId: 'MQIsdp'
                            });
                            this.log.debug(devices[thisDevice].Serial + ' - MQTT connection requested for [' + devices[thisDevice].hostAddress + '].');

                            // Subscribes for events of the MQTT client
                            devices[thisDevice].mqttClient.on('connect', function () {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT connection established.');

                                // Subscribes to the status topic to receive updates
                                devices[thisDevice].mqttClient.subscribe(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/status/current', function () {

                                    // Sends an initial request for the current state
                                    devices[thisDevice].mqttClient.publish(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/command', JSON.stringify({
                                        msg: 'REQUEST-CURRENT-STATE',
                                        time: new Date().toISOString()
                                    }));
                                })
                                // Sets the interval for status updates


                                adapter.log.info('Starting Polltimer with a ' + adapter.config.pollInterval + ' seconds interval.');
                                // start refresh scheduler with interval from adapters config
                                updateIntervalHandle = setTimeout(function schedule() {
                                    adapter.log.debug("Updating device [" + devices[thisDevice].Serial + "] (polling API scheduled).");
                                    try {
                                        devices[thisDevice].mqttClient.publish(devices[thisDevice].ProductType + '/' + devices[thisDevice].Serial + '/command', JSON.stringify({
                                            msg: 'REQUEST-CURRENT-STATE',
                                            time: new Date().toISOString()
                                        }));
                                    } catch (error) {
                                        adapter.log.error(devices[thisDevice].Serial + ' - MQTT interval error: ' + error);
                                    }
                                    updateIntervalHandle = setTimeout(schedule, adapter.config.pollInterval * 1000);
                                }, 10);
                            });
                            devices[thisDevice].mqttClient.on('message', function (_, payload) {
                                // change dataType from Buffer to JSON object
                                payload = JSON.parse(payload.toString());
                                adapter.log.debug("MessageType: " + payload.msg);
                                switch (payload.msg) {
                                    case "CURRENT-STATE" :
                                        adapter.processMsg(devices[thisDevice], "", payload);
                                        break;
                                    case "ENVIRONMENTAL-CURRENT-SENSOR-DATA" :
                                        adapter.createOrExtendObject(devices[thisDevice].Serial + '.Sensor', {
                                            type: 'channel',
                                            common: {
                                                name: 'Information from device\'s sensors',
                                                "read": true,
                                                "write": false
                                            },
                                            native: {}
                                        });
                                        adapter.processMsg(devices[thisDevice], ".Sensor", payload);
                                        break;
                                    case "STATE-CHANGE":
                                        adapter.processMsg(devices[thisDevice], "", payload);
                                        break;
                                }
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT message received: ' + JSON.stringify(payload));
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'online');
                            });

                            devices[thisDevice].mqttClient.on('error', function (error) {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT error: ' + error);
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'error');
                            });

                            devices[thisDevice].mqttClient.on('reconnect', function () {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT reconnecting.');
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'reconnect');
                            });

                            devices[thisDevice].mqttClient.on('close', function () {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT disconnected.');
                                adapter.clearIntervalHandle(updateIntervalHandle);
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'disconnected');
                            });

                            devices[thisDevice].mqttClient.on('offline', function () {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT offline.');
                                adapter.clearIntervalHandle(updateIntervalHandle);
                                adapter.setDeviceOnlineState(devices[thisDevice].Serial,  'offline');
                            });

                            devices[thisDevice].mqttClient.on('end', function () {
                                adapter.log.debug(devices[thisDevice].Serial + ' - MQTT ended.');
                                adapter.clearIntervalHandle(updateIntervalHandle);
                            });
                        })
                        .catch((error) => {
                            adapter.log.error(`[main/CreateOrUpdateDevice] error: ${error.message}, stack: ${error.stack}`);
                        });
                }
            }
        } catch (error) {
            this.log.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    

    /*
    * onReady
    * Is called when databases are connected and adapter received configuration.
    */
    async onReady() {
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            await dysonUtils.checkAdapterConfig(this)
                .then(() => {
                    // configisValid! Now decrypt password
                    this.getForeignObject('system.config', (err, obj) => {
                        if (obj && obj.native && obj.native.secret) {
                            //noinspection JSUnresolvedVariable
                            this.log.debug('System secrect resolved. Using for decryption.');
                            this.config.Password = dysonUtils.decrypt(obj.native.secret, this.config.Password);
                        } else {
                            //noinspection JSUnresolvedVariable
                            this.log.debug('System secrect rejected. Using SALT for decryption.');
                            this.config.Password = dysonUtils.decrypt('3eezLO2gNPrt1ww0pcWNhqPZxMjfb3br', this.config.Password);
                        }

                        // config is valid and password is decrypted -> run main() function
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

    /*
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
                name: 'Indicator whether device if online or offline.',
                "read": true,
                "write": false,
                "role": "indicator.reachable",
                "type": "boolean"
            },
            native: {}
        }, state === 'online');
    }

    /*
    * Function Create or extend object
    * Updates an existing object (id) or creates it if not existing.
    *
    * @param id {string} path/id of datapoint to create
    * @param objData {object} details to the datapoint to be created (Device, channel, state, ...)
    * @param value {ANY} value of the datapoint
    * @param callback {callback} callback function
    */
    createOrExtendObject(id, objData, value, callback) {
        const self = this;
        this.getObject(id, function (err, oldObj) {
            if (!err && oldObj) {
                self.log.debug('Updating existing object [' + id +'] with value: ['+ value+']');
                self.extendObject(id, objData, callback);
            } else {
                self.log.debug('Creating new object [' + id +'] with value: ['+ value+']');
                self.setObjectNotExists(id, objData, callback);
            }
            self.setState(id, value, true);
        });
    }

    /*
      * Function getDatapoint
      * returns the configDetails for any datapoint
      *
      * @param searchValue {string} dysonCode to search for.
      */
    async getDatapoint( searchValue ){
        this.log.debug("getDatapoint("+searchValue+")");
        for(let row=0; row < datapoints.length; row++){
            if (datapoints[row].find( element => element === searchValue)){
                this.log.debug("FOUND: " + datapoints[row]);
                return datapoints[row];
            }
        }
    }

    /*
     * Function clearIntervalHandle
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
            {httpsAgent});
    }

    async dysonGetDevicesFromApi(auth) {
        // Sends a request to the API to get all devices of the user
        return axios.get(apiUri + '/v2/provisioningservice/manifest',
            { httpsAgent,
              headers: { 'Authorization': auth },
              json: true}
            );
    }

    // Exit adapter
    onUnload(callback) {
        try {
                for (let thisDevice in devices) devices[thisDevice].mqttClient.close();
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
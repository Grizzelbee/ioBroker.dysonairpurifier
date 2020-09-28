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
const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const apiUri = 'https://appapi.cp.dyson.com';
const supportedProductTypes = ['358', '438', '455', '469', '475', '520', '527'];
const products = {  '358':'Dyson Pure Humidify+Cool',
                    '438':'Dyson Pure Cool Tower',
                    '455':'Dyson Pure Hot+Cool Link',
                    '469':'Dyson Pure Cool Link Desk',
                    '475':'Dyson Pure Cool Link Tower',
                    '520':'Dyson Pure Cool Desk',
                    '527':'Dyson Pure Hot+Cool'}

// datastructure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ dysonCode, Name of Datapoint, Description, datatype, writable, role, unit]
const datapoints = [
    ["fqhp" , "fqhp"                      , "Unknown"                                 										, "string", "false", "value"          		       ,"" ],
    ["fghp" , "fghp"                      , "Unknown"                                 										, "string", "false", "value"          		       ,"" ],
    ["ercd" , "LastErrorCode"             , "Errorcode of the last error occured on this device" 							, "string", "false", "value.error"        	       ,"" ],
    ["filf" , "FilterLife"                , "Estimated remaining filterlife in hours."  									, "string", "false", "value.lifetime"         , "hours"],
    ["fmod" , "Mode" 					  , "Mode of device"                                 								, "string", "false", "value"    		           ,"" ],
    ["fnsp" , "FanSpeed" 				  , "Current fanspeed"                                 							    , "number", "false", "value.fanspeed"  	           ,"" ],
    ["fnst" , "FanStatus"                 , "Current Fanstate"                                 							    , "string", "false", "state.fan"   		           ,"" ],
    ["nmod" , "Nightmode"                 , "Nightmode state"                                 								, "string", "false", "indicator.nightmode"         ,"" ],
    ["oson" , "Oscillation"               , "Oscillation of fan."                                 							, "string", "false", "state.oscillation"           ,"" ],
    ["qtar" , "AirQualityTarget"          , "Target Air quality for Auto Mode."                                             , "string", "false", "value"                       ,"" ],
    ["rhtm" , "ContiniousMonitoring"      , "Continious Monitoring by environmental sensors."                               , "string", "false", "state.continiousMonitoring"  ,"" ],
    ["wacd" , "wacd" 				 	  , "Unknown"                                                                       , "string", "false", "value"                       ,"" ],
    ["fpwr" , "MainPower" 		 		  , "Main Power of fan."                                							, "string", "false", "state.power"                 ,"" ],
    ["auto" , "AutomaticMode"             , "Fan is in automatic mode."                                 					, "string", "false", "state.automatic"   		   ,"" ],
    ["oscs" , "OscillationActive"         , "Fan is currently oscillating."                                 				, "string", "false", "indicator.oscillation"       ,"" ],
    ["nmdv" , "NightModeMaxFan"           , "Maximum fan speed in night mode."                                          	, "number", "false", "value"                       ,"" ],
    ["bril" , "bril"                      , "Unknown"                                 										, "string", "false", "value"                       ,"" ],
    ["corf" , "corf"                      , "Unknown"                                 										, "string", "false", "value"  		               ,"" ],
    ["cflr" , "Coalfilter"                , "Remaining lifetime of activated coalfilter."                                 	, "number", "false", "state.coalfilter" , "%"	   ,"" ],
    ["fdir" , "Fandirection"              , "Direction the fan blows to. ON=Front; OFF=Back"                                , "string", "false", "indicator.fandirection"      ,"" ],
    ["hflr" , "HEPA-Filter"               , "Remaining lifetime of HEPA-Filter."                                 			, "number", "false", "state.hepaFilter" , "%"      ,"" ],
    ["cflt" , "Carbonfilter"              , "Filtertype installed in carbonfilter port."                                 	, "string", "false", "value"                       ,"" ],
    ["hflt" , "HEPAfilter"                , "Filtertype installed in HEPA-filter port."                                 	, "string", "false", "value" 				       ,"" ],
    ["sltm" , "Sleeptimer"                , "Sleeptimer."                                 									, "string", "false", "indicator.sleeptimer"        ,"" ],
    ["osal" , "OscilationLeft"  		  , "Maximum oscillation to the left. Relative to Ancorpoint."                      , "number", "false", "value"                       ,"°"],
    ["osau" , "OscilationRight"  		  , "Maximum oscillation to the right. Relative to Ancorpoint."                     , "number", "false", "value"                       ,"°"],
    ["ancp" , "Ancorpoint" 				  , "Ancorpoint for oscillation. By default the dyson logo on the bottom plate."    , "number", "false", "value.ancor"                 ,"°"],
    ["rssi" , "RSSI"  		              , "Received Signal Strength Indication. Quality indicator for WIFI signal."       , "number", "false", "value.rssi"               ,"dBm" ],
    ["channel" , "WIFIchannel" 	          , "Number of the used WIFI channel."                                              , "number", "false", "value.wifiChannel"           ,"" ],
    ["pact" , "Dust"  		              , "Dust"                                      , "number", "false", "value.dust"        ,"" ],
    ["hact" , "Humidity"  		          , "Humidity"                                  , "number", "false", "value.humidity"    ,"%" ],
    ["sltm" , "Sleeptimer"  		      , "Sleeptimer"                                , "number", "false", "value.timer"       ,"Min" ],
    ["tact" , "Temperature"  		      , "Temperature"                               , "number", "false", "value.temperature" ,"" ],
    ["vact" , "VOC"  		              , "VOC - Volatil Organic Compounds"           , "number", "false", "value.voc"         ,"" ],
    ["pm25" , "PM25"  		              , "PM2.5 - Particulate Matter 2.5µm"          , "number", "false", "value.PM25"        ,"µg/m³" ],
    ["pm10" , "PM10"  		              , "PM10 - Particulate Matter 10µm"            , "number", "false", "value.PM10"        ,"µg/m³" ],
    ["va10" , "VOC"  		              , "VOC - Volatil Organic Compounds (inside)"  , "number", "false", "value.VOC"         ,"" ],
    ["noxl" , "NO2"  		              , "NO2 - Nitrogen dioxide (inside)"           , "number", "false", "value.NO2"         ,"" ],
    ["p25r" , "PM-R25"  		          , "PM-R2.5 - Particulate Matter 2.5µm"        , "number", "false", "value.PM25"        ,"µg/m³" ],
    ["p10r" , "PM-R10"  		          , "PM-R10 - Particulate Matter 10µm"          , "number", "false", "value.PM10"        ,"µg/m³" ]
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
        //this.on('objectChange', this.onObjectChange.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
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
            if (datapoints[row][0] === searchValue){
                this.log.debug("FOUND: " + datapoints[row]);
                return datapoints[row];
            }
        }
    }



    /*
     * Function CreateOrUpdateDevice
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
                    if (state  && state.val != '') {
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
                })
        } catch(error){
            this.log.error("[CreateOrUpdateDevice] Error: " + error + ", Callstack: " + error.stack);
        }
    }

    /*
     * Function processCurrentStateMsg
     *
     * @param device  {object} additional data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     * @param path    {string} Additional subfolders can be given here if needed with a leading dot (eg. .Sensor)!
     * @param message {object} Current State of the device. Message is send by device via mqtt due to request or state change.
     */
    async processMsg( device, path, message ) {
        for (let row in message){
            if ( row === "product-state"){
                this.processMsg(device, "", message[row]);
                continue;
            }
            if ( row === "data"){
                this.processMsg(device, ".Sensor", message[row]);

                // PM2.5 QualityIndex
                // 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremly Bad, >251 worrying
                let PM25Index = 'Good';
                if (message[row].pm25 < 36) {
                    PM25Index = 'Good';
                } else if (message[row].pm25 >= 36 && message[row].pm25 <= 53){
                    PM25Index = 'Medium';
                } else if (message[row].pm25 >= 54 && message[row].pm25 <= 70){
                    PM25Index = 'Bad';
                } else if (message[row].pm25 >= 71 && message[row].pm25 <= 150){
                    PM25Index = 'very Bad';
                } else if (message[row].pm25 >= 151 && message[row].pm25 <= 250){
                    PM25Index = 'extremly Bad';
                } else if (message[row].pm25 >= 251){
                    PM25Index = 'Worrying';
                }
                this.createOrExtendObject(device.Serial + '.Sensor.PM25Index', {
                    type: 'state',
                    common: {
                        name: 'PM2.5 QualityIndex. 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremly Bad, >251 worrying',
                        "read": true,
                        "write": false,
                        "role": "value",
                        "type": "string"
                    },
                    native: {}
                }, PM25Index);

                // PM10 QualityIndex
                // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying
                let PM10Index = 'Good';
                if (message[row].pm10 < 51) {
                    PM10Index = 'Good';
                } else if (message[row].pm10 >= 51 && message[row].pm10 <= 75){
                    PM10Index = 'Medium';
                } else if (message[row].pm10 >= 76 && message[row].pm10 <= 100){
                    PM10Index = 'Bad';
                } else if (message[row].pm10 >= 101 && message[row].pm10 <= 350){
                    PM10Index = 'very Bad';
                } else if (message[row].pm10 >= 351 && message[row].pm10 <= 420){
                    PM10Index = 'extremly Bad';
                } else if (message[row].pm10 >= 421){
                    PM10Index = 'Worrying';
                }
                this.createOrExtendObject(device.Serial + '.Sensor.PM10Index', {
                    type: 'state',
                    common: {
                        name: 'PM10 QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremly Bad, >421 worrying',
                        "read": true,
                        "write": false,
                        "role": "value",
                        "type": "string"
                    },
                    native: {}
                }, PM10Index);

                // VOC QualityIndex
                // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
                let VOCIndex = 'Good';
                if (message[row].voc < 4) {
                    VOCIndex = 'Good';
                } else if (message[row].voc >= 4 && message[row].voc <= 6){
                    VOCIndex = 'Medium';
                } else if (message[row].voc >= 7 && message[row].voc <= 8){
                    VOCIndex = 'Bad';
                } else if (message[row].voc >= 9){
                    VOCIndex = 'very Bad';
                }
                this.createOrExtendObject(device.Serial + '.Sensor.VOCIndex', {
                    type: 'state',
                    common: {
                        name: 'VOC QualityIndex. 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad',
                        "read": true,
                        "write": false,
                        "role": "value",
                        "type": "string"
                    },
                    native: {}
                }, VOCIndex);
                // NO2 QualityIndex
                // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
                let NO2Index = 'Good';
                if (message[row].no2 < 4) {
                    NO2Index = 'Good';
                } else if (message[row].no2 >= 4 && message[row].no2 <= 6){
                    NO2Index = 'Medium';
                } else if (message[row].no2 >= 7 && message[row].no2 <= 8){
                    NO2Index = 'Bad';
                } else if (message[row].no2 >= 9){
                    NO2Index = 'very Bad';
                }
                this.createOrExtendObject(device.Serial + '.Sensor.NO2Index', {
                    type: 'state',
                    common: {
                        name: 'NO2 QualityIndex. 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad',
                        "read": true,
                        "write": false,
                        "role": "value",
                        "type": "string"
                    },
                    native: {}
                }, NO2Index);

                continue;
            }
            const helper = await this.getDatapoint(row);
            if ( helper === undefined){
                this.log.info("Skipped creating datafield for: [" + row + "] Value: |-> " + ((typeof( message[row] ) === "object")? JSON.stringify(message[row]) : message[row]) );
                continue;
            }
            // strip leading zeros from numbers
            let value;
            if (helper[3]==="number"){
                // convert temperature to configured unit
                value = Number.parseInt(message[helper[0]], 10);
                if (helper[5] === "value.temperature") {
                    helper[6] = this.config.temperatureUnit;
                    switch (this.config.temperatureUnit) {
                        case 'K' : value /= 10;
                            break;
                        case 'C' :
                            value = Number((value/10) - 273.15).toFixed(2);
                            break;
                        case 'F' :
                            value = Number(((value/10) - 273.15) * (9/5) + 32).toFixed(2);
                            break;
                    }
                }
            } else {
                value = message[helper[0]];
            }
            this.createOrExtendObject( device.Serial + path + '.'+ helper[1], { type: 'state', common: {name: helper[2], "read":true, "write": helper[4]==true, "role": helper[5], "type":helper[3], "unit":helper[6] }, native: {} }, value );
        }
    }

    /*
    *  Main
    * It's the main routine of the adapter
    */
    async main() {
        function decryptMqttPasswd(response, LocalCredentials) {
            // Gets the MQTT credentials from the thisDevice (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
            const key = Uint8Array.from(Array(32), (_, index) => index + 1);
            const initializationVector = new Uint8Array(16);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
            const decryptedPasswordString = decipher.update(LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
            const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
            return decryptedPasswordJson.apPasswordHash;
        }

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
                })

            this.log.debug('Querying devices from dyson API.');
            let devices=[];
            await this.dysonGetDevicesFromApi(myAccount)
            .then( (response) => {
                for (let thisDevice in response.data) {
                    this.log.debug('Data received from dyson API: ' + JSON.stringify(response.data[thisDevice]));
                    // 1. create datapoints if device is supported
                    if (!supportedProductTypes.some(function (t) {
                        return t === response.data[thisDevice].ProductType;
                    })) {
                        this.log.info('Device with serial number [' + response.data[thisDevice].Serial + '] not added, hence it is not supported by this adapter. Product type: [' + response.data[thisDevice].ProductType + ']');
                        this.log.info('Please open an Issue on github if you think your device should be supported.');
                        continue;
                    } else {
                        // productType is supported: Push to Array and create in devicetree
                        response.data[thisDevice].hostAddress  = undefined;
                        response.data[thisDevice].mqttClient   = null;
                        response.data[thisDevice].mqttPassword =  decryptMqttPasswd(response, response.data[thisDevice].LocalCredentials);
                        devices.push(response.data[thisDevice]);
                    }
                }
            })
            .catch( (error) => {
                    this.log.error('[dysonGetDevicesFromApi] Error: ('+error.statuscode+')' + error + ', Callstack: ' + error.stack);
            })

            let updateIntervalHandle = null;
            // 2. Search Network for IP-Address of current thisDevice
            // 2a. Store IP-Address in additional persistant datafield
            // createOrUpdateDevice()
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
                            }
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT message received: ' + JSON.stringify(payload));
                        });

                        devices[thisDevice].mqttClient.on('error', function (error) {
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT error: ' + error);
                        });

                        devices[thisDevice].mqttClient.on('reconnect', function () {
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT reconnecting.');
                        });

                        devices[thisDevice].mqttClient.on('close', function () {
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT disconnected.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });

                        devices[thisDevice].mqttClient.on('offline', function () {
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT offline.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });

                        devices[thisDevice].mqttClient.on('end', function () {
                            adapter.log.debug(devices[thisDevice].Serial + ' - MQTT ended.');
                            if (updateIntervalHandle) {
                                clearInterval(updateIntervalHandle);
                                updateIntervalHandle = null;
                            }
                        });
                    })
                    .catch((error) => {
                        this.log.error(`[main/CreateOrUpdateDevice] error: ${error.message}, stack: ${error.stack}`);
                    });
            }
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
        new Promise(
            function(resolve, reject) {
                if (   (!config.email    || config.email === '')
                    || (!config.Password || config.Password === '')
                    || (!config.country  || config.country === '') ) {
                    reject('Given adapter config is invalid. Please fix.');
                } else
                    resolve('Given config seems to be valid. Please continue ...');
            });
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
                // configisValid! Now decrypt password
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
                self.log.debug('Updating existing object ' + id );
                self.extendObject(id, objData, callback);
            } else {
                self.log.debug('Creating new object ' + id );
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

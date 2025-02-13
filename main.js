// @ts-check
'use strict';

/**
 * Data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
 *
 * Serial Serial number of the device
 *
 * ProductType Product type of the device
 *
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop() || '';

// Load additional modules
const mqtt = require('mqtt');

// Load utils for this adapter
const dysonUtils = require('./dyson-utils.js');
const { getDatapoint, PRODUCTS, SPECIAL_PROPERTIES, getNameToDysoncodeTranslation } = require('./dysonConstants.js');
const { setInterval } = require('node:timers');

// Variable definitions
// let adapter = null;
let adapterIsSetUp = false;
let devices = [];
let VOC = 0; // Numeric representation of current VOCIndex
let PM25 = 0; // Numeric representation of current PM25Index
let PM10 = 0; // Numeric representation of current PM10Index
let Dust = 0; // Numeric representation of current DustIndex

/**
 *
 * @param number  The number to be clamped
 * @param min    The minimum value
 * @param max   The maximum value
 * @returns  The clamped number
 */
function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}

/**
 * Main class of dyson AirPurifier adapter for ioBroker
 */
class dysonAirPurifier extends utils.Adapter {
    /**
     * @param options - Adapter configuration
     */
    constructor(options = { temperatureUnit: 'C' }) {
        super({ ...options, name: adapterName });

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
     * @param msg - Message object containing all necessary data to request the needed information
     */
    async onMessage(msg) {
        if (!msg?.callback || !msg?.from?.startsWith('system.adapter.admin')) {
            return;
        }
        switch (msg.command) {
            case 'getDyson2faMail':
                this.log.debug('OnMessage: Received getDyson2faMail request.');
                msg.message.locale = dysonUtils.getDyson2faLocale(msg.message.country);
                try {
                    const response = await dysonUtils.getDyson2faMail(
                        this,
                        msg.message.email,
                        msg.message.password,
                        msg.message.country,
                        msg.message.locale,
                    );
                    this.sendTo(msg.from, msg.command, response, msg.callback);
                } catch (error) {
                    this.log.warn(`Couldn't handle getDyson2faMail message: ${error}`);
                    this.sendTo(msg.from, msg.command, { error: error || 'No data' }, msg.callback);
                }
                break;
            case 'getDysonToken':
                this.log.debug('OnMessage: getting Dyson-Token');
                try {
                    const response = await dysonUtils.getDysonToken(
                        this,
                        msg.message.email,
                        msg.message.password,
                        msg.message.country,
                        msg.message.challengeId,
                        msg.message.PIN,
                    );
                    this.sendTo(msg.from, msg.command, response, msg.callback);
                } catch (error) {
                    this.log.warn(`Couldn't handle getDysonToken message: ${error}`);
                    this.sendTo(msg.from, msg.command, { error: error || 'No data' }, msg.callback);
                }
                break;
            default:
                this.log.warn(`Unknown message: ${msg.command}`);
                break;
        }
    }

    /**
     * @param dysonAction - The action to be performed
     * @param messageValue  - The value to be set
     * @param id  - The id of the datapoint that was changed
     * @param state - The new state-object of the datapoint after change
     * @returns The message data
     */
    async #getMessageData(dysonAction, messageValue, id, state) {
        switch (dysonAction) {
            case 'fnsp': {
                // protect upper and lower speed limit of fan
                const value = parseInt(typeof messageValue === 'string' ? messageValue : messageValue.toString(), 10);
                const clamped = clamp(value, 1, 10);
                return { [dysonAction]: clamped.toString().padStart(4, '0') };
            }
            case 'hmax': {
                // Target temperature for heating in KELVIN!
                // convert temperature to configured unit
                let value = parseInt(typeof messageValue === 'string' ? messageValue : messageValue.toString(), 10);
                // @ts-expect-error - temperatureUnit is defined in the adapter configuration
                switch (this.config.temperatureUnit) {
                    case 'K':
                        value *= 10;
                        break;
                    case 'C':
                        value = Number((value + 273.15) * 10);
                        break;
                    case 'F':
                        value = Number((value - 32) * (9 / 5) + 273.15);
                        break;
                }
                return { [dysonAction]: value.toFixed(0).padStart(4, '0') };
            }
            case 'ancp':
            case 'osal':
            case 'osau':
                try {
                    const result = await dysonUtils.getAngles(this, dysonAction, id, state);
                    this.log.debug(`Result of getAngles: ${JSON.stringify(result)}`);
                    result.osal = parseInt(result.osal.val);
                    result.osau = parseInt(result.osau.val);
                    switch (result.ancp.val) {
                        case 'CUST':
                            result.ancp = result.osau - result.osal;
                            break;
                        case 'BRZE':
                            result.ancp = 'BRZE';
                            break;
                        default:
                            result.ancp = parseInt(result.ancp.val);
                    }
                    if (result.ancp === 'BRZE') {
                        return {
                            ['ancp']: 'BRZE',
                            ['oson']: 'ON',
                        };
                    }
                    this.log.debug(
                        `Result of parseInt(result.ancp.val): ${result.ancp}, typeof: ${typeof result.ancp}`,
                    );
                    if (result.osal + result.ancp > 355) {
                        result.osau = 355;
                        result.osal = 355 - result.ancp;
                    } else if (result.osau - result.ancp < 5) {
                        result.osal = 5;
                        result.osau = 5 + result.ancp;
                    } else {
                        result.osau = result.osal + result.ancp;
                    }
                    return {
                        ['osal']: dysonUtils.zeroFill(result.osal, 4),
                        ['osau']: dysonUtils.zeroFill(result.osau, 4),
                        //            ['ancp']: 'CUST',
                        ['ancp']: await this.getOscillationAngle(result.ancp),
                        ['oson']: 'ON',
                    };
                } catch (error) {
                    this.log.error('An error occurred while trying to retrieve the oscillation angles.');
                    throw error;
                }
            default:
                return {
                    [dysonAction]:
                        typeof messageValue === 'number' ? messageValue.toString().padStart(4, '0') : messageValue,
                };
        }
    }

    async getOscillationAngle(angle) {
        if (angle === 0) {
            return '0000';
        } else if (angle <= 45) {
            return '0045';
        } else if (angle > 45 && angle <= 90) {
            return '0090';
        } else if (angle > 180 && angle <= 270) {
            return '0180';
        } else if (angle > 270 && angle <= 355) {
            return '0350';
        }
    }

    /**
     * onStateChange
     *
     * Sends the control mqtt message to your device in case you changed a value
     *
     * @param id - id of the datapoint that was changed
     * @param state - new state-object of the datapoint after change
     */
    async onStateChange(id, state) {
        const thisDevice = id.split('.')[2];
        const action = id.split('.').pop();
        // Warning, state can be null if it was deleted

        if (!state || !action) {
            return;
        }

        // state changes by hardware or adapter depending on hardware values
        // check if it is an Index calculation
        if (state.ack) {
            if (!action.includes('Index')) {
                return;
            }
            // if some index has changed recalculate overall AirQuality
            this.createOrExtendObject(
                `${thisDevice}.AirQuality`,
                {
                    type: 'state',
                    common: {
                        name: 'Overall AirQuality (worst value of all indexes except NO2)',
                        read: true,
                        write: false,
                        role: 'value',
                        type: 'number',
                        states: {
                            0: 'Good',
                            1: 'Medium',
                            2: 'Bad',
                            3: 'very Bad',
                            4: 'extremely Bad',
                            5: 'worrying',
                        },
                    },
                    native: {},
                },
                Math.max(VOC, Dust, PM25, PM10),
            );
            return;
        }

        // if dysonAction is undefined it's an adapter internal action and has to be handled with the given Name
        // pick the dyson internal Action from the result row
        const dysonAction = getNameToDysoncodeTranslation(action);
        if (!dysonAction) {
            this.log.warn(`Unknown Dyson Action ${action}`);
            return;
        }
        // you can use the ack flag to detect if it is status (true) or command (false)
        // get the whole data field array
        const ActionData = getDatapoint(dysonAction);
        const value = state.val;
        let messageData = await this.#getMessageData(dysonAction, value, id, state);

        // TODO: refactor
        // switches defined as boolean must get the proper value to be send
        // this is to translate between the needed states for ioBroker and the device
        // boolean switches are better for visualizations and other adapters like text2command
        if (typeof ActionData !== 'undefined') {
            if (ActionData.type === 'boolean' && ActionData.role.startsWith('switch')) {
                // current state is TRUE!
                if (state.val) {
                    // handle special action "humidification" where ON is not ON but HUME
                    if (dysonAction === 'hume') {
                        messageData = { [dysonAction]: 'HUMD' };
                        // handle special action "HeatingMode" where ON is not ON but HEAT
                    } else if (dysonAction === 'hmod') {
                        messageData = { [dysonAction]: 'HEAT' };
                    } else {
                        messageData = { [dysonAction]: 'ON' };
                    }
                } else {
                    messageData = { [dysonAction]: 'OFF' };
                }
            }
        }
        // check whether fanspeed has been set to Auto
        if ('fnsp' === dysonAction && 11 === value) {
            messageData = { auto: 'ON' };
        }
        // only send to device if change should set a device value
        if (action === 'Hostaddress') {
            return;
        }
        // build the message to be sent to the device
        const message = {
            msg: 'STATE-SET',
            time: new Date().toISOString(),
            'mode-reason': 'LAPP',
            'state-reason': 'MODE',
            data: messageData,
        };
        for (const mqttDevice of devices) {
            if (mqttDevice.Serial === thisDevice) {
                this.log.debug(`MANUAL CHANGE: device [${thisDevice}] -> [${action}] -> [${state.val}], id: [${id}]`);
                this.log.debug(`SENDING this data to device (${thisDevice}): ${JSON.stringify(message)}`);
                await this.setState(id, state.val, true);
                mqttDevice.mqttClient.publish(
                    `${mqttDevice.ProductType}/${thisDevice}/command`,
                    JSON.stringify(message),
                );
                // refresh data with a delay of 250 ms to avoid 30 Sec gap
                setTimeout(() => {
                    this.log.debug(`requesting new state of device (${thisDevice}).`);
                    mqttDevice.mqttClient.publish(
                        `${mqttDevice.ProductType}/${thisDevice}/command`,
                        JSON.stringify({
                            msg: 'REQUEST-CURRENT-STATE',
                            time: new Date().toISOString(),
                        }),
                    );
                }, 100);
            }
        }
    }

    /**
     * CreateOrUpdateDevice
     *
     * Creates the base device information
     *
     * @param device - Data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     */
    async CreateOrUpdateDevice(device) {
        try {
            // create device folder
            //this.log.debug('Creating device folder.');
            this.createOrExtendObject(
                device.Serial,
                {
                    type: 'device',
                    common: {
                        name: PRODUCTS[device.ProductType].name,
                        icon: PRODUCTS[device.ProductType].icon,
                        type: 'string',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.Firmware`,
                {
                    type: 'channel',
                    common: {
                        name: 'Information on devices firmware',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.SystemState`,
                {
                    type: 'folder',
                    common: {
                        name: 'Information on devices system state (Filter, Water tank, ...)',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.SystemState.product-errors`,
                {
                    type: 'channel',
                    common: {
                        name: 'Information on devices product errors - false=No error, true=Failure',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.SystemState.product-warnings`,
                {
                    type: 'channel',
                    common: {
                        name: 'Information on devices product-warnings - false=No error, true=Failure',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.SystemState.module-errors`,
                {
                    type: 'channel',
                    common: {
                        name: 'Information on devices module-errors - false=No error, true=Failure',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.SystemState.module-warnings`,
                {
                    type: 'channel',
                    common: {
                        name: 'Information on devices module-warnings - false=No error, true=Failure',
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'value',
                    },
                    native: {},
                },
                null,
            );
            this.createOrExtendObject(
                `${device.Serial}.Firmware.Version`,
                {
                    type: 'state',
                    common: {
                        name: 'Current firmware version',
                        read: true,
                        write: false,
                        role: 'value',
                        type: 'string',
                    },
                    native: {},
                },
                device.Version,
            );
            this.createOrExtendObject(
                `${device.Serial}.Firmware.Autoupdate`,
                {
                    type: 'state',
                    common: {
                        name: "Shows whether the device updates it's firmware automatically if update is available.",
                        read: true,
                        write: true,
                        role: 'indicator',
                        type: 'boolean',
                    },
                    native: {},
                },
                device.AutoUpdate,
            );
            this.createOrExtendObject(
                `${device.Serial}.Firmware.NewVersionAvailable`,
                {
                    type: 'state',
                    common: {
                        name: 'Shows whether a firmware update for this device is available online.',
                        read: true,
                        write: false,
                        role: 'indicator',
                        type: 'boolean',
                    },
                    native: {},
                },
                device.NewVersionAvailable,
            );
            this.createOrExtendObject(
                `${device.Serial}.ProductType`,
                {
                    type: 'state',
                    common: {
                        name: 'dyson internal productType.',
                        read: true,
                        write: false,
                        role: 'value',
                        type: 'string',
                    },
                    native: {},
                },
                device.ProductType,
            );
            this.createOrExtendObject(
                `${device.Serial}.ConnectionType`,
                {
                    type: 'state',
                    common: {
                        name: 'Type of connection.',
                        read: true,
                        write: false,
                        role: 'value',
                        type: 'string',
                    },
                    native: {},
                },
                device.ConnectionType,
            );
            this.createOrExtendObject(
                `${device.Serial}.Name`,
                {
                    type: 'state',
                    common: {
                        name: 'Name of device.',
                        read: true,
                        write: true,
                        role: 'value',
                        type: 'string',
                    },
                    native: {},
                },
                device.Name,
            );
            this.log.debug(`Querying Host-Address of device: ${device.Serial}`);
            const hostAddress = await this.getStateAsync(`${device.Serial}.Hostaddress`);
            this.log.debug(`Got Host-Address-object [${JSON.stringify(hostAddress)}] for device: ${device.Serial}`);
            if (hostAddress?.val && typeof hostAddress.val === 'string') {
                this.log.debug(
                    `Found predefined Host-Address [${hostAddress.val}] for device: ${device.Serial} in object tree.`,
                );
                device.hostAddress = hostAddress.val;
                this.createOrExtendObject(
                    `${device.Serial}.Hostaddress`,
                    {
                        type: 'state',
                        common: {
                            name: 'Local host address (or IP) of device.',
                            read: true,
                            write: true,
                            role: 'value',
                            type: 'string',
                        },
                        native: {},
                    },
                    hostAddress.val,
                );
            } else {
                // No valid IP address of device found. Without we can't proceed. So terminate adapter.
                this.createOrExtendObject(
                    `${device.Serial}.Hostaddress`,
                    {
                        type: 'state',
                        common: {
                            name: 'Local host address (IP) of device.',
                            read: true,
                            write: true,
                            role: 'value',
                            type: 'string',
                        },
                        native: {},
                    },
                    '',
                );
            }
        } catch (error) {
            this.log.error(`[CreateOrUpdateDevice] Error: ${error}, Callstack: ${error.stack}`);
        }
    }

    /**
     * processMsg
     *
     * Processes the current received message and updates relevant data fields
     *
     * @param device  additional data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
     * @param path    Additional subfolders can be given here if needed with a leading dot (eg. .Sensor)!
     * @param message Current State of the device. Message is send by device via mqtt due to request or state change.
     */
    async processMsg(device, path, message) {
        for (const dysonCode in message) {
            // Is this a "product-state" message?
            if (dysonCode === 'product-state') {
                await this.processMsg(device, '', message[dysonCode]);
                return;
            }
            if (
                ['product-errors', 'product-warnings', 'module-errors', 'module-warnings'].includes(dysonCode)
                //row === 'product-errors' ||
                //row === 'product-warnings' ||
                //row === 'module-errors' ||
                //row === 'module-warnings'
            ) {
                await this.processMsg(device, `${path}.${dysonCode}`, message[dysonCode]);
            }
            // Is this a "data" message?
            if (dysonCode === 'data') {
                await this.processMsg(device, '.Sensor', message[dysonCode]);
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'p25r')) {
                    this.createPM25(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'p10r')) {
                    this.createPM10(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'pact')) {
                    this.createDust(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'vact')) {
                    this.createVOC(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'va10')) {
                    this.createVOC(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'noxl')) {
                    this.createNO2(message, dysonCode, device);
                }
                if (Object.prototype.hasOwnProperty.call(message[dysonCode], 'hchr')) {
                    this.createHCHO(message, dysonCode, device);
                }
                return;
            }
            // Handle all other message types
            //this.log.debug(`Processing item [${JSON.stringify(row)}] of Message: ${((typeof message === 'object')? JSON.stringify(message) : message)}` );
            const deviceConfig = getDatapoint(dysonCode);
            if (deviceConfig === undefined) {
                this.log.silly(
                    `Skipped creating unknown data field for Device:[${device.Serial}], Field: [${dysonCode}] Value:[${typeof message[dysonCode] === 'object' ? JSON.stringify(message[dysonCode]) : message[dysonCode]}]`,
                );
                continue;
            }
            if (deviceConfig.name === 'skip') {
                this.log.silly(
                    `Skipped creating known but unused data field for Device:[${device.Serial}], Field: [${dysonCode}] Value:[${typeof message[dysonCode] === 'object' ? JSON.stringify(message[dysonCode]) : message[dysonCode]}]`,
                );
                continue;
            }
            // this.setDysonCode(deviceConfig, dysonUtils.getFieldRewrite(deviceConfig[0]));
            // strip leading zeros from numbers
            let value;
            if (deviceConfig.type === 'number') {
                value = parseInt(message[dysonCode], 10);
                // TP02: When continuous monitoring is off and the fan is switched off - temperature and humidity loose their values.
                // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
                if (
                    dysonCode === 'rhtm' &&
                    message[dysonCode] === 'OFF' &&
                    // @ts-expect-error - keepValues is defined in the adapter configuration
                    this.config.keepValues
                ) {
                    continue;
                }
                // if field is sleep timer test for value OFF and remap it to a number
                if (dysonCode === 'sltm' && message[dysonCode] === 'OFF') {
                    value = 0;
                }
                // if field is fan speed test for value AUTO and remap it to a number
                if (dysonCode === 'fnsp' && message[dysonCode] === 'AUTO') {
                    value = 11;
                }
                if (dysonCode === 'filf') {
                    // create additional data field filterlifePercent converting value from hours to percent; 4300 is the estimated lifetime in hours by dyson
                    this.createOrExtendObject(
                        `${device.Serial + path}.FilterLifePercent`,
                        {
                            type: 'state',
                            common: {
                                name: deviceConfig.description,
                                read: true,
                                write: deviceConfig.writeable,
                                role: deviceConfig.role,
                                type: deviceConfig.type,
                                unit: '%',
                                states: deviceConfig.displayValues,
                            },
                            native: {},
                        },
                        Number((value * 100) / 4300),
                    );
                }
                if (dysonCode === 'vact' || dysonCode === 'va10' || dysonCode === 'noxl') {
                    value = Math.floor(value / 10);
                }
                if (dysonCode === 'hchr') {
                    value = value / 1000;
                }
            } else if (deviceConfig.role === 'value.temperature') {
                // TP02: When continuous monitoring is off and the fan ist switched off - temperature and humidity loose their values.
                // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
                if (
                    message[dysonCode] === 'OFF' &&
                    // @ts-expect-error - keepValues is defined in the adapter configuration
                    this.config.keepValues
                ) {
                    continue;
                }
                value = parseInt(message[dysonCode], 10);
                // convert temperature to configured unit
                // @ts-expect-error - temperatureUnit is defined in the adapter configuration
                switch (this.config.temperatureUnit) {
                    case 'K':
                        deviceConfig.unit = 'K';
                        value /= 10;
                        break;
                    case 'C':
                        deviceConfig.unit = '°C';
                        // OLD: deviceConfig[6] = '°' + this.config.temperatureUnit;
                        value = Number(value / 10 - 273.15).toFixed(2);
                        break;
                    case 'F':
                        deviceConfig.unit = '°F';
                        // OLD: deviceConfig[6] = '°' + this.config.temperatureUnit;
                        value = Number((value / 10 - 273.15) * (9 / 5) + 32).toFixed(2);
                        break;
                }
            } else if (deviceConfig.type === 'boolean' && deviceConfig.role.startsWith('switch')) {
                // testValue should be the 2nd value in an array or if it's no array, the value itself
                const testValue = typeof message[dysonCode] === 'object' ? message[dysonCode][1] : message[dysonCode];
                //this.log.debug(`${getDataPointName(deviceConfig)} is a bool switch. Current state: [${testValue}]`);
                value = ['ON', 'HUMD', 'HEAT'].includes(testValue); //  testValue === 'ON' || testValue === 'HUMD' || testValue === 'HEAT';
            } else if (deviceConfig.type === 'boolean' && deviceConfig.role.startsWith('indicator')) {
                // testValue should be the 2nd value in an array or if it's no array, the value itself
                const testValue = typeof message[dysonCode] === 'object' ? message[dysonCode][1] : message[dysonCode];
                this.log.silly(
                    `${deviceConfig.name} is a bool switch. Current state: [${testValue}] --> returnvalue for further processing: ${testValue === 'FAIL'}`,
                );
                value = testValue === 'FAIL';
            } else {
                // It's no bool switch
                value = message[dysonCode];
            }
            // during state-change message only changed values are being updated
            if (typeof value === 'object') {
                if (value[0] === value[1]) {
                    this.log.debug(`Values for [${deviceConfig.name}] are equal. No update required. Skipping.`);
                    continue;
                } else {
                    value = value[1].valueOf();
                }
                this.log.debug(
                    `Value is an object. Converting to value: [${JSON.stringify(value)}] --> [${value.valueOf()}]`,
                );
                value = value.valueOf();
            }
            this.createOrExtendObject(
                `${device.Serial + path}.${deviceConfig.name}`,
                {
                    type: 'state',
                    common: {
                        name: deviceConfig.description,
                        read: true,
                        write: deviceConfig.writeable,
                        role: deviceConfig.role,
                        type: deviceConfig.type,
                        unit: deviceConfig.unit,
                        states: !deviceConfig.displayValues
                            ? undefined
                            : SPECIAL_PROPERTIES.has(dysonCode)
                              ? PRODUCTS[device.ProductType][dysonCode]
                              : deviceConfig.displayValues,
                    },
                    native: {},
                },
                value,
            );
            // getWriteable(deviceConfig)=true -> data field is editable, so subscribe for state changes
            if (deviceConfig.writeable) {
                //this.log.debug('Subscribing for state changes on datapoint: ' + device.Serial + path + '.'+ deviceConfig.name );
                this.subscribeStates(`${device.Serial + path}.${deviceConfig.name}`);
            }
        }
    }

    /**
     * createNO2
     *
     * creates the data fields for the values itself and the index if the device has a NO2 sensor
     *
     * @param message the received mqtt message
     * @param message[].noxl  the NO2 value
     * @param row      the current data row
     * @param device   the device object the data is valid for
     */
    createNO2(message, row, device) {
        // NO2 QualityIndex
        // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
        let NO2Index = 0;
        const value = Math.floor(message[row].noxl / 10);
        if (value < 4) {
            NO2Index = 0;
        } else if (value >= 4 && value <= 6) {
            NO2Index = 1;
        } else if (value >= 7 && value <= 8) {
            NO2Index = 2;
        } else if (value >= 9) {
            NO2Index = 3;
        }
        this.createOrExtendObject(
            `${device.Serial}.Sensor.NO2Index`,
            {
                type: 'state',
                common: {
                    name: 'NO2 QualityIndex. 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            NO2Index,
        );
        this.subscribeStates(`${device.Serial}.Sensor.NO2Index`);
    }

    /**
     * createHCHO
     *
     * creates the data fields for the values itself and the index if the device has a HCHO sensor
     *
     * @param message  the received mqtt message
     * @param message[].noxl the NO2 value
     * @param row      the current data row
     * @param device   the device object the data is valid for
     */
    createHCHO(message, row, device) {
        // HCHO QualityIndex
        // 0-3: Good, 4-6: Medium, 7-8, Bad, >9: very Bad
        let HCHOIndex = 0;
        const value = message[row].hchr / 1000;
        if (value >= 0 && value < 0.1) {
            HCHOIndex = 0;
        } else if (value >= 0.1 && value < 0.3) {
            HCHOIndex = 1;
        } else if (value >= 0.3 && value < 0.5) {
            HCHOIndex = 2;
        } else if (value >= 0.5) {
            HCHOIndex = 3;
        }
        this.createOrExtendObject(
            `${device.Serial}.Sensor.HCHOIndex`,
            {
                type: 'state',
                common: {
                    name: 'HCHO QualityIndex. 0 - 0.099: Good, 0.100 - 0.299: Medium, 0.300 - 0.499, Bad, >0.500: very Bad',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            HCHOIndex,
        );
        this.subscribeStates(`${device.Serial}.Sensor.HCHOIndex`);
    }

    /**
     * createVOC
     *
     * creates the data fields for the values itself and the index if the device has a VOC sensor
     *
     * @param message the received mqtt message
     * @param message[].va10  the VOC value
     * @param row      the current data row
     * @param device   the device object the data is valid for
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
        this.createOrExtendObject(
            `${device.Serial}.Sensor.VOCIndex`,
            {
                type: 'state',
                common: {
                    name: 'VOC QualityIndex. 0-3: Good, 4-6: Medium, 7-9: Bad, >9: very Bad',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            VOCIndex,
        );
        VOC = VOCIndex;
        this.subscribeStates(`${device.Serial}.Sensor.VOCIndex`);
    }

    /**
     * createPM10
     *
     * creates the data fields for the values itself and the index if the device has a PM 10 sensor
     *
     * @param message the received mqtt message
     * @param message[].pm10 the PM10 value
     * @param row the current data row
     * @param device the device object the data is valid for
     */
    createPM10(message, row, device) {
        // PM10 QualityIndex
        // 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying
        let PM10Index = 0;
        if (message[row].p10r < 51) {
            PM10Index = 0;
        } else if (message[row].p10r >= 51 && message[row].p10r <= 75) {
            PM10Index = 1;
        } else if (message[row].p10r >= 76 && message[row].p10r <= 100) {
            PM10Index = 2;
        } else if (message[row].p10r >= 101 && message[row].p10r <= 350) {
            PM10Index = 3;
        } else if (message[row].p10r >= 351 && message[row].p10r <= 420) {
            PM10Index = 4;
        } else if (message[row].p10r >= 421) {
            PM10Index = 5;
        }
        this.createOrExtendObject(
            `${device.Serial}.Sensor.PM10Index`,
            {
                type: 'state',
                common: {
                    name: 'PM10 QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            PM10Index,
        );
        PM10 = PM10Index;
        this.subscribeStates(`${device.Serial}.Sensor.PM10Index`);
    }

    /**
     * createDust
     *
     * creates the data fields for the values itself and the index if the device has a simple dust sensor
     *
     * @param message the received mqtt message
     * @param message[].pact the dust value
     * @param row      the current data row
     * @param device   the device object the data is valid for
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
            dustIndex = 3;
        } else if (message[row].pact >= 351 && message[row].pact <= 420) {
            dustIndex = 4;
        } else if (message[row].pact >= 421) {
            dustIndex = 5;
        }
        this.createOrExtendObject(
            `${device.Serial}.Sensor.DustIndex`,
            {
                type: 'state',
                common: {
                    name: 'Dust QualityIndex. 0-50: Good, 51-75: Medium, 76-100, Bad, 101-350: very Bad, 351-420: extremely Bad, >421 worrying',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            dustIndex,
        );
        Dust = dustIndex;
        this.subscribeStates(`${device.Serial}.Sensor.DustIndex`);
    }

    /**
     * createPM25
     *
     * creates the data fields for the values itself and the index if the device has a PM 2,5 sensor
     *
     * @param message the received mqtt message
     * @param message[].p25r the PM2.5 value
     * @param row      the current data row
     * @param device   the device object the data is valid for
     */
    createPM25(message, row, device) {
        // PM2.5 QualityIndex
        // 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremely Bad, >251 worrying
        let PM25Index = 0;
        if (message[row].p25r < 36) {
            PM25Index = 0;
        } else if (message[row].p25r >= 36 && message[row].p25r <= 53) {
            PM25Index = 1;
        } else if (message[row].p25r >= 54 && message[row].p25r <= 70) {
            PM25Index = 2;
        } else if (message[row].p25r >= 71 && message[row].p25r <= 150) {
            PM25Index = 3;
        } else if (message[row].p25r >= 151 && message[row].p25r <= 250) {
            PM25Index = 4;
        } else if (message[row].p25r >= 251) {
            PM25Index = 5;
        }
        this.createOrExtendObject(
            `${device.Serial}.Sensor.PM25Index`,
            {
                type: 'state',
                common: {
                    name: 'PM2.5 QualityIndex. 0-35: Good, 36-53: Medium, 54-70: Bad, 71-150: very Bad, 151-250: extremely Bad, >251 worrying',
                    read: true,
                    write: false,
                    role: 'value',
                    type: 'number',
                    states: {
                        0: 'Good',
                        1: 'Medium',
                        2: 'Bad',
                        3: 'very Bad',
                        4: 'extremely Bad',
                        5: 'worrying',
                    },
                },
                native: {},
            },
            PM25Index,
        );
        PM25 = PM25Index;
        this.subscribeStates(`${device.Serial}.Sensor.PM25Index`);
    }

    /**
     *
     * @param thisDevice {Object} link to the current Device object
     * @param adapterLog {Object} link to the adapters log output
     * @param reason     {string} the reason why this function is called (for logging purposes)
     */
    async pollDeviceInfo(thisDevice, adapterLog, reason) {
        adapterLog.debug(`Updating device [${thisDevice.Serial}] (polling API ${reason}).`);
        try {
            // possible messages:
            // msg: 'REQUEST-CURRENT-STATE'
            // msg: 'REQUEST-PRODUCT-ENVIRONMENT-CURRENT-SENSOR-DATA'
            // msg: 'REQUEST-CURRENT-FAULTS'
            thisDevice.mqttClient.publish(
                `${thisDevice.ProductType}/${thisDevice.Serial}/command`,
                JSON.stringify({
                    msg: 'REQUEST-CURRENT-STATE',
                    time: new Date().toISOString(),
                }),
            );
            thisDevice.mqttClient.publish(
                `${thisDevice.ProductType}/${thisDevice.Serial}/command`,
                JSON.stringify({
                    msg: 'REQUEST-CURRENT-FAULTS',
                    time: new Date().toISOString(),
                }),
            );
            thisDevice.mqttClient.publish(
                `${thisDevice.ProductType}/${thisDevice.Serial}/command`,
                JSON.stringify({
                    msg: 'REQUEST-PRODUCT-ENVIRONMENT-CURRENT-SENSOR-DATA',
                    time: new Date().toISOString(),
                }),
            );
        } catch (error) {
            adapterLog.error(`${thisDevice.Serial} - MQTT interval error: ${error}`);
        }
    }

    /**
     * main
     *
     * It's the main routine of the adapter
     */
    async main() {
        const adapterLog = this.log;
        // @ts-expect-error - devices is defined in the global scope
        if (!this.config.token) {
            return;
        }
        try {
            adapterLog.info('Querying devices from dyson API.');
            // @ts-expect-error - devices is defined in the global scope
            devices = await dysonUtils.getDevices(this.config.token, this);
            if (typeof devices != 'undefined') {
                for (const thisDevice of devices) {
                    // delete deprecated fields from device tree
                    await this.CreateOrUpdateDevice(thisDevice);
                    await dysonUtils.deleteUnusedFields(this, `${this.name}.${this.instance}.${thisDevice.Serial}`);
                    // Initializes the MQTT client for local communication with the thisDevice
                    this.log.debug(`Result of CreateOrUpdateDevice: [${JSON.stringify(thisDevice)}]`);
                    await this.getIPofDevice(thisDevice);
                    // subscribe to changes on host address to re-init adapter on changes
                    this.log.debug(`Subscribing for state changes on datapoint: ${thisDevice.Serial}.hostAddress`);
                    this.subscribeStates(`${thisDevice.Serial}.hostAddress`);
                    // connect to device
                    adapterLog.info(
                        `${thisDevice.Serial} - MQTT connection requested for [${thisDevice.hostAddress}${thisDevice.ipAddress ? `@${thisDevice.ipAddress}` : ''}].`,
                    );
                    thisDevice.mqttClient = mqtt.connect(`mqtt://${thisDevice.hostAddress}`, {
                        username: thisDevice.Serial,
                        password: thisDevice.mqttPassword,
                        protocolVersion: 3,
                        protocolId: 'MQIsdp',
                    });
                    /*******************************************************
                     * Subscribe to MQTT events
                     *******************************************************/
                    /****************
                     * Connect
                     ****************/
                    thisDevice.mqttClient.on('connect', async () => {
                        adapterLog.info(`${thisDevice.Serial} - MQTT connection established.`);
                        this.setDeviceOnlineState(thisDevice.Serial, 'online');
                        // Subscribes to the status topic to receive updates
                        thisDevice.mqttClient.subscribe(
                            `${thisDevice.ProductType}/${thisDevice.Serial}/status/current`,
                            function (err) {
                                if (!err) {
                                    adapterLog.debug(`Subscribed to current state of device ${thisDevice.Serial}.`);
                                } else {
                                    adapterLog.warn(`${thisDevice.Serial}: ${err}`);
                                }
                            },
                        );
                        // Sends an initial request for current state of device
                        await this.pollDeviceInfo(thisDevice, adapterLog, 'initially');
                        // expect the adapter 20 seconds after first poll as Set-up
                        setTimeout(() => {
                            adapterIsSetUp = true;
                            adapterLog.debug(
                                `Device [${thisDevice.Serial}] is now set-up and config of datapoints is frozen.`,
                            );
                        }, 20000);
                        // Subscribes to the "faults" topic to receive updates on any faults and warnings
                        thisDevice.mqttClient.subscribe(
                            `${thisDevice.ProductType}/${thisDevice.Serial}/status/faults`,
                            function (err) {
                                if (!err) {
                                    adapterLog.debug(`Subscribed to faults of device ${thisDevice.Serial}.`);
                                } else {
                                    adapterLog.warn(`${thisDevice.Serial}: ${err}`);
                                }
                            },
                        );
                        // Subscribes to the software topic to receive updates on any faults and warnings
                        thisDevice.mqttClient.subscribe(
                            `${thisDevice.ProductType}/${thisDevice.Serial}/status/software`,
                            function (err) {
                                if (!err) {
                                    adapterLog.debug(`Subscribed to software state of device ${thisDevice.Serial}.`);
                                } else {
                                    adapterLog.warn(`${thisDevice.Serial}: ${err}`);
                                }
                            },
                        );
                        // Subscribes to the connection topic to receive updates on any faults and warnings
                        thisDevice.mqttClient.subscribe(
                            `${thisDevice.ProductType}/${thisDevice.Serial}/status/connection`,
                            function (err) {
                                if (!err) {
                                    adapterLog.debug(`Subscribed to connection state of device ${thisDevice.Serial}.`);
                                } else {
                                    adapterLog.warn(`${thisDevice.Serial}: ${err}`);
                                }
                            },
                        );
                        // Sets the interval for status updates
                        // start refresh scheduler with interval from adapters config
                        if (this.config.pollInterval > 0) {
                            adapterLog.info(
                                `Starting Polltimer with a ${this.config.pollInterval} seconds interval for device ${thisDevice.Serial}.`,
                            );
                            thisDevice.updateIntervalHandle = setInterval(() => {
                                this.pollDeviceInfo(thisDevice, adapterLog, '@ regular schedule');
                            }, this.config.pollInterval * 1000);
                            /*
              thisDevice.updateIntervalHandle = setTimeout(function schedule(){
                adapter.pollDeviceInfo(thisDevice, adapterLog, '@ regular schedule');
                thisDevice.updateIntervalHandle = setTimeout(schedule, adapter.config.pollInterval * 1000);
              }, adapter.config.pollInterval * 1000);

               */
                        } else {
                            adapterLog.info(`Disabled scheduled polling for device ${thisDevice.Serial}`);
                        }
                    });
                    /****************
                     * Message
                     ****************/
                    thisDevice.mqttClient.on('message', async (_, payloadBuffer) => {
                        // change dataType from Buffer to JSON object
                        const payload = JSON.parse(payloadBuffer.toString());
                        adapterLog.debug(`MessageType: ${payload.msg}`);
                        switch (payload.msg) {
                            case 'STATE-CHANGE':
                            case 'CURRENT-STATE':
                                await this.processMsg(thisDevice, '', payload);
                                break;
                            case 'CURRENT-FAULTS':
                                await this.processMsg(thisDevice, '.SystemState', payload);
                                break;
                            case 'ENVIRONMENTAL-CURRENT-SENSOR-DATA':
                                this.createOrExtendObject(
                                    `${thisDevice.Serial}.Sensor`,
                                    {
                                        type: 'channel',
                                        common: {
                                            name: "Information from device's sensors",
                                            type: 'folder',
                                            read: true,
                                            write: false,
                                        },
                                        native: {},
                                    },
                                    null,
                                );
                                await this.processMsg(thisDevice, '.Sensor', payload);
                                break;
                        }
                        adapterLog.debug(`${thisDevice.Serial} - MQTT message received: ${JSON.stringify(payload)}`);
                    });
                    /****************
                     * Error
                     ****************/
                    thisDevice.mqttClient.on('error', error => {
                        adapterLog.debug(`${thisDevice.Serial} - MQTT error: ${error}`);
                        this.setDeviceOnlineState(thisDevice.Serial, 'error');
                    });
                    /****************
                     * Re-Connect
                     ****************/
                    thisDevice.mqttClient.on('reconnect', () => {
                        // @ts-expect-error - disableReconnectLogging is defined in the adapter configuration
                        if (!this.config.disableReconnectLogging) {
                            adapterLog.info(`${thisDevice.Serial} - MQTT reconnecting.`);
                        }
                        this.setDeviceOnlineState(thisDevice.Serial, 'reconnect');
                    });
                    /****************
                     * Close
                     ****************/
                    thisDevice.mqttClient.on('close', () => {
                        // @ts-expect-error - disableReconnectLogging is defined in the adapter configuration
                        if (!this.config.disableReconnectLogging) {
                            adapterLog.info(`${thisDevice.Serial} - MQTT disconnected.`);
                        }
                        this.clearIntervalHandle(thisDevice.updateIntervalHandle);
                        this.setDeviceOnlineState(thisDevice.Serial, 'disconnected');
                    });
                    /****************
                     * Offline
                     ****************/
                    thisDevice.mqttClient.on('offline', () => {
                        adapterLog.info(`${thisDevice.Serial} - MQTT offline.`);
                        this.clearIntervalHandle(thisDevice.updateIntervalHandle);
                        this.setDeviceOnlineState(thisDevice.Serial, 'offline');
                    });
                    /****************
                     * End
                     ****************/
                    thisDevice.mqttClient.on('end', () => {
                        adapterLog.debug(`${thisDevice.Serial} - MQTT ended.`);
                        this.clearIntervalHandle(thisDevice.updateIntervalHandle);
                    });
                }
            } else {
                adapterLog.error(
                    `Unable to retrieve data from dyson servers. May be e.g. a failed login or connection issues. Please check.`,
                );
            }
        } catch (error) {
            await this.setState('info.connection', false, true);
            adapterLog.error(
                `[main] Error while querying devices from dyson servers. The most common issue is that you haven't finished the 2FA process. Please refer to the ReadMe for instructions.`,
            );
            adapterLog.error(`[main] error: ${error}, stack: ${error.stack}`);
        }
    }

    /**
     * check whether there is a DNS that resolves the hostname
     *
     * @param thisDevice link to the object of the device
     */
    async getIPofDevice(thisDevice) {
        // todo not all DNS work with the same name structure e.g. fritzbox, bind9, pihole
        // use iterations if there is no result by DNS request:
        // 1. keep name like it is
        // 2. replace underscores (if existent) by dashes (-)
        // 4. replace dashes      (if existent) by underscores (_)
        if (
            !thisDevice.hostAddress ||
            thisDevice.hostAddress === '' ||
            thisDevice.hostAddress === 'undefined' ||
            typeof thisDevice.hostAddress === 'undefined'
        ) {
            this.log.info(
                `No host address given. Trying to connect to the device with it's default hostname [${thisDevice.Serial}]. This should work if you haven't changed it and if you're running a DNS.`,
            );
            thisDevice.hostAddress = thisDevice.Serial;
            try {
                thisDevice.ipAddress = await dysonUtils.getFanIP(this, thisDevice.Serial);
            } catch (err) {
                this.log.error(err);
            }
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
        try {
            await dysonUtils.checkAdapterConfig(this);
            await this.main();
        } catch (error) {
            this.log.warn(
                `This adapter has no or no valid configuration. Starting anyway to give you the opportunity to configure it properly. ${error}`,
            );
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
     * @param device  path to the device incl. Serial
     * @param state   state to set (online, offline, reconnecting, ...)
     */
    async setDeviceOnlineState(device, state) {
        this.createOrExtendObject(
            `${device}.Online`,
            {
                type: 'state',
                common: {
                    name: 'Indicator whether device is online or offline.',
                    read: true,
                    write: false,
                    role: 'indicator.reachable',
                    type: 'boolean',
                },
                native: {},
            },
            state === 'online',
        );
        this.setState('info.connection', state === 'online', true);
    }

    /**
     * Function Create or extend object
     *
     * Updates an existing object (id) or creates it if not existing.
     *
     * @param id  path/id of datapoint to create
     * @param objData  details to the datapoint to be created (Device, channel, state, ...)
     * @param value  value of the datapoint
     */
    createOrExtendObject(id, objData, value) {
        if (adapterIsSetUp) {
            this.setState(id, value, true);
        } else {
            this.getObject(id, (err, oldObj) => {
                if (!err && oldObj) {
                    //self.log.debug('Updating existing object [' + id +'] with value: ['+ value+']');
                    this.extendObject(id, objData, () => {
                        this.setState(id, value, true);
                    });
                } else {
                    //self.log.debug('Creating new object [' + id +'] with value: ['+ value+']');
                    this.setObjectNotExists(id, objData, () => {
                        this.setState(id, value, true);
                    });
                }
            });
        }
    }

    /**
     * Function clearIntervalHandle
     *
     * sets an intervalHandle (timeoutHandle) to null if it's existing to clear it
     *
     * @param updateIntervalHandle timeOutHandle to be checked and cleared
     */
    clearIntervalHandle(updateIntervalHandle) {
        clearTimeout(updateIntervalHandle);
    }

    /**
     * Exit adapter
     *
     * @param callback  callback function to be called after clean-up
     */
    async onUnload(callback) {
        try {
            for (const DEVICE in devices) {
                const thisDevice = devices[DEVICE];
                clearInterval(thisDevice.updateIntervalHandle);
                this.log.info(`Cleaned up timeout for ${thisDevice.Serial}.`);
                await this.setDeviceOnlineState(thisDevice.Serial, 'offline');
                this.log.debug(`Set device ${thisDevice.Serial} to offline.`);
                // todo unsubscribe to any subscribes
            }
            this.setState('info.connection', false, true);
            this.log.info('Cleaned up everything...');
            callback();
        } catch (e) {
            this.log.error(`Error onUnload: ${e}`);
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param options {object} options
     */
    module.exports = options => new dysonAirPurifier(options);
} else {
    // otherwise start the instance directly
    new dysonAirPurifier();
}

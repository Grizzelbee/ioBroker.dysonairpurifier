// @ts-check
'use strict';

/**
 * @typedef {Object} StateChangeObject
 * @property {boolean} ack
 * @property {string} val
 */

/**
 * @typedef {Partial<utils.AdapterOptions> & {temperatureUnit: 'K' | 'C' | 'F'}} dysonOptions
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop() || '';

// Load additional modules
const mqtt = require('mqtt');

// Load utils for this adapter
const dysonUtils = require('./dyson-utils.js');
const dysonConstants = require('./dysonConstants.js');

// Variable definitions
let adapter = null;
let adapterIsSetUp = false;
let devices = {};
let VOC = 0; // Numeric representation of current VOCIndex
let PM25 = 0; // Numeric representation of current PM25Index
let PM10 = 0; // Numeric representation of current PM10Index
let Dust = 0; // Numeric representation of current DustIndex

/**
 *
 * @param {number} number
 * @param {number} min
 * @param {number} max
 * @returns
 */
function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

/**
 * Main class of dyson AirPurifier adapter for ioBroker
 */
class dysonAirPurifier extends utils.Adapter {
  /**
   * @param {dysonOptions} options
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
   * @param {Object} msg - Message object containing all necessary data to request the needed information
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
            msg.message.locale
          );
          this.sendTo(msg.from, msg.command, response, msg.callback);
        } catch (error) {
          adapter.log.warn(`Couldn't handle getDyson2faMail message: ${error}`);
          adapter.sendTo(
            msg.from,
            msg.command,
            { error: error || 'No data' },
            msg.callback
          );
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
            msg.message.PIN
          );
          this.sendTo(msg.from, msg.command, response, msg.callback);
        } catch (error) {
          adapter.log.warn(`Couldn't handle getDysonToken message: ${error}`);
          adapter.sendTo(
            msg.from,
            msg.command,
            { error: error || 'No data' },
            msg.callback
          );
        }
        break;
      default:
        adapter.log.warn(`Unknown message: ${msg.command}`);
        break;
    }
  }

  /**
   * @param {string} dysonAction
   * @param {string | number} messageValue
   * @param {string} id
   * @param {any} state
   * @returns {Promise<Record<string, any>>}
   */
  async #getMessageData(dysonAction, messageValue, id, state) {
    switch (dysonAction) {
      case 'fnsp': {
        // protect upper and lower speed limit of fan
        const value = parseInt(
          typeof messageValue === 'string'
            ? messageValue
            : messageValue.toString(),
          10
        );
        const clamped = clamp(value, 1, 10);
        return { [dysonAction]: clamped.toString().padStart(4, '0') };
      }
      case 'hmax': {
        // Target temperature for heating in KELVIN!
        // convert temperature to configured unit
        let value = parseInt(
          typeof messageValue === 'string'
            ? messageValue
            : messageValue.toString(),
          10
        );
        // @ts-ignore
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
          const result = await dysonUtils.getAngles(
            this,
            dysonAction,
            id,
            state
          );
          this.log.debug(`Result of getAngles: ${JSON.stringify(result)}`);
          switch (result.ancp.val) {
            case 'CUST':
              result.ancp = 90;
              break;
            case 'BRZE':
              result.ancp = 'BRZE';
              break;
            default:
              result.ancp = parseInt(result.ancp.val);
          }
          if (result.ancp === 'BRZE') {
            return {
              //['osal']: '0180',
              //['osau']: '0180',
              ['ancp']: 'BRZE',
              ['oson']: 'ON'
            };
          }
          this.log.debug(
            `Result of parseInt(result.ancp.val): ${result.ancp}, typeof: ${typeof result.ancp}`
          );
          result.osal = parseInt(result.osal.val);
          result.osau = parseInt(result.osau.val);
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
            ['ancp']: 'CUST',
            ['oson']: 'ON'
          };
        } catch (error) {
          this.log.error(
            'An error occurred while trying to retrieve the oscillation angles.'
          );
          throw error;
        }
      default:
        return {
          [dysonAction]:
            typeof messageValue === 'number'
              ? messageValue.toString().padStart(4, '0')
              : messageValue
        };
    }
  }

  /**
   * onStateChange
   *
   * Sends the control mqtt message to your device in case you changed a value
   *
   * @param {string} id - id of the datapoint that was changed
   * @param {StateChangeObject | undefined} state - new state-object of the datapoint after change
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
              5: 'worrying'
            }
          },
          native: {}
        },
        Math.max(VOC, Dust, PM25, PM10)
      );
      return;
    }

    // you can use the ack flag to detect if it is status (true) or command (false)
    // get the whole data field array
    const ActionData = await this.getDatapoint(action);
    // if dysonAction is undefined it's an adapter internal action and has to be handled with the given Name
    // pick the dyson internal Action from the result row
    const dysonAction = ActionData?.[0] ?? action;
    this.log.debug(`onStateChange: Using dysonAction: [${dysonAction}]`);
    const value = state.val;
    let messageData = await this.#getMessageData(dysonAction, value, id, state);

    // TODO: refactor
    // switches defined as boolean must get the proper value to be send
    // this is to translate between the needed states for ioBroker and the device
    // boolean switches are better for visualizations and other adapters like text2command
    if (typeof ActionData !== 'undefined') {
      if (ActionData[3] === 'boolean' && ActionData[5].startsWith('switch')) {
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
      data: messageData
    };
    for (const mqttDevice in devices) {
      if (devices[mqttDevice].Serial === thisDevice) {
        this.log.debug(
          `MANUAL CHANGE: device [${thisDevice}] -> [${action}] -> [${state.val}], id: [${id}]`
        );
        this.log.debug(
          `SENDING this data to device (${thisDevice}): ${JSON.stringify(message)}`
        );
        await this.setState(id, state.val, true);
        devices[mqttDevice].mqttClient.publish(
          `${devices[mqttDevice].ProductType}/${thisDevice}/command`,
          JSON.stringify(message)
        );
        // refresh data with a delay of 250 ms to avoid 30 Sec gap
        setTimeout(() => {
          this.log.debug(`requesting new state of device (${thisDevice}).`);
          devices[mqttDevice].mqttClient.publish(
            `${devices[mqttDevice].ProductType}/${thisDevice}/command`,
            JSON.stringify({
              msg: 'REQUEST-CURRENT-STATE',
              time: new Date().toISOString()
            })
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
   * @param {Object} device data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
   * @param {string} device.Serial Serial number of the device
   * @param {string} device.ProductType Product type of the device
   * @param {string} device.Version
   * @param {string} device.AutoUpdate
   * @param {string} device.NewVersionAvailable
   * @param {string} device.ConnectionType
   * @param {string} device.Name
   * @param {string} device.hostAddress
   */
  async CreateOrUpdateDevice(device) {
    try {
      // create device folder
      //this.log.debug('Creating device folder.');
      await this.createOrExtendObject(
        device.Serial,
        {
          type: 'device',
          common: {
            name: dysonConstants.PRODUCTS[device.ProductType].name,
            icon: dysonConstants.PRODUCTS[device.ProductType].icon,
            type: 'string'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.Firmware`,
        {
          type: 'channel',
          common: {
            name: 'Information on devices firmware',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.SystemState`,
        {
          type: 'folder',
          common: {
            name: 'Information on devices system state (Filter, Water tank, ...)',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.SystemState.product-errors`,
        {
          type: 'channel',
          common: {
            name: 'Information on devices product errors - false=No error, true=Failure',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.SystemState.product-warnings`,
        {
          type: 'channel',
          common: {
            name: 'Information on devices product-warnings - false=No error, true=Failure',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.SystemState.module-errors`,
        {
          type: 'channel',
          common: {
            name: 'Information on devices module-errors - false=No error, true=Failure',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.SystemState.module-warnings`,
        {
          type: 'channel',
          common: {
            name: 'Information on devices module-warnings - false=No error, true=Failure',
            read: true,
            write: false,
            type: 'string',
            role: 'value'
          },
          native: {}
        },
        null
      );
      await this.createOrExtendObject(
        `${device.Serial}.Firmware.Version`,
        {
          type: 'state',
          common: {
            name: 'Current firmware version',
            read: true,
            write: false,
            role: 'value',
            type: 'string'
          },
          native: {}
        },
        device.Version
      );
      await this.createOrExtendObject(
        `${device.Serial}.Firmware.Autoupdate`,
        {
          type: 'state',
          common: {
            name: "Shows whether the device updates it's firmware automatically if update is available.",
            read: true,
            write: true,
            role: 'indicator',
            type: 'boolean'
          },
          native: {}
        },
        device.AutoUpdate
      );
      await this.createOrExtendObject(
        `${device.Serial}.Firmware.NewVersionAvailable`,
        {
          type: 'state',
          common: {
            name: 'Shows whether a firmware update for this device is available online.',
            read: true,
            write: false,
            role: 'indicator',
            type: 'boolean'
          },
          native: {}
        },
        device.NewVersionAvailable
      );
      await this.createOrExtendObject(
        `${device.Serial}.ProductType`,
        {
          type: 'state',
          common: {
            name: 'dyson internal productType.',
            read: true,
            write: false,
            role: 'value',
            type: 'string'
          },
          native: {}
        },
        device.ProductType
      );
      await this.createOrExtendObject(
        `${device.Serial}.ConnectionType`,
        {
          type: 'state',
          common: {
            name: 'Type of connection.',
            read: true,
            write: false,
            role: 'value',
            type: 'string'
          },
          native: {}
        },
        device.ConnectionType
      );
      await this.createOrExtendObject(
        `${device.Serial}.Name`,
        {
          type: 'state',
          common: {
            name: 'Name of device.',
            read: true,
            write: true,
            role: 'value',
            type: 'string'
          },
          native: {}
        },
        device.Name
      );
      this.log.debug(`Querying Host-Address of device: ${device.Serial}`);
      const hostAddress = await this.getStateAsync(
        `${device.Serial}.Hostaddress`
      );
      this.log.debug(
        `Got Host-Address-object [${JSON.stringify(hostAddress)}] for device: ${device.Serial}`
      );
      if (hostAddress?.val && typeof hostAddress.val === 'string') {
        this.log.debug(
          `Found valid Host-Address [${hostAddress.val}] for device: ${device.Serial}`
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
              type: 'string'
            },
            native: {}
          },
          hostAddress.val
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
              type: 'string'
            },
            native: {}
          },
          ''
        );
      }
    } catch (error) {
      this.log.error(
        `[CreateOrUpdateDevice] Error: ${error}, Callstack: ${error.stack}`
      );
    }
  }
  // Format: [ 0-dysonCode, 1-Name of Datapoint, 2-Description, 3-datatype, 4-writeable, 5-role, 6-unit, 7-possible values for data field]
  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDysonCode(dataField) {
    return dataField[0];
  }
  /**
   *
   * @param {string[]} dataField
   * @param {string} value
   * @returns {void}
   */
  setDysonCode(dataField, value) {
    dataField[0] = value;
  }

  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDataPointName(dataField) {
    return dataField[1];
  }

  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDescription(dataField) {
    return dataField[2];
  }

  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDataType(dataField) {
    return dataField[3];
  }

  // Format: [ 0-dysonCode, 1-Name of Datapoint, 2-Description, 3-datatype, 4-writeable, 5-role, 6-unit, 7-possible values for data field]
  /**
   *
   * @param {string[]} dataField
   * @returns {boolean}
   */
  getWriteable(dataField) {
    return dataField[4] === 'true';
  }
  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDataRole(dataField) {
    return dataField[5];
  }
  /**
   *
   * @param {string[]} dataField
   * @returns {string}
   */
  getDataUnit(dataField) {
    return dataField[6];
  }
  /**
   *
   * @param {string[]} dataField
   * @param {string} value
   * @returns {void}
   */
  setDataUnit(dataField, value) {
    dataField[6] = value;
  }
  /**
   *
   * @param {string[]} dataField
   * @returns {{}}
   */
  getValueList(dataField) {
    return dataField[7];
  }

  /**
   * processMsg
   *
   * Processes the current received message and updates relevant data fields
   *
   * @param {Object} device  additional data for the current device which are not provided by Web-API (IP-Address, MQTT-Password)
   * @param {string} path    Additional subfolders can be given here if needed with a leading dot (eg. .Sensor)!
   * @param {Object} message Current State of the device. Message is send by device via mqtt due to request or state change.
   */
  async processMsg(device, path, message) {
    for (const row in message) {
      // Is this a "product-state" message?
      if (row === 'product-state') {
        await this.processMsg(device, '', message[row]);
        return;
      }
      if (
        row === 'product-errors' ||
        row === 'product-warnings' ||
        row === 'module-errors' ||
        row === 'module-warnings'
      ) {
        await this.processMsg(device, `${path}.${row}`, message[row]);
      }
      // Is this a "data" message?
      if (row === 'data') {
        await this.processMsg(device, '.Sensor', message[row]);
        if (Object.prototype.hasOwnProperty.call(message[row], 'p25r')) {
          this.createPM25(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'p10r')) {
          this.createPM10(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'pact')) {
          this.createDust(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'vact')) {
          this.createVOC(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'va10')) {
          this.createVOC(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'noxl')) {
          this.createNO2(message, row, device);
        }
        if (Object.prototype.hasOwnProperty.call(message[row], 'hchr')) {
          this.createHCHO(message, row, device);
        }
        return;
      }
      // Handle all other message types
      //this.log.debug(`Processing item [${JSON.stringify(row)}] of Message: ${((typeof message === 'object')? JSON.stringify(message) : message)}` );
      const deviceConfig = await this.getDatapoint(row);
      if (deviceConfig === undefined) {
        this.log.silly(
          `Skipped creating unknown data field for Device:[${device.Serial}], Field: [${row}] Value:[${typeof message[row] === 'object' ? JSON.stringify(message[row]) : message[row]}]`
        );
        continue;
      }
      if (this.getDataPointName(deviceConfig) === 'skip') {
        this.log.silly(
          `Skipped creating known but unused data field for Device:[${device.Serial}], Field: [${row}] Value:[${typeof message[row] === 'object' ? JSON.stringify(message[row]) : message[row]}]`
        );
        continue;
      }
      // this.setDysonCode(deviceConfig, dysonUtils.getFieldRewrite(deviceConfig[0]));
      // strip leading zeros from numbers
      let value;
      if (this.getDataType(deviceConfig) === 'number') {
        value = parseInt(message[this.getDysonCode(deviceConfig)], 10);
        // TP02: When continuous monitoring is off and the fan is switched off - temperature and humidity loose their values.
        // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
        if (
          message[this.getDysonCode(deviceConfig)] === 'OFF' &&
          adapter.config.keepValues
        ) {
          continue;
        }
        if (this.getDysonCode(deviceConfig) === 'filf') {
          // create additional data field filterlifePercent converting value from hours to percent; 4300 is the estimated lifetime in hours by dyson
          this.createOrExtendObject(
            `${device.Serial + path}.FilterLifePercent`,
            {
              type: 'state',
              common: {
                name: this.getDescription(deviceConfig),
                read: true,
                write: this.getWriteable(deviceConfig) === true,
                role: this.getDataRole(deviceConfig),
                type: this.getDataType(deviceConfig),
                unit: '%',
                states: this.getValueList(deviceConfig)
              },
              native: {}
            },
            Number((value * 100) / 4300)
          );
        }
        if (
          this.getDysonCode(deviceConfig) === 'vact' ||
          this.getDysonCode(deviceConfig) === 'va10' ||
          this.getDysonCode(deviceConfig) === 'noxl'
        ) {
          value = Math.floor(value / 10);
        }
        if (this.getDysonCode(deviceConfig) === 'hchr') {
          value = value / 1000;
        }
      } else if (this.getDataRole(deviceConfig) === 'value.temperature') {
        // TP02: When continuous monitoring is off and the fan ist switched off - temperature and humidity loose their values.
        // test whether the values are invalid and config.keepValues is true to prevent the old values from being destroyed
        if (
          message[this.getDysonCode(deviceConfig)] === 'OFF' &&
          adapter.config.keepValues
        ) {
          continue;
        }
        value = parseInt(message[this.getDysonCode(deviceConfig)], 10);
        // convert temperature to configured unit
        // @ts-ignore
        switch (this.config.temperatureUnit) {
          case 'K':
            value /= 10;
            break;
          case 'C':
            this.setDataUnit(deviceConfig, '°C');
            // OLD: deviceConfig[6] = '°' + this.config.temperatureUnit;
            value = Number(value / 10 - 273.15).toFixed(2);
            break;
          case 'F':
            this.setDataUnit(deviceConfig, '°F');
            // OLD: deviceConfig[6] = '°' + this.config.temperatureUnit;
            value = Number((value / 10 - 273.15) * (9 / 5) + 32).toFixed(2);
            break;
        }
      } else if (
        this.getDataType(deviceConfig) === 'boolean' &&
        this.getDataRole(deviceConfig).startsWith('switch')
      ) {
        // testValue should be the 2nd value in an array or if it's no array, the value itself
        const testValue =
          typeof message[this.getDysonCode(deviceConfig)] === 'object'
            ? message[this.getDysonCode(deviceConfig)][1]
            : message[this.getDysonCode(deviceConfig)];
        //this.log.debug(`${getDataPointName(deviceConfig)} is a bool switch. Current state: [${testValue}]`);
        value =
          testValue === 'ON' || testValue === 'HUMD' || testValue === 'HEAT';
      } else if (
        this.getDataType(deviceConfig) === 'boolean' &&
        this.getDataRole(deviceConfig).startsWith('indicator')
      ) {
        // testValue should be the 2nd value in an array or if it's no array, the value itself
        const testValue =
          typeof message[this.getDysonCode(deviceConfig)] === 'object'
            ? message[this.getDysonCode(deviceConfig)][1]
            : message[this.getDysonCode(deviceConfig)];
        this.log.silly(
          `${this.getDataPointName(deviceConfig)} is a bool switch. Current state: [${testValue}] --> returnvalue for further processing: ${testValue === 'FAIL'}`
        );
        value = testValue === 'FAIL';
      } else {
        // It's no bool switch
        value = message[this.getDysonCode(deviceConfig)];
      }
      // during state-change message only changed values are being updated
      if (typeof value === 'object') {
        if (value[0] === value[1]) {
          this.log.debug(
            `Values for [${this.getDataPointName(deviceConfig)}] are equal. No update required. Skipping.`
          );
          continue;
        } else {
          value = value[1].valueOf();
        }
        this.log.debug(
          `Value is an object. Converting to value: [${JSON.stringify(value)}] --> [${value.valueOf()}]`
        );
        value = value.valueOf();
      }
      // deviceConfig.length>7 means the data field has predefined states attached, that need to be handled
      if (deviceConfig.length > 7) {
        // this.log.debug(`DeviceConfig: length()=${deviceConfig.length}, 7=[${JSON.stringify(this.getValueList(deviceConfig))}]`);
        let currentStates = {};
        if (
          this.getValueList(deviceConfig) === dysonConstants.LOAD_FROM_PRODUCTS
        ) {
          // this.log.debug(`Sideloading states for token [${getDysonCode(deviceConfig)}] - Device:[${device.Serial}], Type:[${device.ProductType}].`);
          currentStates =
            dysonConstants.PRODUCTS[device.ProductType][
              this.getDysonCode(deviceConfig)
            ];
          // this.log.debug(`Sideloading: Found states [${JSON.stringify(currentStates)}].`);
        } else {
          currentStates = this.getValueList(deviceConfig);
        }
        this.createOrExtendObject(
          `${device.Serial + path}.${this.getDataPointName(deviceConfig)}`,
          {
            type: 'state',
            common: {
              name: this.getDescription(deviceConfig),
              read: true,
              write: this.getWriteable(deviceConfig) === true,
              role: this.getDataRole(deviceConfig),
              type: this.getDataType(deviceConfig),
              unit: this.getDataUnit(deviceConfig),
              states: currentStates
            },
            native: {}
          },
          value
        );
      } else {
        this.createOrExtendObject(
          `${device.Serial + path}.${this.getDataPointName(deviceConfig)}`,
          {
            type: 'state',
            common: {
              name: this.getDescription(deviceConfig),
              read: true,
              write: this.getWriteable(deviceConfig) === true,
              role: this.getDataRole(deviceConfig),
              type: this.getDataType(deviceConfig),
              unit: this.getDataUnit(deviceConfig)
            },
            native: {}
          },
          value
        );
      }
      // getWriteable(deviceConfig)=true -> data field is editable, so subscribe for state changes
      if (this.getWriteable(deviceConfig) === true) {
        //this.log.debug('Subscribing for state changes on :' + device.Serial + path + '.'+ this.getDataPointName(deviceConfig) );
        this.subscribeStates(
          `${device.Serial + path}.${this.getDataPointName(deviceConfig)}`
        );
      }
    }
  }

  /**
   * createNO2
   *
   * creates the data fields for the values itself and the index if the device has a NO2 sensor
   *
   * @param {Object[]} message the received mqtt message
   * @param {number} message[].noxl
   * @param {string} row      the current data row
   * @param {Object} device   the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      NO2Index
    );
    this.subscribeStates(`${device.Serial}.Sensor.NO2Index`);
  }

  /**
   * createHCHO
   *
   * creates the data fields for the values itself and the index if the device has a HCHO sensor
   *
   * @param {Object[]} message  the received mqtt message
   * @param {number} message[].noxl
   * @param {string} row      the current data row
   * @param {Object} device   the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      HCHOIndex
    );
    this.subscribeStates(`${device.Serial}.Sensor.HCHOIndex`);
  }

  /**
   * createVOC
   *
   * creates the data fields for the values itself and the index if the device has a VOC sensor
   *
   * @param {Object[]} message the received mqtt message
   * @param {number} message[].va10
   * @param {string} row      the current data row
   * @param {Object} device   the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      VOCIndex
    );
    VOC = VOCIndex;
    this.subscribeStates(`${device.Serial}.Sensor.VOCIndex`);
  }

  /**
   * createPM10
   *
   * creates the data fields for the values itself and the index if the device has a PM 10 sensor
   *
   * @param {Object} message the received mqtt message
   * @param {number} message[].pm10
   * @param {string} row the current data row
   * @param {Object} device the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      PM10Index
    );
    PM10 = PM10Index;
    this.subscribeStates(`${device.Serial}.Sensor.PM10Index`);
  }

  /**
   * createDust
   *
   * creates the data fields for the values itself and the index if the device has a simple dust sensor
   *
   * @param {Object[]} message the received mqtt message
   * @param {number} message[].pact
   * @param {string} row      the current data row
   * @param {Object} device   the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      dustIndex
    );
    Dust = dustIndex;
    this.subscribeStates(`${device.Serial}.Sensor.DustIndex`);
  }

  /**
   * createPM25
   *
   * creates the data fields for the values itself and the index if the device has a PM 2,5 sensor
   *
   * @param {Object[]} message the received mqtt message
   * @param {number} message[].p25r
   * @param {string} row      the current data row
   * @param {Object} device   the device object the data is valid for
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
            5: 'worrying'
          }
        },
        native: {}
      },
      PM25Index
    );
    PM25 = PM25Index;
    this.subscribeStates(`${device.Serial}.Sensor.PM25Index`);
  }

  /**
   * main
   *
   * It's the main routine of the adapter
   */
  async main() {
    const adapterLog = this.log;
    try {
      adapterLog.info(
        `Querying devices from dyson API. ${adapter.config.token}`
      );
      devices = await dysonUtils.getDevices(adapter.config.token, adapter);
      if (typeof devices != 'undefined') {
        for (const thisDevice in devices) {
          await this.CreateOrUpdateDevice(devices[thisDevice]);
          // delete deprecated fields from device tree
          await dysonUtils.deleteUnusedFields(
            this,
            `${this.name}.${this.instance}.${devices[thisDevice].Serial}`
          );
          // Initializes the MQTT client for local communication with the thisDevice
          this.log.debug(
            `Result of CreateOrUpdateDevice: [${JSON.stringify(devices[thisDevice])}]`
          );
          if (
            !devices[thisDevice].hostAddress ||
            devices[thisDevice].hostAddress === '' ||
            devices[thisDevice].hostAddress === 'undefined' ||
            typeof devices[thisDevice].hostAddress === 'undefined'
          ) {
            adapter.log.info(
              `No host address given. Trying to connect to the device with it's default hostname [${devices[thisDevice].Serial}]. This should work if you haven't changed it and if you're running a DNS.`
            );
            devices[thisDevice].hostAddress = devices[thisDevice].Serial;
          }
          // subscribe to changes on host address to re-init adapter on changes
          this.log.debug(
            `Subscribing for state changes on :${devices[thisDevice].Serial}.hostAddress`
          );
          this.subscribeStates(`${devices[thisDevice].Serial}.hostAddress`);
          // connect to device
          adapterLog.info(
            `Trying to connect to device [${devices[thisDevice].Serial}] via MQTT on host address [${devices[thisDevice].hostAddress}].`
          );
          devices[thisDevice].mqttClient = mqtt.connect(
            `mqtt://${devices[thisDevice].hostAddress}`,
            {
              username: devices[thisDevice].Serial,
              password: devices[thisDevice].mqttPassword,
              protocolVersion: 3,
              protocolId: 'MQIsdp'
            }
          );
          //noinspection JSUnresolvedVariable
          adapterLog.info(
            `${devices[thisDevice].Serial} - MQTT connection requested for [${devices[thisDevice].hostAddress}].`
          );

          // Subscribes for events of the MQTT client
          devices[thisDevice].mqttClient.on('connect', function () {
            //noinspection JSUnresolvedVariable
            adapterLog.info(
              `${devices[thisDevice].Serial} - MQTT connection established.`
            );
            adapter.setDeviceOnlineState(devices[thisDevice].Serial, 'online');

            // Subscribes to the status topic to receive updates
            //noinspection JSUnresolvedVariable
            devices[thisDevice].mqttClient.subscribe(
              `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/status/current`,
              function () {
                // Sends an initial request for the current state
                devices[thisDevice].mqttClient.publish(
                  `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/command`,
                  JSON.stringify({
                    msg: 'REQUEST-CURRENT-STATE',
                    time: new Date().toISOString()
                  })
                );
              }
            );
            // Subscribes to the "faults" topic to receive updates on any faults and warnings
            devices[thisDevice].mqttClient.subscribe(
              `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/status/faults`,
              function () {
                // Sends an initial request for the current state
                devices[thisDevice].mqttClient.publish(
                  `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/command`,
                  JSON.stringify({
                    msg: 'REQUEST-CURRENT-FAULTS',
                    time: new Date().toISOString()
                  })
                );
              }
            );
            // Subscribes to the software topic to receive updates on any faults and warnings
            devices[thisDevice].mqttClient.subscribe(
              `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/status/software`,
              function () {}
            );
            // Subscribes to the connection topic to receive updates on any faults and warnings
            devices[thisDevice].mqttClient.subscribe(
              `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/status/connection`,
              function () {}
            );
            // Sets the interval for status updates
            adapterLog.info(
              `Starting Polltimer with a ${adapter.config.pollInterval} seconds interval.`
            );
            // start refresh scheduler with interval from adapters config
            devices[thisDevice].updateIntervalHandle = setTimeout(
              function schedule() {
                //noinspection JSUnresolvedVariable
                adapterLog.debug(
                  `Updating device [${devices[thisDevice].Serial}] (polling API scheduled).`
                );
                try {
                  // possible messages:
                  // msg: 'REQUEST-PRODUCT-ENVIRONMENT-CURRENT-SENSOR-DATA'
                  // msg: 'REQUEST-CURRENT-FAULTS'
                  // msg: 'REQUEST-CURRENT-STATE',
                  devices[thisDevice].mqttClient.publish(
                    `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/command`,
                    JSON.stringify({
                      msg: 'REQUEST-CURRENT-STATE',
                      time: new Date().toISOString()
                    })
                  );
                  devices[thisDevice].mqttClient.publish(
                    `${devices[thisDevice].ProductType}/${devices[thisDevice].Serial}/command`,
                    JSON.stringify({
                      msg: 'REQUEST-CURRENT-FAULTS',
                      time: new Date().toISOString()
                    })
                  );
                } catch (error) {
                  //noinspection JSUnresolvedVariable
                  adapterLog.error(
                    `${devices[thisDevice].Serial} - MQTT interval error: ${error}`
                  );
                }
                // expect adapter has created all data points after first 20 secs of run.
                setTimeout(() => {
                  adapterIsSetUp = true;
                }, 20000);
                devices[thisDevice].updateIntervalHandle = setTimeout(
                  schedule,
                  adapter.config.pollInterval * 1000
                );
              },
              10
            );
          });
          devices[thisDevice].mqttClient.on(
            'message',
            async function (_, payload) {
              // change dataType from Buffer to JSON object
              payload = JSON.parse(payload.toString());
              adapterLog.debug(`MessageType: ${payload.msg}`);
              switch (payload.msg) {
                case 'STATE-CHANGE':
                case 'CURRENT-STATE':
                  await adapter.processMsg(devices[thisDevice], '', payload);
                  break;
                case 'CURRENT-FAULTS':
                  await adapter.processMsg(
                    devices[thisDevice],
                    '.SystemState',
                    payload
                  );
                  break;
                case 'ENVIRONMENTAL-CURRENT-SENSOR-DATA':
                  //noinspection JSUnresolvedVariable
                  await adapter.createOrExtendObject(
                    `${devices[thisDevice].Serial}.Sensor`,
                    {
                      type: 'channel',
                      common: {
                        name: "Information from device's sensors",
                        type: 'folder',
                        read: true,
                        write: false
                      },
                      native: {}
                    },
                    null
                  );
                  await adapter.processMsg(
                    devices[thisDevice],
                    '.Sensor',
                    payload
                  );
                  break;
              }
              //noinspection JSUnresolvedVariable
              adapterLog.debug(
                `${devices[thisDevice].Serial} - MQTT message received: ${JSON.stringify(payload)}`
              );
            }
          );

          devices[thisDevice].mqttClient.on('error', function (error) {
            //noinspection JSUnresolvedVariable
            adapterLog.debug(
              `${devices[thisDevice].Serial} - MQTT error: ${error}`
            );
            //noinspection JSUnresolvedVariable
            adapter.setDeviceOnlineState(devices[thisDevice].Serial, 'error');
          });

          devices[thisDevice].mqttClient.on('reconnect', function () {
            //noinspection JSUnresolvedVariable
            if (!adapter.config.disableReconnectLogging)
              adapterLog.info(
                `${devices[thisDevice].Serial} - MQTT reconnecting.`
              );
            //noinspection JSUnresolvedVariable
            adapter.setDeviceOnlineState(
              devices[thisDevice].Serial,
              'reconnect'
            );
          });

          devices[thisDevice].mqttClient.on('close', function () {
            //noinspection JSUnresolvedVariable
            if (!adapter.config.disableReconnectLogging)
              adapterLog.info(
                `${devices[thisDevice].Serial} - MQTT disconnected.`
              );
            adapter.clearIntervalHandle(
              devices[thisDevice].updateIntervalHandle
            );
            //noinspection JSUnresolvedVariable
            adapter.setDeviceOnlineState(
              devices[thisDevice].Serial,
              'disconnected'
            );
          });

          devices[thisDevice].mqttClient.on('offline', function () {
            //noinspection JSUnresolvedVariable
            adapterLog.info(`${devices[thisDevice].Serial} - MQTT offline.`);
            adapter.clearIntervalHandle(
              devices[thisDevice].updateIntervalHandle
            );
            //noinspection JSUnresolvedVariable
            adapter.setDeviceOnlineState(devices[thisDevice].Serial, 'offline');
          });

          devices[thisDevice].mqttClient.on('end', function () {
            //noinspection JSUnresolvedVariable
            adapterLog.debug(`${devices[thisDevice].Serial} - MQTT ended.`);
            adapter.clearIntervalHandle(
              devices[thisDevice].updateIntervalHandle
            );
          });
        }
      } else {
        adapterLog.error(
          `Unable to retrieve data from dyson servers. May be e.g. a failed login or connection issues. Please check.`
        );
      }
    } catch (error) {
      await this.setState('info.connection', false, true);
      adapterLog.error(
        `[main] Error while querying devices from dyson servers. The most common issue is that you haven't finished the 2FA process. Please refer to the ReadMe for instructions.`
      );
      adapterLog.error(`[main] error: ${error}, stack: ${error.stack}`);
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
    try {
      dysonUtils.checkAdapterConfig(adapter);
      this.main();
    } catch (error) {
      adapter.log.warn(
        `This adapter has no or no valid configuration. Starting anyway to give you the opportunity to configure it properly. ${error}`
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
   * @param {string} device  path to the device incl. Serial
   * @param {string} state   state to set (online, offline, reconnecting, ...)
   */
  setDeviceOnlineState(device, state) {
    this.createOrExtendObject(
      `${device}.Online`,
      {
        type: 'state',
        common: {
          name: 'Indicator whether device is online or offline.',
          read: true,
          write: false,
          role: 'indicator.reachable',
          type: 'boolean'
        },
        native: {}
      },
      state === 'online'
    );
    this.setState('info.connection', state === 'online', true);
  }

  /**
   * Function Create or extend object
   *
   * Updates an existing object (id) or creates it if not existing.
   *
   * @param {string} id  path/id of datapoint to create
   * @param {Object} objData  details to the datapoint to be created (Device, channel, state, ...)
   * @param {any} value  value of the datapoint
   */
  createOrExtendObject(id, objData, value) {
    if (adapterIsSetUp) {
      this.setState(id, value, true);
    } else {
      const self = this;
      this.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
          //self.log.debug('Updating existing object [' + id +'] with value: ['+ value+']');
          self.extendObject(id, objData, () => {
            self.setState(id, value, true);
          });
        } else {
          //self.log.debug('Creating new object [' + id +'] with value: ['+ value+']');
          self.setObjectNotExists(id, objData, () => {
            self.setState(id, value, true);
          });
        }
      });
    }
  }

  /**
   * getDatapoint
   *
   * returns the configDetails for any datapoint
   *
   * @param {string} searchValue dysonCode to search for.
   *
   * @returns {Object} returns the configDetails for any given datapoint or undefined if searchValue can't be resolved.
   */
  getDatapoint(searchValue) {
    // this.log.debug('getDatapoint('+searchValue+')');
    for (let row = 0; row < dysonConstants.DATAPOINTS.length; row++) {
      if (
        dysonConstants.DATAPOINTS[row].find(element => element === searchValue)
      ) {
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
  clearIntervalHandle(updateIntervalHandle) {
    if (updateIntervalHandle) {
      clearTimeout(updateIntervalHandle);
      return null;
    } else {
      return updateIntervalHandle;
    }
  }

  // Exit adapter
  onUnload(callback) {
    try {
      for (const thisDevice in devices) {
        clearTimeout(devices[thisDevice].updateIntervalHandle);
        this.log.info(`Cleaned up timeout for ${devices[thisDevice].Serial}.`);
        // todo unsubscribe to any subscribes
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
   * @param {dysonOptions} options
   */
  module.exports = options => new dysonAirPurifier(options);
} else {
  // otherwise start the instance directly
  new dysonAirPurifier();
}

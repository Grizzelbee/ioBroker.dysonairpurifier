'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const { stringify } = require('flatted');
const dysonConstants = require('./dysonConstants.js');
const axios = require('axios');
const path = require('path');
const https = require('https');
const rootCas = require('ssl-root-cas').create();
const httpsAgent = new https.Agent({ ca: rootCas });
const dnsResolver = require('node:dns').promises;
// const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
rootCas.addFile(path.resolve(__dirname, 'certificates/intermediate.pem'));

module.exports.getDyson2faLocale = function (country) {
  switch (country) {
    case 'DE':
      return 'de-DE';
    case 'AT':
      return 'de-AT';
    case 'CH':
      return 'de-CH';
    case 'NL':
      return 'nl-NL';
    case 'FR':
      return 'fr-FR';
    case 'PL':
      return 'pl-PL';
    case 'BE':
      return 'fr-BE';
    case 'US':
      return 'en-US';
    case 'GB':
      return 'en-GB';
    case 'IE':
      return 'en-IE';
    case 'CA':
      return 'en-CA';
    case 'RU':
      return 'ru-RU';
    case 'CN':
      return 'cn-CN';
  }
  throw new Error(
    `getDyson2faLocale: Unknown country for 2FA mail: ${country}`
  );
};

/**
 * getDyson2faMail
 * Does the first part of the dyson 2FA. Requests the one-time-password from the API
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} adapter link to the adapter instance
 * @param {string} email email address as registered at dyson cloud
 * @param {string} passwd password according to dyson cloud account
 * @param {string} country country the account is registered in
 * @param {string} locale locale according to country
 *
 * @returns {Promise<Record<string, any>>} response.data - data part of the dyson API  response
 * */
module.exports.getDyson2faMail = async function (
  adapter,
  email,
  passwd,
  country,
  locale
) {
  adapter.log.debug('Utils: getDyson2faMail!');
  const payload = {
    Email: email,
    Password: passwd
  };
  try {
    const result = await axios.post(
      `${dysonConstants.API_BASE_URI}/v3/userregistration/email/userstatus?country=${country}`,
      payload,
      { httpsAgent, headers: dysonConstants.HTTP_HEADERS, json: true }
    );
    if (result.data?.accountStatus !== 'ACTIVE') {
      return {
        error: `This account : ${email} is ${result.data.accountStatus} but needs to be ACTIVE. Please fix this first and set this account to active using the dyson smartphone app or website.`
      };
    }
    adapter.log.debug(`Result: ${JSON.stringify(result.data)}`);
    if (result.data.authenticationMethod !== 'EMAIL_PWD_2FA') {
      return {
        error: `Received unexpected authentication-method from dyson API. Expecting: [EMAIL_PWD_2FA], received: [${result.data.authenticationMethod}].`
      };
    }
    const response = await axios.post(
      `${dysonConstants.API_BASE_URI}/v3/userregistration/email/auth?country=${country}&culture=${locale}`,
      payload,
      { httpsAgent, headers: dysonConstants.HTTP_HEADERS, json: true }
    );
    adapter.log.debug(
      `Result from API-Status request -> challengeId is: ${response.data.challengeId}`
    );
    adapter.log.debug(stringify(response.data));
    //return(response.data);
    return { native: { challengeId: response.data.challengeId } };
  } catch (error) {
    adapter.log.error(`CATCH-getDyson2faMail: ${stringify(error)}`);
    return {
      error: `Received error: [${error}] from dyson API.\n These credentials have been used during this request: Username: [${email}], Password: [${passwd}], country: [${country}], locale: [${locale}].\nIf these credentials are okay and you are facing a 401 error, please refer to the adapters readme file for a documented solution.\nIf these credentials are okay and you are facing another error please contact the developer via iobroker forum or github.`
    };
  }
};

/**
 * getDysonToken
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} adapter link to the adapter instance
 * @param {string} email email address as registered at dyson cloud
 * @param {string} passwd password according to dyson cloud account* @param challengeId
 * @param {string} country country the account is registered in
 * @param {string} challengeId
 * @param {string} PIN
 *
 * @returns {Promise<string, any>}
 */
module.exports.getDysonToken = async function (
  adapter,
  email,
  passwd,
  country,
  challengeId,
  PIN
) {
  adapter.log.debug('Utils: getDysonToken!');
  const payload = {
    Email: email,
    Password: passwd,
    challengeId: challengeId,
    otpCode: PIN
  };
  try {
    const response = await axios.post(
      `${dysonConstants.API_BASE_URI}/v3/userregistration/email/verify?country=${country}`,
      payload,
      { httpsAgent, headers: dysonConstants.HTTP_HEADERS, json: true }
    );
    // return(response.data);
    return { native: { token: response.data.token } };
  } catch (err) {
    adapter.log.error(`getDysonToken: ${err}`);
    return { error: `Received error: [${err}] from dyson API.` };
  }
};

/**
 * getAngles
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} adapter link to the adapter instance
 * @param {string} dysonAction the current action that changed it's state
 * @param {string} thisDevice path to the current device
 * @param {Record<string, any>} state the state-object as received by OnStateChange
 * @returns {Promise<Record<string, any>>}
 */
module.exports.getAngles = async function (
  adapter,
  dysonAction,
  thisDevice,
  state
) {
  // thisDevice=dysonairpurifier.0.VS9-EU-NAB0887A.OscillationAngle
  thisDevice = thisDevice.split('.', 3);
  thisDevice = thisDevice.join('.');
  const result = { ancp: {}, osal: {}, osau: {} };
  adapter.log.debug(
    `getAngles: given parameters: dysonAction: [${dysonAction}], thisDevice: [${thisDevice}]`
  );
  if (dysonAction === 'ancp') {
    result.ancp = state;
    result.osal = await adapter.getStateAsync(`${thisDevice}.OscillationLeft`);
    result.osau = await adapter.getStateAsync(`${thisDevice}.OscillationRight`);
  } else if (dysonAction === 'osal') {
    result.ancp = await adapter.getStateAsync(`${thisDevice}.OscillationAngle`);
    result.osal = state;
    result.osau = await adapter.getStateAsync(`${thisDevice}.OscillationRight`);
  } else if (dysonAction === 'osau') {
    result.ancp = await adapter.getStateAsync(`${thisDevice}.OscillationAngle`);
    result.osal = await adapter.getStateAsync(`${thisDevice}.OscillationLeft`);
    result.osau = state;
  }
  return result;
};

/**
 * Function zeroFill
 *
 * Formats a number as a string with leading zeros
 *
 * @param {string} number - Value that needs to be filled up with leading zeros
 * @param {number} width - width of the complete new string incl. number and zeros
 * @returns {string} The given number filled up with leading zeros to a given width (excluding the negative sign), returns empty string if number is not an actual number.
 */
module.exports.zeroFill = function (number, width) {
  const num = parseInt(number);

  if (isNaN(num)) {
    return '';
  }

  const negativeSign = num < 0 ? '-' : '';
  const str = `${Math.abs(num)}`;

  return `${negativeSign}${_.padStart(str, width, '0')}`;
};

/**
 * checkAdapterConfig
 *
 * {promise} Tests whether the given adapters config is valid
 *           resolves if the config is valid
 *           rejects if the config is invalid
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} adapter - ioBroker adapter which contains the configuration that should be checked
 * @returns {unknown}
 * @throws
 */
module.exports.checkAdapterConfig = function (adapter) {
  const config = adapter.config;

  if (
    !config.email ||
    config.email === '' ||
    !config.Password ||
    config.Password === '' ||
    !config.country ||
    config.country === ''
  ) {
    if (!config.email || config.email === '') {
      adapter.log.error(
        `Invalid configuration provided: eMail address is missing. Please enter your eMail address.`
      );
    }
    if (!config.Password || config.Password === '') {
      adapter.log.error(
        `Invalid configuration provided: password is missing. Please enter your password.`
      );
    }
    if (!config.country || config.country === '') {
      adapter.log.error(
        `Invalid configuration provided: Country is missing. Please select your country.`
      );
    }
    if (!config.temperatureUnit || config.temperatureUnit === '') {
      adapter.log.error(
        `Invalid configuration provided: Temperature unit is missing. Please select a temperature unit.`
      );
    }
    if (
      !config.pollInterval ||
      config.pollInterval === '' ||
      config.pollInterval < 1
    ) {
      adapter.log.error(
        `Invalid configuration provided: Poll interval is not valid. Please enter a valid poll interval (> 0s).`
      );
    }
    throw new Error('Given adapter config is invalid. Please fix.');
  }
};

/**
 * Function decryptMqttPasswd
 * decrypts the fans local mqtt password and returns a value you can connect with
 *
 * @param {string} LocalCredentials - encrypted mqtt password
 *
 * @returns {string} The decrypted MQTT password
 */
module.exports.decryptMqttPasswd = function (LocalCredentials) {
  // Gets the MQTT credentials from the thisDevice (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
  const key = Uint8Array.from(Array(32), (_, index) => index + 1);
  const initializationVector = new Uint8Array(16);
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    initializationVector
  );
  const decryptedPasswordString =
    decipher.update(LocalCredentials, 'base64', 'utf8') +
    decipher.final('utf8');
  const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
  return decryptedPasswordJson.apPasswordHash;
};

/**
 * Function getDevices
 * Queries the devices stored in a given dyson online account
 *
 * @param {string} token - your dyson account token
 * @param {import('@iobroker/adapter-core').AdapterInstance} adapter - link to the adapter
 * @returns {Promise<Record<string, any>>}
 *      resolves with a List of dyson devices connected to the given account
 *      rejects with an error message
 */
module.exports.getDevices = async function (token, adapter) {
  try {
    const response = await this.dysonGetDevicesFromApi(token);

    const devices = [];
    for (const thisDevice in response.data) {
      adapter.log.debug(
        `Data received from dyson API: ${JSON.stringify(
          response.data[thisDevice]
        )}`
      );
      if (
        !Object.keys(dysonConstants.PRODUCTS).some(function (t) {
          return t === response.data[thisDevice].ProductType;
        })
      ) {
        // ProductType 552 = Lampe - dann diese Warning nicht anzeigen
        if (552 === response.data[thisDevice].ProductType) {
          adapter.log.info(
            `Device with serial number [${response.data[thisDevice].Serial}] not added, since it is a lamp and not supported by this adapter.`
          );
        } else {
          adapter.log.warn(
            `Device with serial number [${response.data[thisDevice].Serial}] not added, hence it is not supported by this adapter. Product type: [${response.data[thisDevice].ProductType}]`
          );
          adapter.log.warn(
            'Please open an Issue on github if you think your device should be supported.'
          );
        }
      } else {
        // productType is supported: Push to Array and create in devicetree
        response.data[thisDevice].hostAddress = undefined;
        response.data[thisDevice].mqttClient = null;
        response.data[thisDevice].mqttPassword = this.decryptMqttPasswd(
          response.data[thisDevice].LocalCredentials
        );
        response.data[thisDevice].updateIntervalHandle = null;
        devices.push(response.data[thisDevice]);
      }
    }
    return devices;
  } catch (error) {
    throw new Error(
      `[dysonGetDevicesFromApi] Error: (${error.statuscode}) ${error}, Callstack: ${error.stack}`
    );
  }
};

/**
 * dysonGetDevicesFromApi
 *
 * @param {string} token - contains required authentication token
 *
 * @returns {Promise<any>}
 *      resolves with dysons device data
 *      rejects on any http error.
 */
module.exports.dysonGetDevicesFromApi = async function (token) {
  // Sends a request to the API to get all devices of the user
  return await axios.get(
    `${dysonConstants.API_BASE_URI}/v2/provisioningservice/manifest`,
    {
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
      json: true
    }
  );
};

/**
 * Returns a masked and cloned copy of provided config
 * @param {Record<string, any>} unmaskedConfig The unmasked config
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
 * @param {string} msg Incoming JSON message
 */
module.exports.parseDysonMessage = function (msg) {
  if (null == msg || '' === msg) return;

  // TODO incomplete

  // const data = JSON.parse(msg);
  // console.log(data);
  //return;
};

/**
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} self
 * @param {string} device
 */
module.exports.deleteUnusedFields = async function (self, device) {
  self.log.debug(`Looking for deprecated fields on device ${device}`);
  for (const field of dysonConstants.FIELDSTODELETE) {
    const id = device + field;
    self.log.debug(`Looking for deprecated field: ${id}`);
    // const self = this;
    self.getObject(id, (err, oldObj) => {
      if (!err && oldObj) {
        self.log.info(`Deleting deprecated field: ${id}`);
        self.delObject(id);
      }
    });
  }
};

/**
 * Queries the current IP address of a host at a local dns resolver
 *
 * @param {import('@iobroker/adapter-core').AdapterInstance} self Handle of the instance
 * @param {string}   deviceName The hostname of the queried device
 * @returns {Promise<string>} first IPv4-Address of the device
 */
module.exports.getFanIP = async function(self, deviceName){
  self.log.debug(`Querying IP for device ${deviceName}`);
  try {
    const addresses = await dnsResolver.resolve4(deviceName);
    self.log.debug(`Found IP [${addresses[0]}] for device ${deviceName}`);
    return addresses[0]; // return only the first IP address
  } catch (error) {
    if (error.code === 'ENOTFOUND'){
      self.log.warn(`No IP address found for device ${deviceName}`);
      throw new Error(`Host ${deviceName} is unknown to your DNS.`);
    }
  }
};
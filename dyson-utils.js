'use strict';

const _ = require('lodash');
const crypto = require('crypto');

// class DysonUtils {
//     DysonUtils() {}
// }

/**
 * Function zeroFill
 *
 * Formats a number as a string with leading zeros
 *
 * @param number {number} Value thats needs to be filled up with leading zeros
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
 * @param config {Adapter} ioBroker adapter which contains the configuration that should be checked
 */
module.exports.checkAdapterConfig = async function (adapter) {
    adapter.log.debug('Entering function [checkAdapterConfig]...');
    
    const config = adapter.config;

    // Masking sensitive fields (password) for logging configuration
    // TODO Move to separate function for masking config wherever needed in this module
    const logConfig = config;
    logConfig.Password = '(***)';

    return new Promise(
        function (resolve, reject) {
            // TODO Do more precise tests. This is very rough
            if ((!config.email || config.email === '')
                || (!config.Password || config.Password === '')
                || (!config.country || config.country === '')) {
                adapter.log.debug(`Invalid configuration provided: ${logConfig}`);
                reject('Given adapter config is invalid. Please fix.');
            } else {
                resolve('Given config seems to be valid.');
            }
        });
};

/**
 * 
 * Decrypt passwords
 * 
 */
module.exports.decrypt = function (key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
};

/**
 * Function decryptMqttPasswd
 * decrypts the fans local mqtt password and returns a value you can connect with
 *
 * @param LocalCredentials  {string} encrypted mqtt password
 */
module.exports.decryptMqttPasswd = function (LocalCredentials) {
    // Gets the MQTT credentials from the thisDevice (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
    const key = Uint8Array.from(Array(32), (_, index) => index + 1);
    const initializationVector = new Uint8Array(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
    const decryptedPasswordString = decipher.update(LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
    const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
    return decryptedPasswordJson.apPasswordHash;
};

/**
 * Parse an incoming JSON message payload from the Dyson device
 * 
 * @param msg Incoming JSON message
 */
module.exports.parseDysonMessage = function (msg) {
    if (null == msg || '' == msg) return;

    // TODO incomplete

    // const data = JSON.parse(msg);
    // console.log(data);
    return;
};

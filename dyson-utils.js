'use strict';

const _ = require('lodash');

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
 * Parse an incoming JSON message the Dyson API
 * 
 * @param msg Incoming JSON message
 */
module.exports.parseDysonMessage = function (msg) {
    if (null == msg || '' == msg) return;

    const data = JSON.parse(msg);
    console.log(data);
    return;
};
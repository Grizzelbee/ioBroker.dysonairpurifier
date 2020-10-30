'use strict';

const _ = require('lodash');

// class DysonUtils {
//     DysonUtils() {}
// }

/*
* Function zeroFill
*
* Formats a number as a string with leading zeros
*
* @param number {number} Value thats needs to be filled up with leading zeros
* @param width  {number} width of the complete new string incl. number and zeros
*
* @returns The given number filled up with leading zeros to a given width
*/
module.exports.zeroFill = function (number, width) {
    return `${_.padStart(number, width, '0')}`;
};

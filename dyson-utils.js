'use strict';

// eslint-disable-next-line no-unused-vars
class DysonUtils {
    DysonUtils() { }
}

/*
* Function zeroFill
* Formats a number as a string with leading zeros
*
* @param number {number} Value thats needs to be filled up with leading zeros
* @param width  {number} width of the complete new string incl. number and zeros
*
* @returns The given number filled up with leading zeros to a given width
*/
module.exports.zeroFill = function (number, width) {
    width -= number.toString().length;
    if (width > 0) {
        return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number;
    }
    // `${_.padStart(number, width, '0')}`
    return number + ""; // always return a string
};

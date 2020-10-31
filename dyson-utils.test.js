'use strict';

const fs = require('fs');

const { fail } = require('assert');
const { expect } = require('chai');

const dysonUtils = require('./dyson-utils');

describe('dysonUtils => zeroFill', () => {
    it('should left-pad zeroes for positive input numbers', () => {
        const data = [
            [5, 4, '0005'],
            [1, 1, '1'],
            [45, 2, '45'],
            [734, 8, '00000734'],
        ];

        data.forEach(d => {
            expect(dysonUtils.zeroFill(d[0], d[1])).to.equal(d[2]);
        });
    });

    it('should left-pad zeroes for negative input numbers (width excludes negative sign)', () => {
        const data = [
            [-5, 4, '-0005'],
            [-1, 1, '-1'],
            [-45, 2, '-45'],
            [-734, 8, '-00000734'],
        ];

        data.forEach(d => {
            expect(dysonUtils.zeroFill(d[0], d[1])).to.equal(d[2]);
        });
    });

    it('should return empty string for invalid (non-number or empty) input', () => {
        expect(dysonUtils.zeroFill('', 50)).to.equal('');
        expect(dysonUtils.zeroFill('äöüß', 50)).to.equal('');
    });
});

describe('dysonUtils => parseDysonMsgPayload', () => {
    // See adapter.processMsg()

    it('should ignore empty or null message payload', () => {
        try {
            dysonUtils.parseDysonMessage('');
            dysonUtils.parseDysonMessage(null);
        } catch (error) {
            fail(`Error ${error} thrown during message processing.`);
        }
    });

    it.skip('should parse a DP01 CURRENT-STATE payload', () => {
        const msg = fs.readFileSync('./test/sample-data/sample-msg-DP01-1.json');
        const data = JSON.parse(msg);

        console.log(data);
    });

    it.skip('should parse a DP01 ENVIRONMENTAL-CURRENT-SENSOR-DATA payload', () => {});
});

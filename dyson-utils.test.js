// 'use strict';

const { expect } = require('chai');

const dysonUtils = require('./dyson-utils');

describe('dysonUtils => zeroFill', () => {
    it(`should left-pad zeroes for positive input numbers`, () => {
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

    it(`should left-pad zeroes for negative input numbers (width excludes negative sign)`, () => {
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

    it(`should return empty string for invalid (non-number or empty) input`, () => {
        expect(dysonUtils.zeroFill('', 50)).to.equal('');
        expect(dysonUtils.zeroFill('äöüß', 50)).to.equal('');
    });
});

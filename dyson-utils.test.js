'use strict';

const fs = require('fs');

const { fail } = require('assert');
const { expect } = require('chai');
const sinon = require('sinon');

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

describe('dysonUtils => checkAdapterConfig', () => {
    after(() => sinon.restore() );
    
    const fakeAdapter = {
        log: { debug: sinon.fake() },
        config: null
    };
    
    it('should reject an empty adapter configuration', () => {
        fakeAdapter.config = {
            temperatureUnit: '',
            pollInterval: '',
            country: '',
            email: '',
            Password: ''
        };
        expect(dysonUtils.checkAdapterConfig(fakeAdapter)).to.be.rejected;
    });

    it('should pass with a valid adapter configuration', () => {
        fakeAdapter.config = {
            temperatureUnit: 'C',
            pollInterval: 60,
            country: 'DE',
            email: 'me@example.com',
            Password: 'SecretPassword'
        };
        expect(dysonUtils.checkAdapterConfig(fakeAdapter)).to.be.fulfilled;
    });

});

describe('dysonUtils => decrypt', () => {
    it.skip('should verify decrypt mechanism', () => {});
});

describe('dysonUtils => decryptMqttPasswd', () => {
    it.skip('should verify decrypt MQTT password mechanism', () => {});
});


describe('dysonUtils => maskConfig', () => {
    it('should mask Password while not modifying the rest', () => {
        const expectedTemperaturUnit = 'C';
        const expectedPollInterval = 60;
        const expectedCountry = 'DE';
        const expectedEmail = 'me@example.com';

        const config = {
            temperatureUnit: expectedTemperaturUnit,
            pollInterval: expectedPollInterval,
            country: expectedCountry,
            email: expectedEmail,
            Password: 'SecretPassword'
        };
        const maskedConfig = dysonUtils.maskConfig(config);

        expect(maskedConfig.Password).to.equal("(***)", "Password wasn't masked to expected value");
        expect(maskedConfig.temperatureUnit).to.equal(expectedTemperaturUnit);
        expect(maskedConfig.pollInterval).to.equal(expectedPollInterval);
        expect(maskedConfig.country).to.equal(expectedCountry);
        expect(maskedConfig.email).to.equal(expectedEmail);
    });
});

describe('dysonUtils => parseDysonMsgPayload', () => {
    // TODO See adapter.processMsg() for now, considering migration to separate message parser later

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

    it.skip('should parse a DP01 ENVIRONMENTAL-CURRENT-SENSOR-DATA payload', () => {
        const msg = fs.readFileSync('./test/sample-data/sample-msg-DP01-2.json');
        const data = JSON.parse(msg);

        console.log(data);
    });

    it.skip('should parse a DP01 STATE-CHANGE payload', () => {
        const msg = fs.readFileSync('./test/sample-data/sample-msg-DP01-3.json');
        const data = JSON.parse(msg);

        console.log(data);
    });
});

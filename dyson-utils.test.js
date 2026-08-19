'use strict';

const fs = require('fs');

const { fail } = require('assert');
const { expect } = require('chai');
const sinon = require('sinon');

const dysonUtils = require('./dyson-utils');

describe('dyson-utils', () => {
  describe('zeroFill', () => {
    it('should left-pad zeroes for positive input numbers', () => {
      const data = [
        [5, 4, '0005'],
        [1, 1, '1'],
        [45, 2, '45'],
        [734, 8, '00000734']
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
        [-734, 8, '-00000734']
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

  describe('checkAdapterConfig', () => {
    after(() => sinon.restore());

    const fakeAdapter = {
      log: { debug: sinon.fake(), error: sinon.fake() },
      config: null
    };

    context('given an invalid adapter configuration', () => {
      it('should not throw - but wait for configuration', () => {
        fakeAdapter.config = {
          temperatureUnit: '',
          pollInterval: '',
          country: '',
          email: '',
          Password: ''
        };
        expect(() => dysonUtils.checkAdapterConfig(fakeAdapter)).to.not.throw();
      });
    });

    context('given an valid adapter configuration', () => {
      it('should not throw', () => {
        fakeAdapter.config = {
          temperatureUnit: 'C',
          pollInterval: 60,
          country: 'DE',
          email: 'me@example.com',
          Password: 'SecretPassword'
        };
        expect(() => dysonUtils.checkAdapterConfig(fakeAdapter)).to.not.throw();
      });
    });
  });

  describe('decrypt', () => {
    it.skip('should verify decrypt mechanism', () => {});
  });

  describe('decryptMqttPasswd', () => {
    it.skip('should verify decrypt MQTT password mechanism', () => {});
  });

  describe('maskConfig', () => {
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

      expect(maskedConfig.Password).to.equal(
        '(***)',
        "Password wasn't masked to expected value"
      );
      expect(maskedConfig.temperatureUnit).to.equal(expectedTemperaturUnit);
      expect(maskedConfig.pollInterval).to.equal(expectedPollInterval);
      expect(maskedConfig.country).to.equal(expectedCountry);
      expect(maskedConfig.email).to.equal(expectedEmail);
    });
  });

  describe('parseDysonMsgPayload', () => {
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

  describe('getLatestCompletedSpeed', () => {
    const startTime = '2026-08-12T22:00:00Z';
    const SLOT = 15 * 60 * 1000;
    const startMs = Date.parse(startTime);
    // nowMs positioned 1 min into the slot AFTER idx, so idx is the last completed slot
    const nowForLastCompleted = idx => startMs + (idx + 1) * SLOT + 60 * 1000;
    function dailyWith(pairs) {
      const fnsp = new Array(640).fill(null);
      pairs.forEach(([i, v]) => (fnsp[i] = v));
      return { start_time: startTime, resolution: 'PT15M', fnsp };
    }

    it('returns the real speed of the last completed 15-min slot', () => {
      const data = dailyWith([[636, 10], [637, 2.9], [638, 2]]);
      expect(dysonUtils.getLatestCompletedSpeed(data, nowForLastCompleted(638))).to.equal(2);
    });

    it('preserves fractional averaged speed', () => {
      const data = dailyWith([[636, 10], [637, 2.9], [638, 2]]);
      expect(dysonUtils.getLatestCompletedSpeed(data, nowForLastCompleted(637))).to.equal(2.9);
    });

    it('returns null when the last completed slot has no reading (fan off)', () => {
      const data = dailyWith([[636, 10]]);
      expect(dysonUtils.getLatestCompletedSpeed(data, nowForLastCompleted(638))).to.equal(null);
    });

    it('returns null for malformed data', () => {
      expect(dysonUtils.getLatestCompletedSpeed(null, startMs)).to.equal(null);
      expect(dysonUtils.getLatestCompletedSpeed({ start_time: 'x', resolution: 'PT15M', fnsp: [] }, startMs)).to.equal(null);
    });
  });

  describe('nextAutoFanSpeed', () => {
    const startTime = '2026-08-12T22:00:00Z';
    const SLOT = 15 * 60 * 1000;
    const startMs = Date.parse(startTime);
    const nowForLastCompleted = idx => startMs + (idx + 1) * SLOT + 60 * 1000;
    function dailyWith(pairs) {
      const fnsp = new Array(640).fill(null);
      pairs.forEach(([i, v]) => (fnsp[i] = v));
      return { start_time: startTime, resolution: 'PT15M', fnsp };
    }

    it('returns 12 (manual mode) when the fan is not in automatic mode', () => {
      expect(dysonUtils.nextAutoFanSpeed(false, null, startMs)).to.equal(12);
    });

    it('returns the real cloud speed as a number when in automatic mode', () => {
      const data = dailyWith([[638, 2]]);
      expect(dysonUtils.nextAutoFanSpeed(true, data, nowForLastCompleted(638))).to.equal(2);
    });

    it('preserves a fractional auto speed', () => {
      const data = dailyWith([[637, 2.9]]);
      expect(dysonUtils.nextAutoFanSpeed(true, data, nowForLastCompleted(637))).to.equal(2.9);
    });

    it('returns 0 while in auto with no reading yet and the fan is idle', () => {
      const data = dailyWith([]);
      expect(dysonUtils.nextAutoFanSpeed(true, data, nowForLastCompleted(638), false)).to.equal(0);
    });

    it('returns 11 (waiting) while in auto with no reading yet and the fan is running', () => {
      const data = dailyWith([]);
      expect(dysonUtils.nextAutoFanSpeed(true, data, nowForLastCompleted(638), true)).to.equal(11);
    });
  });
});

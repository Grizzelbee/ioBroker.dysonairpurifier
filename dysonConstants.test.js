'use strict';

const { expect } = require('chai');

const {
  getDatapoint,
  getNameToDysoncodeTranslation
} = require('./dysonConstants');

describe('dysonConstants', () => {
  describe('getDatapoint', () => {
    context('given a dyson code', () => {
      it('returns the corresponding datapoint', () => {
        const datapoint = getDatapoint('fpwr');
        expect(datapoint).to.be.an('object');
      });
    });
    context('given a non dyson code', () => {
      it('returns undefined', () => {
        const datapoint = getDatapoint('MainPower');
        expect(datapoint).to.equal(undefined);
      });
    });
  });

  describe('getNameToDysoncodeTranslation', () => {
    context('given a dyson code', () => {
      it('returns undefined', () => {
        const datapoint = getNameToDysoncodeTranslation('fpwr');
        expect(datapoint).to.equal(undefined);
      });
    });
    context('given a non dyson code', () => {
      it('returns the corresponding dyson code', () => {
        const datapoint = getNameToDysoncodeTranslation('MainPower');
        expect(datapoint).to.be.a('string');
      });
    });
  });
});

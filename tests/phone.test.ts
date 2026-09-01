import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoneNumber, isValidPhoneNumber, formatPhoneNumber } from '../lib/utils/phone';

describe('Phone Number Utility (lib/utils/phone.ts)', () => {
  it('should validate valid Nepal mobile numbers (10 digits)', () => {
    const res1 = validatePhoneNumber('9841234567');
    assert.equal(res1.isValid, true);
    assert.equal(res1.countryCode, 'NP');

    const res2 = validatePhoneNumber('9801234567');
    assert.equal(res2.isValid, true);
    assert.equal(res2.countryCode, 'NP');
  });

  it('should validate valid Nepal landline numbers (with area code)', () => {
    const res = validatePhoneNumber('01-4412345');
    assert.equal(res.isValid, true);
    assert.equal(res.countryCode, 'NP');
  });

  it('should validate international numbers with country codes', () => {
    const resNP = validatePhoneNumber('+977 9841234567');
    assert.equal(resNP.isValid, true);
    assert.equal(resNP.countryCode, 'NP');

    const resUS = validatePhoneNumber('+1 202 555 0123');
    assert.equal(resUS.isValid, true);
    assert.equal(resUS.countryCode, 'US');

    const resIN = validatePhoneNumber('+91 9876543210');
    assert.equal(resIN.isValid, true);
    assert.equal(resIN.countryCode, 'IN');
  });

  it('should reject invalid phone numbers', () => {
    const res1 = validatePhoneNumber('12345');
    assert.equal(res1.isValid, false);
    assert.ok(res1.error);

    const res2 = validatePhoneNumber('abcdefghij');
    assert.equal(res2.isValid, false);
  });

  it('should handle optional phone numbers (empty or null)', () => {
    const resEmpty = validatePhoneNumber('');
    assert.equal(resEmpty.isValid, true);

    const resNull = validatePhoneNumber(null);
    assert.equal(resNull.isValid, true);

    const resRequired = validatePhoneNumber('', true);
    assert.equal(resRequired.isValid, false);
    assert.equal(resRequired.error, 'Phone number is required.');
  });

  it('should format numbers to international standard cleanly', () => {
    const formatted = formatPhoneNumber('9841234567');
    assert.equal(formatted, '+977 984 1234567');
  });

  it('should provide quick isValidPhoneNumber helper', () => {
    assert.equal(isValidPhoneNumber('9841234567'), true);
    assert.equal(isValidPhoneNumber('0000000000'), false);
  });
});

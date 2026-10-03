import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoneNumber, isValidPhoneNumber, formatPhoneNumber, splitPhone, joinPhone, countryOfTyped } from '../lib/utils/phone';
import { validateMobileNumber } from '../lib/utils/phone-mobile';
import { ALL_COUNTRIES, COUNTRY_SEARCH_OPTIONS } from '../lib/constants/countries';
import { filterOptions } from '../lib/kit/combobox';

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

describe('Mobile number with country (4.2 follow-up)', () => {
  it('a Nepal mobile has 10 digits starting 96, 97 or 98; landlines are refused as Mobile', () => {
    assert.equal(validateMobileNumber('9841123456').isValid, true);
    assert.equal(validateMobileNumber('+9779612345678').isValid, true);
    const landline = validateMobileNumber('01-4412345');
    assert.equal(landline.isValid, false);
    assert.match(landline.error ?? '', /96, 97 or 98/);
    assert.equal(validateMobileNumber('9551234567').isValid, false);
  });

  it('a landline is still fine as Home phone', () => {
    assert.equal(validatePhoneNumber('01-4412345').isValid, true);
  });

  it('other countries use their own mobile rules', () => {
    assert.equal(validateMobileNumber('+91 98765 43210').isValid, true);
    assert.equal(validateMobileNumber('+91 11 2345 6789').isValid, false);
    assert.equal(validateMobileNumber('+61 2 9374 4000').isValid, false);
  });

  it('empty is an error only when required', () => {
    assert.equal(validateMobileNumber('', true).isValid, false);
    assert.equal(validateMobileNumber('').isValid, true);
  });

  it('splits a stored number into country and number and joins it back (trunk 0 dropped)', () => {
    assert.deepEqual(splitPhone('+919876543210'), { country: 'IN', national: '9876543210' });
    assert.deepEqual(splitPhone('+9779841234567'), { country: 'NP', national: '984-1234567' });
    assert.deepEqual(splitPhone(''), { country: 'NP', national: '' });
    assert.equal(joinPhone('NP', '01-4412345'), '+97714412345');
    assert.equal(joinPhone('NP', '984-1234567'), '+9779841234567');
    assert.equal(joinPhone('IN', '98765 43210'), '+919876543210');
    assert.equal(joinPhone('NP', ' - '), '');
    assert.equal(countryOfTyped('+91 98'), 'IN');
    assert.equal(countryOfTyped('98'), undefined);
  });

  it('every country is listed, Nepal first, searchable by dial code, name or ISO code', () => {
    assert.ok(ALL_COUNTRIES.length > 200);
    assert.equal(ALL_COUNTRIES[0].code, 'NP');
    assert.equal(filterOptions(COUNTRY_SEARCH_OPTIONS, '977')[0].value, 'NP');
    assert.equal(filterOptions(COUNTRY_SEARCH_OPTIONS, 'india')[0].value, 'IN');
    assert.ok(filterOptions(COUNTRY_SEARCH_OPTIONS, '+91').some((o) => o.value === 'IN'));
    assert.equal(filterOptions(COUNTRY_SEARCH_OPTIONS, '', COUNTRY_SEARCH_OPTIONS.length).length, ALL_COUNTRIES.length);
  });
});

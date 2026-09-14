import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCompanyCode, getNextCompanyCode, slugifyCompanyName, INITIAL_COMPANY_CODE_NUMBER } from '../lib/platform/company-code';

describe('Company Code & Slug Generation', () => {
  it('should generate initial sequential code CMP-111111 when existing list is empty', () => {
    const code = generateCompanyCode([]);
    assert.equal(code, 'CMP-111111');
    assert.match(code, /^CMP-\d{6}$/);
  });

  it('should increment company code sequentially (e.g. CMP-111111 -> CMP-111112)', () => {
    const next1 = generateCompanyCode(['CMP-111111']);
    assert.equal(next1, 'CMP-111112');

    const next2 = generateCompanyCode(['CMP-111111', 'CMP-111112']);
    assert.equal(next2, 'CMP-111113');

    const next3 = getNextCompanyCode(['CMP-111111', 'CMP-111112', 'CMP-111113']);
    assert.equal(next3, 'CMP-111114');
  });

  it('should handle legacy alphanumeric company codes gracefully', () => {
    const legacy = ['CMP-79F297', 'CMP-7707DT', 'CMP-ACTIVE'];
    const code = generateCompanyCode(legacy);
    assert.equal(code, 'CMP-111111');
  });

  it('should handle mixed legacy and sequential codes accurately', () => {
    const mixed = ['CMP-79F297', 'CMP-111111', 'CMP-7707DT', 'CMP-111112'];
    const code = generateCompanyCode(mixed);
    assert.equal(code, 'CMP-111113');
  });

  it('should increment accurately for custom numeric sequences (e.g. CMP-112112)', () => {
    const custom = ['CMP-112112'];
    const code = generateCompanyCode(custom);
    assert.equal(code, 'CMP-112113');
  });

  it('should slugify company legal names cleanly', () => {
    assert.equal(slugifyCompanyName('Himalayan Co-operative Pvt. Ltd.'), 'himalayan-co-operative-pvt');
    assert.equal(slugifyCompanyName('Everest Bank Limited'), 'everest-bank-limited');
    assert.equal(slugifyCompanyName('Nova Finance & Investments'), 'nova-finance-investments');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCompanyCode, slugifyCompanyName } from '../lib/platform/company-code';

describe('Company Code & Slug Generation', () => {
  it('should generate company code in the CMP-DDDDLL format (4 digits, 2 uppercase letters)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCompanyCode();
      assert.match(
        code,
        /^CMP-\d{4}[A-Z]{2}$/,
        `Code ${code} did not match expected format CMP-1111AF`
      );
      assert.equal(code.length, 10);
    }
  });

  it('should produce unique random company codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateCompanyCode());
    }
    // High probability of uniqueness in 100 samples
    assert.ok(codes.size >= 98);
  });

  it('should slugify company legal names cleanly', () => {
    assert.equal(slugifyCompanyName('Himalayan Co-operative Pvt. Ltd.'), 'himalayan-co-operative-pvt');
    assert.equal(slugifyCompanyName('Everest Bank Limited'), 'everest-bank-limited');
    assert.equal(slugifyCompanyName('Nova Finance & Investments'), 'nova-finance-investments');
  });
});

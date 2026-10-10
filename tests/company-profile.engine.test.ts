import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  industryLabel,
  legalChangeIsValid,
  legalChanges,
  normalizeLegalChange,
  normalizeProfileForm,
  profileChanges,
  profileIsValid,
  proposedDetails,
  validateLegalChange,
  validateProfileForm,
} from '../lib/engines/company-profile.engine';
import { setupLegacyRoute } from '../lib/frame/legacy-routes';
import type { CompanyProfileForm, LegalChangeForm, LegalDetails } from '../lib/types/company-setup';

// Company setup (4.12c): the company's own details, a request to change the legal ones, and the
// old Company setup links that open the pages the sections moved to.

const PROFILE: CompanyProfileForm = {
  displayName: 'Demo Sahakari',
  contactEmail: 'info@demo.coop',
  contactPhone: '061-123456',
  signatory1Name: 'Ramesh Shrestha',
  signatory1Title: 'Accounts Officer',
  signatory2Name: 'Sita Sharma',
  signatory2Title: 'Chief Executive Officer',
};
const LEGAL: LegalDetails = { legalName: 'Demo Saving and Credit Cooperative Ltd.', panVatNumber: '601234567', registrationNumber: '1234/074', industryType: 'Cooperatives', headOfficeAddress: 'Pokhara-8, Kaski' };
const ask = (over: Partial<LegalChangeForm> = {}): LegalChangeForm => ({ ...LEGAL, reason: 'Renamed by the Company Registrar on 2083-05-12', reference: 'OCR 2083/84-014', ...over });

describe('the company profile (4.12c)', () => {
  it('the browser form is cleaned: trimmed, the email in lower case, unknown keys dropped', () => {
    assert.deepEqual(normalizeProfileForm({ ...PROFILE, displayName: '  Demo   Sahakari ', contactEmail: ' Info@Demo.COOP ', logoUrl: 'javascript:alert(1)' }), PROFILE);
    assert.deepEqual(normalizeProfileForm(null), { displayName: '', contactEmail: '', contactPhone: '', signatory1Name: '', signatory1Title: '', signatory2Name: '', signatory2Title: '' });
  });

  it('checks: a display name, a real email and phone, a title only with a name', () => {
    assert.deepEqual(validateProfileForm(PROFILE), {});
    assert.equal(validateProfileForm({ ...PROFILE, displayName: '' }).displayName, 'Give the name the company works under.');
    assert.equal(validateProfileForm({ ...PROFILE, contactEmail: 'info@demo' }).contactEmail, 'An email address such as info@company.com.');
    assert.deepEqual(validateProfileForm({ ...PROFILE, contactEmail: '', contactPhone: '' }), {}, 'contacts are optional');
    assert.equal(validateProfileForm({ ...PROFILE, contactPhone: 'call me' }).contactPhone, 'Digits, spaces and + - ( ) only.');
    assert.deepEqual(validateProfileForm({ ...PROFILE, contactPhone: '+977 (61) 123456, 9801234567' }), {});
    assert.equal(validateProfileForm({ ...PROFILE, signatory2Name: '' }).signatory2Name, "Give the person's name too.");
    assert.equal(validateProfileForm({ ...PROFILE, signatory1Title: 'x'.repeat(81) }).signatory1Title, 'At most 80 characters.');
    assert.equal(profileIsValid({}), true);
  });

  it('what changed, in form order', () => {
    assert.deepEqual(profileChanges(PROFILE, PROFILE), []);
    assert.deepEqual(profileChanges(PROFILE, { ...PROFILE, signatory2Title: 'CEO', contactPhone: '061-654321' }), ['contactPhone', 'signatory2Title']);
  });
});

describe('a request to change the legal details (4.12c)', () => {
  it('the browser form is cleaned; the PAN loses its spaces', () => {
    const f = normalizeLegalChange({ ...ask(), legalName: '  Demo  Cooperative ', panVatNumber: ' 601 234 567 ', extra: 'x' });
    assert.equal(f.legalName, 'Demo Cooperative');
    assert.equal(f.panVatNumber, '601234567');
    assert.deepEqual(proposedDetails(f), { legalName: 'Demo Cooperative', panVatNumber: '601234567', registrationNumber: '1234/074', industryType: 'Cooperatives', headOfficeAddress: 'Pokhara-8, Kaski' });
  });

  it('checks: a legal name, a 9-digit PAN, a known industry and a reason', () => {
    assert.deepEqual(validateLegalChange(ask({ legalName: 'Demo Cooperative Ltd.' }), LEGAL), {});
    assert.equal(validateLegalChange(ask({ legalName: '' }), LEGAL).legalName, 'Give the legal name.');
    assert.equal(validateLegalChange(ask({ panVatNumber: '12345' }), LEGAL).panVatNumber, 'A PAN has 9 digits.');
    assert.equal(validateLegalChange(ask({ industryType: 'Banks' }), LEGAL).industryType, 'Choose the industry.');
    assert.equal(validateLegalChange(ask({ legalName: 'X Ltd.', reason: 'renamed' }), LEGAL).reason, "Say why it changes (the registrar's or IRD's decision).");
    assert.equal(legalChangeIsValid({}), true);
  });

  it('something must change', () => {
    assert.equal(validateLegalChange(ask(), LEGAL).legalName, 'Nothing would change: edit the details that changed.');
    assert.deepEqual(legalChanges(LEGAL, { ...LEGAL, panVatNumber: '609999999', headOfficeAddress: 'Pokhara-9' }), ['panVatNumber', 'headOfficeAddress']);
  });

  it('industries in words', () => {
    assert.equal(industryLabel('Cooperatives'), 'Cooperatives (Saving & Multipurpose)');
    assert.equal(industryLabel('General'), 'General / Unclassified Organization');
    assert.equal(industryLabel(''), 'General / Unclassified Organization', 'none stored: General');
    assert.equal(industryLabel('Fisheries'), 'Fisheries', 'an old value as stored');
  });
});

describe('old Company setup links (4.3, 4.12)', () => {
  it('open the page each section moved to', () => {
    assert.equal(setupLegacyRoute('pay_heads'), '/setup/pay-heads');
    assert.equal(setupLegacyRoute('payroll_rules', 'pay-heads'), '/setup/pay-heads');
    assert.equal(setupLegacyRoute('payroll_rules', 'rules-defaults'), '/setup/system-control');
    assert.equal(setupLegacyRoute('payroll_rules'), '/setup/fiscal-year');
    assert.equal(setupLegacyRoute('tax-rates'), '/setup/tax-rates');
    assert.equal(setupLegacyRoute('shreni'), '/workforce/organization?tab=levels');
    assert.equal(setupLegacyRoute(null, 'employment-types'), '/workforce/organization?tab=types');
  });

  it('the company profile and work schedule stay', () => {
    assert.equal(setupLegacyRoute('company_profile'), null);
    assert.equal(setupLegacyRoute('work_schedule'), null);
    assert.equal(setupLegacyRoute(), null);
  });
});

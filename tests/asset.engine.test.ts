import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canIssue, canRetire, normalizeAssetForm, normalizeIssueForm, normalizeReturnForm, statusAfterReturn, validateAssetForm, validateIssueForm, validateReturnForm } from '../lib/engines/asset.engine';

// Assets (G14): register form, issue and return rules.

const TODAY = '2026-10-09';

describe('asset form', () => {
  it('upper-cases the tag and validates it', () => {
    const form = normalizeAssetForm({ tag: ' lap-001 ', name: 'Dell Latitude', category: 'laptop' });
    assert.equal(form.tag, 'LAP-001');
    assert.deepEqual(validateAssetForm(form), {});
    assert.ok(validateAssetForm(normalizeAssetForm({ tag: '!', name: 'x', category: 'boat' })).tag);
  });
});

describe('issue and return', () => {
  it('issues only available assets, never in the future', () => {
    assert.ok(canIssue('available') && !canIssue('issued') && !canIssue('retired'));
    assert.ok(canRetire('available') && !canRetire('issued'));
    assert.deepEqual(validateIssueForm(normalizeIssueForm({ employeeId: 'e1', issuedAd: TODAY }), TODAY), {});
    assert.ok(validateIssueForm(normalizeIssueForm({ employeeId: 'e1', issuedAd: '2026-12-01' }), TODAY).issuedAd);
  });

  it('a return needs a date after issue and a condition; damage or loss needs a note', () => {
    assert.deepEqual(validateReturnForm(normalizeReturnForm({ returnedAd: TODAY, condition: 'good' }), '2026-01-01', TODAY), {});
    assert.ok(validateReturnForm(normalizeReturnForm({ returnedAd: '2025-12-31', condition: 'good' }), '2026-01-01', TODAY).returnedAd);
    assert.ok(validateReturnForm(normalizeReturnForm({ returnedAd: TODAY, condition: 'lost' }), '2026-01-01', TODAY).note);
    assert.ok(validateReturnForm(normalizeReturnForm({ returnedAd: TODAY, condition: 'fine' }), '2026-01-01', TODAY).condition);
  });

  it('lost retires the asset; otherwise it is available again', () => {
    assert.equal(statusAfterReturn('lost'), 'retired');
    assert.equal(statusAfterReturn('damaged'), 'available');
  });
});

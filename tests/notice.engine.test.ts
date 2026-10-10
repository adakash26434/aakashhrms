import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVisible, normalizeNoticeForm, sortForBoard, validateNoticeForm } from '../lib/engines/notice.engine';

// Notice board (G14): form, visibility window and audience, board order.

const rd = (branches: string[] | 'all' = [], departments: string[] | 'all' = [], employeeId: string | null = null) => ({ branches, departments, employeeId });
const TODAY = '2026-10-09';
const n = (over: Partial<Parameters<typeof isVisible>[0]>): Parameters<typeof isVisible>[0] => ({ status: 'published', audience: 'company', branchId: null, departmentId: null, recipientIds: [], publishAd: '2026-10-01', expiresAd: null, pinned: false, ...over });

describe('notice form', () => {
  it('needs title, body and publish date; expiry after publication', () => {
    assert.deepEqual(validateNoticeForm(normalizeNoticeForm({ title: 'Dashain holidays', body: 'Office closed 2083-06-20 to 06-26.', publishAd: TODAY })), {});
    const bad = validateNoticeForm(normalizeNoticeForm({ title: 'x', body: 'y', publishAd: TODAY, expiresAd: '2026-10-01' }));
    assert.ok(bad.title && bad.body && bad.expiresAd);
  });
});

describe('visibility', () => {
  it('published, within the window, to the right audience', () => {
    assert.ok(isVisible(n({}), TODAY, rd()));
    assert.ok(!isVisible(n({ status: 'draft' }), TODAY, rd('all', 'all')));
    assert.ok(!isVisible(n({ publishAd: '2026-10-10' }), TODAY, rd('all', 'all')));
    assert.ok(isVisible(n({ expiresAd: TODAY }), TODAY, rd()));
    assert.ok(!isVisible(n({ expiresAd: '2026-10-08' }), TODAY, rd('all', 'all')));
  });

  it('branch notices reach that branch and company-wide readers only', () => {
    const b = n({ audience: 'branch', branchId: 'b1' });
    assert.ok(isVisible(b, TODAY, rd(['b1'])));
    assert.ok(!isVisible(b, TODAY, rd(['b2'])));
    assert.ok(!isVisible(b, TODAY, rd()));
    assert.ok(isVisible(b, TODAY, rd('all')));
  });

  it('department notices reach that department and company-wide readers only', () => {
    const d = n({ audience: 'department', departmentId: 'd1' });
    assert.ok(isVisible(d, TODAY, rd([], ['d1'])));
    assert.ok(!isVisible(d, TODAY, rd(['b1'], ['d2'])));
    assert.ok(!isVisible(d, TODAY, rd()));
    assert.ok(isVisible(d, TODAY, rd('all', 'all')));
  });

  it('named-employee notices reach only the named, even company-wide readers', () => {
    const e = n({ audience: 'employees', recipientIds: ['e1', 'e2'] });
    assert.ok(isVisible(e, TODAY, rd([], [], 'e2')));
    assert.ok(!isVisible(e, TODAY, rd('all', 'all', 'e9')));
    assert.ok(!isVisible(e, TODAY, rd('all', 'all', null)));
  });

  it('a department notice with no department, or a branch notice with no branch, reaches nobody', () => {
    assert.ok(!isVisible(n({ audience: 'department', departmentId: null }), TODAY, rd('all', 'all')));
    assert.ok(!isVisible(n({ audience: 'branch', branchId: null }), TODAY, rd('all', 'all')));
  });
});

describe('notice audience form', () => {
  it('each audience needs its target', () => {
    const base = { title: 'Fire drill', body: 'Friday 3pm, assemble outside.', publishAd: TODAY };
    assert.ok(validateNoticeForm(normalizeNoticeForm({ ...base, audience: 'branch' })).branchId);
    assert.ok(validateNoticeForm(normalizeNoticeForm({ ...base, audience: 'department' })).departmentId);
    assert.ok(validateNoticeForm(normalizeNoticeForm({ ...base, audience: 'employees', recipientIds: [] })).recipientIds);
    assert.deepEqual(validateNoticeForm(normalizeNoticeForm({ ...base, audience: 'employees', recipientIds: ['e1', 'e1'] })), {});
    assert.deepEqual(normalizeNoticeForm({ ...base, audience: 'employees', recipientIds: ['e1', 'e1'] }).recipientIds, ['e1']);
    assert.equal(normalizeNoticeForm({ ...base, audience: 'bogus' }).audience, 'company');
  });
});

describe('board order', () => {
  it('pinned first, then newest', () => {
    const rows = sortForBoard([
      { id: 'a', pinned: false, publishAd: '2026-10-05' },
      { id: 'b', pinned: true, publishAd: '2026-09-01' },
      { id: 'c', pinned: false, publishAd: '2026-10-08' },
    ]);
    assert.deepEqual(rows.map((r) => r.id), ['b', 'c', 'a']);
  });
});

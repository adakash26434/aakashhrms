import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVisible, normalizeNoticeForm, sortForBoard, validateNoticeForm } from '../lib/engines/notice.engine';

// Notice board (G14): form, visibility window and audience, board order.

const TODAY = '2026-10-09';
const n = (over: Partial<Parameters<typeof isVisible>[0]>): Parameters<typeof isVisible>[0] => ({ status: 'published', branchId: null, publishAd: '2026-10-01', expiresAd: null, pinned: false, ...over });

describe('notice form', () => {
  it('needs title, body and publish date; expiry after publication', () => {
    assert.deepEqual(validateNoticeForm(normalizeNoticeForm({ title: 'Dashain holidays', body: 'Office closed 2083-06-20 to 06-26.', publishAd: TODAY })), {});
    const bad = validateNoticeForm(normalizeNoticeForm({ title: 'x', body: 'y', publishAd: TODAY, expiresAd: '2026-10-01' }));
    assert.ok(bad.title && bad.body && bad.expiresAd);
  });
});

describe('visibility', () => {
  it('published, within the window, to the right audience', () => {
    assert.ok(isVisible(n({}), TODAY, []));
    assert.ok(!isVisible(n({ status: 'draft' }), TODAY, 'all'));
    assert.ok(!isVisible(n({ publishAd: '2026-10-10' }), TODAY, 'all'));
    assert.ok(isVisible(n({ expiresAd: TODAY }), TODAY, []));
    assert.ok(!isVisible(n({ expiresAd: '2026-10-08' }), TODAY, 'all'));
    assert.ok(isVisible(n({ branchId: 'b1' }), TODAY, ['b1']));
    assert.ok(!isVisible(n({ branchId: 'b1' }), TODAY, ['b2']));
    assert.ok(!isVisible(n({ branchId: 'b1' }), TODAY, []));
    assert.ok(isVisible(n({ branchId: 'b1' }), TODAY, 'all'));
  });

  it('pinned first, then newest', () => {
    const rows = sortForBoard([
      { id: 'a', pinned: false, publishAd: '2026-10-05' },
      { id: 'b', pinned: true, publishAd: '2026-09-01' },
      { id: 'c', pinned: false, publishAd: '2026-10-08' },
    ]);
    assert.deepEqual(rows.map((r) => r.id), ['b', 'c', 'a']);
  });
});

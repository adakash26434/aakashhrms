import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dossierChanged, dossierFileIds, normalizeDossier, validateDossier } from '../lib/engines/employee-dossier.engine';

// Employee dossier (4.2c): row normalisation and rules.

const TODAY = '2026-10-09';
const f = (id: string) => ({ id, name: 'x.pdf', size: 10, mime: 'application/pdf' });

describe('dossier normalisation', () => {
  it('drops unknown levels / kinds, trims, caps lists, keeps file refs', () => {
    const d = normalizeDossier({
      qualifications: [{ level: 'kindergarten', degree: ' BBS ', file: f('f1') }],
      workHistory: [{ organisation: 'X Bank', designation: 'Teller', fromAd: '2020-01-01' }],
      attachments: Array.from({ length: 30 }, () => ({ kind: 'certificate', title: 'c', file: f('f2') })),
    });
    assert.equal(d.qualifications[0].level, '');
    assert.equal(d.qualifications[0].degree, 'BBS');
    assert.equal(d.qualifications[0].file?.id, 'f1');
    assert.equal(d.attachments.length, 25);
    assert.deepEqual(dossierFileIds(d).slice(0, 2), ['f1', 'f2']);
  });
});

describe('dossier rules', () => {
  it('qualification needs level + degree; year is four digits', () => {
    const e = validateDossier(normalizeDossier({ qualifications: [{ level: '', degree: 'B', passedYear: '78' }] }), { today: TODAY });
    assert.ok(e['qualifications.0.level'] && e['qualifications.0.degree'] && e['qualifications.0.passedYear']);
    assert.deepEqual(validateDossier(normalizeDossier({ qualifications: [{ level: 'bachelor', degree: 'BBS', passedYear: '2078' }] }), { today: TODAY }), {});
  });

  it('past employment: dates in order, in the past, ending before joining here; no duplicates', () => {
    const base = { organisation: 'X Bank', designation: 'Teller', fromAd: '2020-01-01', toAd: '2022-01-01' };
    assert.deepEqual(validateDossier(normalizeDossier({ workHistory: [base] }), { today: TODAY, joiningDate: '2023-01-01' }), {});
    assert.ok(validateDossier(normalizeDossier({ workHistory: [{ ...base, toAd: '2019-01-01' }] }), { today: TODAY })['workHistory.0.toAd']);
    assert.ok(validateDossier(normalizeDossier({ workHistory: [{ ...base, toAd: '2024-01-01' }] }), { today: TODAY, joiningDate: '2023-01-01' })['workHistory.0.toAd']);
    assert.ok(validateDossier(normalizeDossier({ workHistory: [base, base] }), { today: TODAY })['workHistory.1.organisation']);
  });

  it('attachment needs kind, title and a file', () => {
    const e = validateDossier(normalizeDossier({ attachments: [{ kind: '', title: '' }] }), { today: TODAY });
    assert.ok(e['attachments.0.kind'] && e['attachments.0.title'] && e['attachments.0.file']);
  });

  it('change detection compares rows by content and file id', () => {
    const a = normalizeDossier({ attachments: [{ kind: 'other', title: 'T', file: f('f1') }] });
    const b = normalizeDossier({ attachments: [{ kind: 'other', title: 'T', file: { ...f('f1'), name: 'renamed.pdf' } }] });
    const c = normalizeDossier({ attachments: [{ kind: 'other', title: 'T', file: f('f9') }] });
    assert.ok(!dossierChanged(a, b));
    assert.ok(dossierChanged(a, c));
  });
});

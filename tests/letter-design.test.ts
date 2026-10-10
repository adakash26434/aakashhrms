import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DESIGN, DEFAULT_KIND_LAYOUTS, LOGO_MAX_CHARS, kindLayout, normalizeDesign, validateDesign } from '../lib/engines/letter-design.engine';
import { LETTER_KINDS } from '../lib/engines/letter.engine';

// Letter design: a company's look for its letters, always cleaned to a safe, complete value.

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('letter design', () => {
  it('anything unknown falls back to the default', () => {
    assert.deepEqual(normalizeDesign(null), DEFAULT_DESIGN);
    assert.deepEqual(normalizeDesign({ headerAlign: 'right', fontSize: 'huge', margin: 7, ruleStyle: {} }), DEFAULT_DESIGN);
  });

  it('keeps valid choices and trims and caps the free text', () => {
    const d = normalizeDesign({ headerAlign: 'left', fontSize: 'lg', lineSpacing: 'relaxed', margin: 'wide', subjectStyle: 'bold', showRegNo: true, headerNote: `  ${'x'.repeat(400)}  `, footerText: ' Thank you ' });
    assert.equal(d.headerAlign, 'left');
    assert.equal(d.fontSize, 'lg');
    assert.equal(d.margin, 'wide');
    assert.equal(d.showRegNo, true);
    assert.equal(d.headerNote.length, 200);
    assert.equal(d.footerText, 'Thank you');
  });

  it('accepts only a small PNG / JPEG data URL as the logo', () => {
    assert.equal(normalizeDesign({ logoDataUrl: PNG }).logoDataUrl, PNG);
    assert.equal(normalizeDesign({ logoDataUrl: 'https://evil.example/x.png' }).logoDataUrl, '');
    assert.equal(normalizeDesign({ logoDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }).logoDataUrl, '');
    assert.equal(normalizeDesign({ logoDataUrl: `data:image/png;base64,${'A'.repeat(LOGO_MAX_CHARS)}` }).logoDataUrl, '');
    assert.ok(validateDesign({ logoDataUrl: 'javascript:alert(1)' }).logoDataUrl);
    assert.deepEqual(validateDesign({ logoDataUrl: PNG }), {});
  });

  it('signature blocks: known boxes only, at most six', () => {
    const d = normalizeDesign({ kinds: { agreement: { showRecipient: false, blocks: ['signatory', 'bogus', 'witness', 'witness', 'witness', 'witness', 'witness', 'witness'] } } });
    assert.deepEqual(d.kinds.agreement.blocks, ['signatory', 'witness', 'witness', 'witness', 'witness', 'witness']);
    assert.ok(validateDesign({ kinds: { agreement: { blocks: new Array(7).fill('witness') } } })['kinds.agreement']);
    assert.deepEqual(Object.keys(normalizeDesign({ kinds: { 'Bad Code!': { blocks: [] } } }).kinds), []);
  });

  it('every letter kind has a layout; unknown kinds get the plain addressed letter', () => {
    for (const k of LETTER_KINDS) assert.ok(DEFAULT_KIND_LAYOUTS[k.code], k.code);
    assert.deepEqual(kindLayout(DEFAULT_DESIGN, 'dhanjamani').blocks, ['guarantor', 'employee', 'witness', 'signatory']);
    assert.deepEqual(kindLayout(DEFAULT_DESIGN, 'warning_letter'), { showRecipient: true, blocks: ['received', 'signatory'] });
    assert.deepEqual(kindLayout({ ...DEFAULT_DESIGN, kinds: { noc: { showRecipient: true, blocks: ['employee'] } } }, 'noc').blocks, ['employee']);
  });
});

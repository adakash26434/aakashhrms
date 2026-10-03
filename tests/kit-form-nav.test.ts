import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { enterIntent, isEnterStop, selectsOnArrival, stepFieldIndex } from '../lib/kit/form-nav';
import { filterOptions, moveHighlight, typeaheadIndex } from '../lib/kit/combobox';
import { dayToIso, isoToDay, isoToDisplay, monthLayout, shiftIsoDays, shiftIsoMonths } from '../lib/kit/date-field';
import { placePopup } from '../lib/kit/popup';

const key = (k: Partial<Parameters<typeof enterIntent>[0]> = {}) => ({ key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...k });
const input = (type = 'text') => ({ tagName: 'INPUT', type });

describe('Enter navigation (4.2)', () => {
  it('Enter moves on from inputs, selects and checkboxes; Shift+Enter goes back', () => {
    assert.equal(enterIntent(key(), input()), 'next');
    assert.equal(enterIntent(key(), input('checkbox')), 'next');
    assert.equal(enterIntent(key(), { tagName: 'SELECT' }), 'next');
    assert.equal(enterIntent(key({ shiftKey: true }), input()), 'prev');
    assert.equal(enterIntent(key({ shiftKey: true }), { tagName: 'SELECT' }), 'prev');
  });

  it('leaves buttons, links, action inputs and other keys alone', () => {
    assert.equal(enterIntent(key(), { tagName: 'BUTTON' }), null);
    assert.equal(enterIntent(key(), { tagName: 'A' }), null);
    assert.equal(enterIntent(key(), input('submit')), null);
    assert.equal(enterIntent(key(), input('file')), null);
    assert.equal(enterIntent(key({ key: 'Tab' }), input()), null);
    assert.equal(enterIntent(key({ altKey: true }), input()), null);
    assert.equal(enterIntent(key({ ctrlKey: true }), input()), null);
  });

  it('textarea keeps Enter for new lines; Ctrl+Enter moves on', () => {
    assert.equal(enterIntent(key(), { tagName: 'TEXTAREA' }), null);
    assert.equal(enterIntent(key({ ctrlKey: true }), { tagName: 'TEXTAREA' }), 'next');
    assert.equal(enterIntent(key({ metaKey: true, shiftKey: true }), { tagName: 'TEXTAREA' }), 'prev');
  });

  it('does not act during IME composition or after a control handled the key', () => {
    assert.equal(enterIntent(key({ isComposing: true }), input()), null);
    assert.equal(enterIntent(key({ defaultPrevented: true }), input()), null);
  });

  it('steps between fields without wrapping', () => {
    assert.equal(stepFieldIndex(3, 0, 'next'), 1);
    assert.equal(stepFieldIndex(3, 2, 'next'), -1);
    assert.equal(stepFieldIndex(3, 0, 'prev'), -1);
    assert.equal(stepFieldIndex(3, -1, 'next'), -1);
    assert.equal(stepFieldIndex(0, 0, 'next'), -1);
  });

  it('skips read-only, disabled, hidden and helper controls', () => {
    assert.equal(isEnterStop({ visible: true }), true);
    assert.equal(isEnterStop({ visible: true, readOnly: true }), false);
    assert.equal(isEnterStop({ visible: true, disabled: true }), false);
    assert.equal(isEnterStop({ visible: true, skip: true }), false);
    assert.equal(isEnterStop({ visible: false }), false);
  });

  it('selects text on arrival only for typed fields', () => {
    assert.equal(selectsOnArrival('text'), true);
    assert.equal(selectsOnArrival('email'), true);
    assert.equal(selectsOnArrival('checkbox'), false);
    assert.equal(selectsOnArrival('date'), false);
  });

  it('PropertyForm never submits on Enter when navigation is on', () => {
    const hook = readFileSync(join(__dirname, '..', 'components/kit/use-enter-navigation.ts'), 'utf8');
    assert.match(hook, /Enter never submits the form[\s\S]*e\.preventDefault\(\)/);
  });
});

describe('Combobox filtering (4.2)', () => {
  const options = [
    { value: 'ktm', label: 'Kathmandu', hint: 'काठमाडौं' },
    { value: 'lal', label: 'Lalitpur' },
    { value: 'nk', label: 'Nuwakot', keywords: 'bagmati' },
    { value: 'east', label: 'East Kathmandu Branch' },
  ];

  it('ranks prefix, then word start, then anywhere', () => {
    assert.deepEqual(filterOptions(options, 'kath').map((o) => o.value), ['ktm', 'east']);
    assert.deepEqual(filterOptions(options, 'tpu').map((o) => o.value), ['lal']);
    assert.deepEqual(filterOptions(options, 'BAGMATI').map((o) => o.value), ['nk']);
    assert.deepEqual(filterOptions(options, 'काठ').map((o) => o.value), ['ktm']);
  });

  it('returns everything for an empty query, up to the limit', () => {
    assert.equal(filterOptions(options, '  ').length, 4);
    assert.equal(filterOptions(options, '', 2).length, 2);
  });

  it('wraps the highlight with the arrow keys', () => {
    assert.equal(moveHighlight(3, -1, 1), 0);
    assert.equal(moveHighlight(3, -1, -1), 2);
    assert.equal(moveHighlight(3, 2, 1), 0);
    assert.equal(moveHighlight(3, 0, -1), 2);
    assert.equal(moveHighlight(0, 0, 1), -1);
  });
});

describe('Date field (4.2)', () => {
  it('shows a stored AD date in BS or AD and converts back', () => {
    // 2083/04/01 BS (Shrawan 1) is 2026-07-17 AD.
    assert.equal(isoToDisplay('2026-07-17', true), '2083/04/01');
    assert.equal(isoToDisplay('2026-07-17', false), '2026/07/17');
    assert.equal(dayToIso({ year: 2083, month: 4, day: 1 }, true), '2026-07-17');
    assert.deepEqual(isoToDay('2026-07-17', true), { year: 2083, month: 4, day: 1 });
    assert.equal(isoToDisplay('', true), '');
  });

  it('rejects days that do not exist', () => {
    assert.equal(dayToIso({ year: 2026, month: 2, day: 30 }, false), null);
    assert.equal(dayToIso({ year: 2083, month: 13, day: 1 }, true), null);
    assert.equal(dayToIso({ year: 2083, month: 4, day: 40 }, true), null);
  });

  it('moves by days and by months, clamping to short months', () => {
    assert.equal(shiftIsoDays('2026-07-17', -1), '2026-07-16');
    assert.equal(shiftIsoDays('2026-07-17', 7), '2026-07-24');
    assert.equal(shiftIsoMonths('2026-01-31', 1, false), '2026-02-28');
    assert.equal(isoToDisplay(shiftIsoMonths('2026-07-17', 1, true), true), '2083/05/01');
  });

  it('lays out a month grid', () => {
    assert.deepEqual(monthLayout(2026, 2, false), { days: 28, firstWeekday: 0 });
    const bs = monthLayout(2083, 4, true);
    assert.ok(bs.days >= 29 && bs.days <= 32);
    assert.equal(bs.firstWeekday, new Date(2026, 6, 17).getDay());
  });
});

describe('Form kit hardening (4.2 review)', () => {
  it('custom controls marked data-enter-field behave like inputs for Enter', () => {
    assert.equal(enterIntent(key(), { tagName: 'BUTTON', type: 'button', enterField: true }), 'next');
    assert.equal(enterIntent(key({ shiftKey: true }), { tagName: 'BUTTON', type: 'button', enterField: true }), 'prev');
    assert.equal(enterIntent(key(), { tagName: 'BUTTON', type: 'button' }), null);
  });

  it('dropdown type-ahead jumps and cycles like Windows lists', () => {
    const labels = ['Single', 'Married (couple slab)', 'Widow / widower'];
    assert.equal(typeaheadIndex(labels, 'w', -1), 2);
    assert.equal(typeaheadIndex(labels, 'm', 0), 1);
    assert.equal(typeaheadIndex(labels, 'ma', 1), 1);
    assert.equal(typeaheadIndex(['Bank A', 'Bank B', 'City'], 'b', 0), 1);
    assert.equal(typeaheadIndex(['Bank A', 'Bank B', 'City'], 'bb', 1), 0);
    assert.equal(typeaheadIndex(labels, 'z', 0), -1);
  });

  it('dates outside the calendar range never throw (they used to crash the form)', () => {
    for (const iso of ['0205-01-01', '1850-01-01', '2100-01-01', '1900-05-05']) {
      assert.doesNotThrow(() => isoToDisplay(iso, true));
      assert.equal(isoToDisplay(iso, true), '');
      assert.equal(isoToDay(iso, true), null);
    }
    assert.equal(dayToIso({ year: 205, month: 1, day: 1 }, true), null);
    assert.equal(dayToIso({ year: 2150, month: 1, day: 1 }, false), null);
    assert.doesNotThrow(() => monthLayout(1900, 1, true));
    assert.doesNotThrow(() => shiftIsoMonths('2042-12-31', 1, true));
  });

  it('a form grid keeps one element tree with or without a suffix (no remount, no lost focus)', () => {
    const grid = readFileSync(join(__dirname, '..', 'components/kit/form-grid.tsx'), 'utf8');
    assert.match(grid, /Same element tree with or without a suffix/);
    assert.ok(!/suffix \? \(\s*<div className="flex/.test(grid));
  });
});

describe('Form legibility (4.2 polish)', () => {
  const css = readFileSync(join(__dirname, '..', 'app/globals.css'), 'utf8');
  const token = (name: string) => {
    const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
    assert.ok(m, `--${name} must be a hex colour`);
    return m![1];
  };
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('editable field outlines meet the 3:1 non-text contrast rule (WCAG 1.4.11) on white and on the dialog panel', () => {
    assert.ok(contrast(token('border-input'), '#FFFFFF') >= 3, 'against white');
    assert.ok(contrast(token('border-input'), token('surface-panel')) >= 3, 'against the grey panel');
  });

  it('the shared input style uses the input outline, and read-only styling never applies to buttons', () => {
    const form = readFileSync(join(__dirname, '..', 'components/kit/property-form.tsx'), 'utf8');
    assert.match(form, /border-line-input/);
    assert.ok(!/ read-only:/.test(form), 'read-only variants must be scoped with [&:not(button):read-only]');
  });

  it('the date field keeps one element tree (the hint line is absolutely placed, never wrapping the input)', () => {
    const field = readFileSync(join(__dirname, '..', 'components/kit/date-field.tsx'), 'utf8');
    assert.match(field, /pb-4 keeps room for the equivalent line/);
    assert.match(field, /absolute bottom-0 right-0/);
  });
});

describe('Pop-up placement (4.3 review)', () => {
  const vp = { width: 1300, height: 560 };
  const field = (top: number, left = 300, width = 200) => ({ top, bottom: top + 30, left, right: left + width, width });

  it('opens below the field when the list fits', () => {
    const p = placePopup(field(100), vp, { height: 230, matchWidth: true });
    assert.equal(p.above, false);
    assert.equal(p.top, 134);
    assert.equal(p.width, 200);
  });

  it('opens above when it does not fit below and there is more room above (a short list sits right on the field)', () => {
    const p = placePopup(field(390), vp, { height: 310 });
    assert.equal(p.above, true);
    assert.equal(p.bottom, 560 - 390 + 4);
    assert.ok(p.maxHeight <= 390 - 12);
  });

  it("near the right edge, lines up with the field's right edge so it stays on screen", () => {
    const p = placePopup(field(100, 1106, 142), vp, { height: 200, matchWidth: true, maxWidth: 384 });
    assert.equal(p.left, undefined);
    assert.equal(p.right, 1300 - 1248);
    const q = placePopup(field(100, 300, 142), vp, { height: 200, matchWidth: true, maxWidth: 384 });
    assert.equal(q.left, 300);
  });

  it('every kit pop-up uses it, so a scrolling Window never clips a list', () => {
    for (const file of ['combobox.tsx', 'select-field.tsx', 'phone-field.tsx', 'date-field.tsx']) {
      const src = readFileSync(join(__dirname, '..', 'components/kit', file), 'utf8');
      assert.match(src, /usePopupPosition\(/, file);
      assert.ok(!/absolute (left-0 )?(right-0 )?top-full/.test(src), `${file} has no clipped absolute pop-up`);
    }
  });
});

describe('English-only screens (design system §7 "Language")', () => {
  it('the redesigned Organization and Employee screens show no Nepali text', () => {
    const dirs = ['components/organization', 'components/employee'];
    const files = dirs.flatMap((d) => readdirSync(join(__dirname, '..', d)).map((f) => `${d}/${f}`)).concat(['components/kit/address-field.tsx', 'lib/engines/organization.engine.ts']);
    for (const file of files) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      assert.ok(!/[ऀ-ॿ]/.test(src), `${file} contains Devanagari`);
      assert.ok(!/hint: [a-z.]*(nameNepali|labelNepali)/.test(src), `${file} shows a Nepali hint`);
    }
  });
});

describe('Layout follows the space the form has (4.3 review: side panel open)', () => {
  const grid = readFileSync(join(__dirname, '..', 'components/kit/form-grid.tsx'), 'utf8');

  it('form columns and label placement use container queries, not screen breakpoints', () => {
    assert.match(grid, /@container/);
    assert.match(grid, /@min-\[50rem\]:grid-cols-2/);
    assert.match(grid, /@min-\[76rem\]:grid-cols-3/);
    assert.ok(!/\b(sm|md|lg|xl):grid-cols-/.test(grid), 'no screen-width column rules in the form grid');
  });

  it('the editor puts the section index beside the form only when there is room for it', () => {
    const editor = readFileSync(join(__dirname, '..', 'components/employee/employee-form.tsx'), 'utf8');
    const index = readFileSync(join(__dirname, '..', 'components/kit/section-index.tsx'), 'utf8');
    assert.match(editor, /@min-\[66rem\]:grid-cols-\[196px_minmax\(0,1fr\)\]/);
    assert.match(index, /@min-\[66rem\]:hidden/);
  });
});

describe('Module rail (4.3 review)', () => {
  const rail = readFileSync(join(__dirname, '..', 'components/frame/module-rail.tsx'), 'utf8');
  const frame = readFileSync(join(__dirname, '..', 'components/frame/app-frame.tsx'), 'utf8');

  it('a module with several pages opens its page list instead of jumping to its first page', () => {
    assert.match(rail, /single \?[\s\S]*<Link[\s\S]*: \([\s\S]*<button[\s\S]*onSelectModule\(module\)/);
    assert.match(frame, /const selectModule = useCallback/);
    assert.ok(!/router\.push\(target\.sections\[0\]\.href\)/.test(frame), 'Alt+N no longer jumps to the first page');
  });
});

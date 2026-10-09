import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ESS_KEYS, asEssLang, t } from '../lib/i18n/ess';

// Self-service language (G12): every key has both languages, non-empty and distinct.

describe('ESS dictionary', () => {
  it('every key has English and Nepali text', () => {
    for (const key of ESS_KEYS) {
      assert.ok(t('en', key).trim().length > 0, `${key} en`);
      assert.ok(t('np', key).trim().length > 0, `${key} np`);
      assert.match(t('np', key), /[ऀ-ॿ]/, `${key} np is Devanagari`);
    }
  });

  it('unknown languages fall back to English', () => {
    assert.equal(asEssLang('fr'), 'en');
    assert.equal(asEssLang('np'), 'np');
    assert.equal(t(asEssLang(undefined), 'nav.home'), 'Home');
  });
});

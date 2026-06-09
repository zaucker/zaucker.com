import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('t', () => {
  it('returns the German string for a key', () => {
    expect(t('de', 'nav_details')).toBe('Details');
  });
  it('returns the English string for a key', () => {
    expect(t('en', 'nav_details')).toBe('Details');
  });
  it('returns a localized feature label', () => {
    expect(t('de', 'feat_wifi')).toBe('WLAN (kostenlos)');
    expect(t('en', 'feat_wifi')).toBe('Wi-Fi (free)');
  });
  it('falls back to the key when missing', () => {
    expect(t('de', 'does_not_exist')).toBe('does_not_exist');
  });
});

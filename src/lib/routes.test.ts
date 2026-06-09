import { describe, it, expect } from 'vitest';
import { pagePath, apartmentPath, getNav, alternatePageKey, PAGE_ROUTES } from './routes';
import { getApartment } from './apartments';

describe('routes', () => {
  it('resolves localized page paths', () => {
    expect(pagePath('de', 'home')).toBe('/');
    expect(pagePath('en', 'home')).toBe('/en/');
    expect(pagePath('de', 'availability')).toBe('/verfuegbarkeit');
    expect(pagePath('en', 'availability')).toBe('/en/availability');
  });
  it('resolves apartment paths by locale slug', () => {
    const dg = getApartment('4_zi_dg')!;
    expect(apartmentPath('de', dg)).toBe('/dachgeschoss');
    expect(apartmentPath('en', dg)).toBe('/en/penthouse');
  });
  it('builds an ordered nav including visible apartments', () => {
    const labels = getNav('de').map(i => i.label);
    expect(labels).toEqual(['4 Zi DG', '3 Zi UG', 'Fotos', 'Verfügbarkeit', 'Kontakt', 'Infos']);
    expect(getNav('de')[0].href).toBe('/dachgeschoss');
  });
  it('maps page keys for the language switch', () => {
    expect(alternatePageKey('availability')).toBe('availability');
    expect(PAGE_ROUTES.impressum.en).toBeNull();
  });
});

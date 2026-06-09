import { describe, it, expect } from 'vitest';
import {
  getApartments, getVisibleApartments, getApartment, getApartmentBySlug,
} from './apartments';

describe('apartments data access', () => {
  it('loads all three apartments sorted by order', () => {
    const all = getApartments();
    expect(all.map(a => a.id)).toEqual(['4_zi_dg', '3_zi_ug', '3_zi_eg']);
  });
  it('excludes hidden apartments from the visible list', () => {
    expect(getVisibleApartments().map(a => a.id)).toEqual(['4_zi_dg', '3_zi_ug']);
  });
  it('looks up by id', () => {
    expect(getApartment('4_zi_dg')?.slug.en).toBe('penthouse');
    expect(getApartment('nope')).toBeUndefined();
  });
  it('looks up by localized slug', () => {
    expect(getApartmentBySlug('de', 'gartenwohnung')?.id).toBe('3_zi_ug');
    expect(getApartmentBySlug('en', 'penthouse')?.id).toBe('4_zi_dg');
    expect(getApartmentBySlug('de', 'penthouse')).toBeUndefined();
  });
  it('parses pricing seasons', () => {
    const dg = getApartment('4_zi_dg')!;
    expect(dg.pricing.seasons[0]).toEqual({ name_key: 'season_high', rate_per_day: 165 });
  });
});

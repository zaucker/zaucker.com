import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { Apartment, Locale } from './types';

const dir = fileURLToPath(new URL('../data/apartments/', import.meta.url));

const APARTMENTS: Apartment[] = readdirSync(dir)
  .filter(f => f.endsWith('.yaml'))
  .map(f => {
    const parsed = yaml.load(readFileSync(dir + f, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`Invalid YAML in ${f}`);
    }
    return parsed as Apartment;
  })
  .sort((a, b) => a.order - b.order);

export function getApartments(): Apartment[] {
  return APARTMENTS;
}
export function getVisibleApartments(): Apartment[] {
  return APARTMENTS.filter(a => !a.hidden);
}
export function getApartment(id: string): Apartment | undefined {
  return APARTMENTS.find(a => a.id === id);
}
export function getApartmentBySlug(locale: Locale, slug: string): Apartment | undefined {
  return APARTMENTS.find(a => a.slug[locale] === slug);
}

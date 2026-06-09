import yaml from 'js-yaml';
import type { Apartment, Locale } from './types';

// Eager-import all apartment YAML files so Vite inlines them at build time.
// This avoids fs.readdirSync path issues during Astro's prerender phase.
const YAML_FILES = import.meta.glob<{ default: string }>(
  '/src/data/apartments/*.yaml',
  { eager: true, query: '?raw', import: 'default' },
);

const APARTMENTS: Apartment[] = Object.entries(YAML_FILES)
  .map(([, raw]) => {
    const parsed = yaml.load(raw as string);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid YAML in apartment data');
    }
    const apt = parsed as Apartment;
    if (typeof apt.id !== 'string' || typeof apt.order !== 'number') {
      throw new Error(`Apartment YAML is missing required fields id/order`);
    }
    return apt;
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

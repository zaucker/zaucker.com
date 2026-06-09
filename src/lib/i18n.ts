import yaml from 'js-yaml';
import type { Locale } from './types';

// Eager-import YAML files so Vite inlines them at build time.
const YAML_FILES = import.meta.glob<{ default: string }>(
  '/src/i18n/*.yaml',
  { eager: true, query: '?raw', import: 'default' },
);

function load(locale: Locale): Record<string, string> {
  const raw = YAML_FILES[`/src/i18n/${locale}.yaml`];
  if (!raw) throw new Error(`i18n: ${locale}.yaml not found`);
  const parsed = yaml.load(raw as string);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`i18n: ${locale}.yaml did not parse to a mapping`);
  }
  return parsed as Record<string, string>;
}

const STRINGS: Record<Locale, Record<string, string>> = {
  de: load('de'),
  en: load('en'),
};

/** Translate a key for a locale; returns the key itself if missing. */
export function t(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? key;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { Locale } from './types';

function load(locale: Locale): Record<string, string> {
  const path = fileURLToPath(new URL(`../i18n/${locale}.yaml`, import.meta.url));
  return yaml.load(readFileSync(path, 'utf8')) as Record<string, string>;
}

const STRINGS: Record<Locale, Record<string, string>> = {
  de: load('de'),
  en: load('en'),
};

/** Translate a key for a locale; returns the key itself if missing. */
export function t(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? key;
}

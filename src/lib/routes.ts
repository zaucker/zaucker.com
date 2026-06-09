import type { Apartment, Locale } from './types';
import { getVisibleApartments } from './apartments';
import { t } from './i18n';

export type PageKey =
  | 'home' | 'availability' | 'contact' | 'infos'
  | 'impressum' | 'datenschutz';

/** Localized path for each static page. `en: null` = German-only page. */
export const PAGE_ROUTES: Record<PageKey, { de: string; en: string | null }> = {
  home:        { de: '/',               en: '/en/' },
  availability:{ de: '/verfuegbarkeit', en: '/en/availability' },
  contact:     { de: '/kontakt',        en: '/en/contact' },
  infos:       { de: '/infos',          en: '/en/infos' },
  impressum:   { de: '/impressum',      en: null },
  datenschutz: { de: '/datenschutz',    en: null },
};

export function pagePath(locale: Locale, key: PageKey): string {
  const p = PAGE_ROUTES[key][locale];
  if (p === null) return PAGE_ROUTES[key].de; // legal pages: always the German URL
  return p;
}

export function apartmentPath(locale: Locale, apt: Apartment): string {
  return locale === 'en' ? `/en/${apt.slug.en}` : `/${apt.slug.de}`;
}

export interface NavItem { label: string; href: string }

/** Header nav: visible apartments first, then Availability, Contact, Infos. */
export function getNav(locale: Locale): NavItem[] {
  const apts = getVisibleApartments().map(a => ({
    label: a.nav_label[locale],
    href: apartmentPath(locale, a),
  }));
  return [
    ...apts,
    { label: t(locale, 'nav_availability_short'), href: pagePath(locale, 'availability') },
    { label: t(locale, 'nav_contact_short'),      href: pagePath(locale, 'contact') },
    { label: t(locale, 'nav_infos'),              href: pagePath(locale, 'infos') },
  ];
}

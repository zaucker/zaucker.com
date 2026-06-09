// src/lib/types.ts
export type Locale = 'de' | 'en';

export interface Apartment {
  id: string;                 // e.g. "4_zi_dg"
  traumfw_id: string;
  hidden: boolean;
  name_key: string;           // i18n key, e.g. "apt_4zidg_name"
  order: number;              // sort order on listings
  slug: Record<Locale, string>;       // { de: "dachgeschoss", en: "penthouse" }
  nav_label: Record<Locale, string>;  // { de: "4 Zi DG", en: "3 bedroom" }
  specs: { rooms: number; bedrooms: number; max_guests: number; area_m2?: number };
  features: Record<string, { key: string }[]>;  // kitchen/bathroom/living/family/service
  pricing: {
    currency: string; extra_guest_per_day: number; linen_per_bed: number;
    cleaning_fee: number; deposit: number;
    seasons: { name_key: string; rate_per_day: number }[];
  };
  minimum_stay: { season_key: string; nights: number }[];
  city_tax: { apr_oct_per_person_per_day: number; nov_mar_per_person_per_day: number };
}

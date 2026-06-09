import type { ImageMetadata } from 'astro';

// Eager-import every apartment image so astro:assets can optimize it.
const FILES = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/apartments/**/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

/** Returns optimized image metadata for an apartment id, sorted by filename. */
export function apartmentImages(apartmentId: string): ImageMetadata[] {
  return Object.entries(FILES)
    .filter(([path]) => path.includes(`/apartments/${apartmentId}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, mod]) => mod.default);
}

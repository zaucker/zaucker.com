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

// Eager-import the homepage gallery images so astro:assets can optimize them.
const HOME_FILES = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/home/gallery/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

/** Returns optimized homepage gallery image metadata, sorted by filename. */
export function homeImages(): ImageMetadata[] {
  return Object.entries(HOME_FILES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, mod]) => mod.default);
}

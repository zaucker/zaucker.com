import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    // Optional icon + text intro list (used on the homepage)
    intro: z.array(z.object({ icon: z.string(), text: z.string() })).optional(),
  }),
});

export const collections = { pages };

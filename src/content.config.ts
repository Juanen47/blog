import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      tags: z.array(z.string()).optional(),
      draft: z.boolean().default(false),
      // Serie a la que pertenece el artículo y su posición (1, 2, 3...).
      series: z.string().optional(),
      seriesOrder: z.number().int().positive().optional(),
      // Artículo destacado en la portada del blog («Empieza por aquí»).
      featured: z.boolean().default(false),
    }),
});

export const collections = { blog };
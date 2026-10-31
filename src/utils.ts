import { getCollection, type CollectionEntry } from 'astro:content';

/** Minutos de lectura estimados (mínimo 1) a ~200 palabras por minuto. */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Artículos publicados (sin borradores en producción), del más reciente al más antiguo. */
export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.data.title.localeCompare(b.data.title, 'es'),
  );
}

/** Slug de URL para una etiqueta: minúsculas, sin tildes ni espacios. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Etiquetas con su número de artículos, de la más usada a la menos. */
export function countTags(posts: CollectionEntry<'blog'>[]): { tag: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  posts.forEach((p) => p.data.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return [...counts]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'es'));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

export const SERIES_SLUGS: Record<string, string> = { 'El homelab desde cero': 'el-homelab-desde-cero' };

/** Artículos de una serie, en su orden. */
export function seriesPosts(posts: CollectionEntry<'blog'>[], name: string): CollectionEntry<'blog'>[] {
  return posts
    .filter((p) => p.data.series === name)
    .sort((a, b) => (a.data.seriesOrder ?? 99) - (b.data.seriesOrder ?? 99));
}

/** Hasta `n` artículos relacionados: los que más etiquetas comparten y, a igualdad, los más recientes. */
export function relatedPosts(post: CollectionEntry<'blog'>, posts: CollectionEntry<'blog'>[], n = 3): CollectionEntry<'blog'>[] {
  const mine = new Set(post.data.tags ?? []);
  return posts
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: (p.data.tags ?? []).filter((t) => mine.has(t)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.pubDate.valueOf() - a.p.data.pubDate.valueOf())
    .slice(0, n)
    .map(({ p }) => p);
}

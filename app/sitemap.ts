import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!origin || !/^https:\/\//i.test(origin)) return [];
  const products = await getProducts();
  return [
    { url: origin, changeFrequency: 'daily', priority: 1 },
    ...products.map(product => ({
      url: `${origin}/produto/${encodeURIComponent(product.slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}

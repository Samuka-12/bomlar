import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const hasHttpsSite = Boolean(site && /^https:\/\//i.test(site));
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/checkout'] }],
    ...(hasHttpsSite ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}

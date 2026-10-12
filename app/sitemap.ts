import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE = 'https://jacktradesnq.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/prop-firms/`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/mentions-legales/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/politique-confidentialite/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}

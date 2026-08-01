import type { MetadataRoute } from 'next';
import { getAllEntries } from '@/lib/studies';

export const dynamic = 'force-static';

const BASE = 'https://jacktradesnq.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/studies/`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/prop-firms/`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/prop-firms/cfd/`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/mentions-legales/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/politique-confidentialite/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
  const studyRoutes: MetadataRoute.Sitemap = getAllEntries().map((entry) => ({
    url: `${BASE}/studies/${entry.slug}/`,
    lastModified: new Date(entry.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  return [...staticRoutes, ...studyRoutes];
}

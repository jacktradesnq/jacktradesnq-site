import firmsData from '@/public/data/prop-firms.json';
import promosData from '@/public/data/live-promos.json';
import perpsData from '@/public/data/perps-firms.json';

/**
 * Every outbound partner link leaves through /go/<source>/<firm>/ instead of
 * pointing straight at the firm. The hop costs a redirect, and buys the only
 * thing the site could not answer before: which partner gets clicked, from
 * which page. Cloudflare Web Analytics counts page views, not clicks, so a
 * counted click has to be a page.
 *
 * The source segment is deliberate — the same firm clicked from /prop-firms/
 * and from /promos/ are two different questions.
 */
export type GoLink = {
  source: 'prop-firms' | 'promos' | 'trade-copier';
  firmId: string;
  firmName: string;
  url: string;
};

const fromFirms: GoLink[] = firmsData.firms.map((f) => ({
  source: 'prop-firms' as const,
  firmId: f.id,
  firmName: f.name,
  url: f.url,
}));

// The daily sync can leave no promo running (21/10/2026): an empty array types as never[],
// so the shape is spelled out here.
type LivePromo = { firmId: string; firmName: string; url: string };
const fromPromos: GoLink[] = (promosData.promos as LivePromo[]).map((p) => ({
  source: 'promos' as const,
  firmId: p.firmId,
  firmName: p.firmName,
  url: p.url,
}));

// A firm runs at most one promo at a time, so one page per (source, firm).
// Perpetuals firms live in their own block under the futures table, same source.
const fromPerps: GoLink[] = perpsData.firms.map((f) => ({
  source: 'prop-firms' as const,
  firmId: f.id,
  firmName: f.name,
  url: f.url,
}));

// The trade copier Angelo uses, linked from /trade-copier/. No Tradecopia affiliate link
// is known yet (13/10/2026), so it points at the plain site and the page shows code JTNQ.
const fromTradeCopier: GoLink[] = [
  { source: 'trade-copier', firmId: 'tradecopia', firmName: 'Tradecopia', url: 'https://tradecopia.com' },
];

const byKey = new Map<string, GoLink>();
for (const link of [...fromFirms, ...fromPerps, ...fromPromos, ...fromTradeCopier]) byKey.set(`${link.source}/${link.firmId}`, link);

export const GO_LINKS: GoLink[] = [...byKey.values()];

export function goHref(source: GoLink['source'], firmId: string): string {
  return `/go/${source}/${firmId}/`;
}

import firmsData from '@/public/data/prop-firms.json';
import promosData from '@/public/data/live-promos.json';
import cfdData from '@/public/data/cfd-firms.json';

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
  source: 'prop-firms' | 'promos';
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

// CFD firms sit in their own block on /prop-firms, so their clicks count under the same source.
const fromCfd: GoLink[] = cfdData.firms.map((f) => ({
  source: 'prop-firms' as const,
  firmId: f.id,
  firmName: f.name,
  url: f.url,
}));

const fromPromos: GoLink[] = promosData.promos.map((p) => ({
  source: 'promos' as const,
  firmId: p.firmId,
  firmName: p.firmName,
  url: p.url,
}));

// A firm runs at most one promo at a time, so one page per (source, firm).
const byKey = new Map<string, GoLink>();
for (const link of [...fromFirms, ...fromCfd, ...fromPromos]) byKey.set(`${link.source}/${link.firmId}`, link);

export const GO_LINKS: GoLink[] = [...byKey.values()];

export function goHref(source: GoLink['source'], firmId: string): string {
  return `/go/${source}/${firmId}/`;
}

// Perps firms (public/data/perps-firms.json, read by hand, not auto-synced) turned into
// FirmView, in the layout of the MyFundedPerps comparison Angelo made on 11/10/2026
// (jtnq-promo, out/myfundedperps/table.html).
//
// The JTNQ promo has a hard end (endsAt). Three moments to get right:
// - build: a build made after endsAt never shows the promo (BUILD_TS, inlined by
//   next.config.js), so the daily rebuild drops it on its own;
// - before hydration: the static HTML shows the state of the build, with a placeholder
//   clock of the same width as the real one (PromoClock in FirmTable.tsx);
// - in the browser: the page flips to normal prices once endsAt passes (usePromoLive).

import { useEffect, useState } from 'react';
import rawData from '@/public/data/perps-firms.json';
import { goHref } from '@/lib/go-links';
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type PriceCell } from './firm-view';

// price null = announced but not on sale yet ("Coming soon").
type PerpsPlan = { size: number; price: number | null; promoPrice: number | null; note?: string };
type PerpsProgram = {
  name: string;
  steps: string;
  split: string;
  profitTarget: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  dailyLoss: string | null;
  note: string;
  plans: PerpsPlan[];
};
type PerpsFirm = {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  lastChecked: string;
  markets: string[];
  promo: { code: string; discountPct: number; endsAt: string; lastChecked: string } | null;
  programs: PerpsProgram[];
};

const DATA = rawData as unknown as { generatedAt: string; firms: PerpsFirm[] };
const BUILD_TS = Number(process.env.NEXT_PUBLIC_BUILD_TS ?? 0);

// One promo on the page: the first firm that has one (MyFundedPerps today).
const PROMO_FIRM = DATA.firms.find((f) => f.promo) ?? null;
export const PERPS_PROMO = PROMO_FIRM?.promo ?? null;
export const PERPS_PROMO_FIRM_ID = PROMO_FIRM?.id ?? null;
export const PROMO_ENDS_MS = PERPS_PROMO ? Date.parse(PERPS_PROMO.endsAt) : null;
const LIVE_AT_BUILD = PROMO_ENDS_MS != null && BUILD_TS < PROMO_ENDS_MS;

// True while the promo runs. Starts from the build state (static HTML), re-checks the
// clock once mounted, and flips to false at endsAt without re-rendering every second.
export function usePromoLive(): boolean {
  const [live, setLive] = useState(LIVE_AT_BUILD);
  useEffect(() => {
    if (!LIVE_AT_BUILD || PROMO_ENDS_MS == null) return;
    const left = PROMO_ENDS_MS - Date.now();
    if (left <= 0) {
      setLive(false);
      return;
    }
    // setTimeout caps at ~24.8 days; past that a reload will see the end anyway.
    const id = window.setTimeout(() => setLive(false), Math.min(left, 2 ** 31 - 1));
    return () => window.clearTimeout(id);
  }, []);
  return live;
}

// What the JSON keeps in a sentence (program.note), split into the rows of Angelo's
// table. Same facts as perps-firms.json notes: daily payouts and a 90% split option
// on Select/Prime/Signature, the loss limit locked at the starting balance on the 1st
// payout; Elite pays on demand, 40x on indices, the limit stays at -5%.
const DETAILS: Record<string, { split: string; payouts: string; afterPayout: string; leverage: string }> = {
  Select: { split: '80% (90% option)', payouts: 'Daily', afterPayout: 'Locks at start balance', leverage: 'Standard' },
  Prime: { split: '80% (90% option)', payouts: 'Daily', afterPayout: 'Locks at start balance', leverage: 'Standard' },
  Signature: { split: '80% (90% option)', payouts: 'Daily', afterPayout: 'Locks at start balance', leverage: 'Standard' },
  Elite: { split: '80%', payouts: 'On demand', afterPayout: 'Stays at -5%', leverage: 'Boosted (40x indices)' },
};

// Rules MyFundedPerps applies to every program, from the same table.
const COMMON: Record<string, string[]> = {
  myfundedperps: [
    '1-step evaluation',
    'Static drawdown',
    'No consistency rule',
    'No minimum trading days',
    'No time limit',
    'Up to $300K funded in total',
  ],
};

const SUMMARY: Record<string, string> = {
  myfundedperps: '80–90% split · daily or on-demand payouts',
};

const limit = (v: string | null): Cell =>
  v == null ? { text: 'n/c', muted: true } : v === 'None' ? { text: 'None', muted: true } : { text: v };
const text = (v: string | undefined): Cell => (v ? { text: v } : { text: 'n/c', muted: true });

function firmView(firm: PerpsFirm, promoLive: boolean): FirmView {
  const programs = firm.programs;
  const promo = promoLive ? firm.promo : null;
  const d = (p: PerpsProgram) => DETAILS[p.name];

  const { common, rules } = splitCommon([
    { label: 'Profit target', cells: programs.map((p) => limit(p.profitTarget)), common: (c) => `${c.text} profit target` },
    { label: 'Max drawdown', cells: programs.map((p) => limit(p.maxDrawdown)), common: (c) => `${c.text} max drawdown` },
    { label: 'Daily loss limit', cells: programs.map((p) => limit(p.dailyLoss)), common: (c) => `${c.text} daily loss limit` },
    { label: 'Profit split', cells: programs.map((p) => text(d(p)?.split ?? p.split)), common: (c) => `${c.text} profit split` },
    { label: 'Payouts', cells: programs.map((p) => text(d(p)?.payouts)), common: (c) => `${c.text} payouts` },
    {
      label: 'Drawdown after 1st payout',
      cells: programs.map((p) => text(d(p)?.afterPayout)),
      common: (c) => `Drawdown after 1st payout: ${c.text}`,
    },
    { label: 'Leverage', cells: programs.map((p) => text(d(p)?.leverage)), common: (c) => `${c.text} leverage` },
    // A program missing from DETAILS still shows its rules as the JSON writes them.
    {
      label: 'Notes',
      cells: programs.map((p) => (d(p) ? { text: '–', muted: true } : { text: p.note, note: true })),
      common: () => '',
      skip: programs.every((p) => d(p)),
    },
  ]);
  const firmCommon = COMMON[firm.id] ?? [...new Set(programs.map((p) => p.steps))];

  const sizes = [...new Set(programs.flatMap((p) => p.plans.map((pl) => pl.size)))].sort((a, b) => a - b);
  const sizeRows = sizes.map((size) => ({
    size,
    cells: programs.map((p): PriceCell => {
      const plan = p.plans.find((pl) => pl.size === size);
      if (!plan) return null;
      if (plan.price == null) return { kind: 'text', text: plan.note ?? 'Coming soon' };
      const promoPrice = promo ? plan.promoPrice : null;
      return {
        kind: 'price',
        now: promoPrice ?? plan.price,
        was: promoPrice != null ? plan.price : null,
        per: null,
        from: false,
        lines: [],
      };
    }),
  }));

  const endsLabel = promo
    ? new Date(promo.endsAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      })
    : '';

  return {
    id: firm.id,
    name: firm.name,
    logo: firm.logo,
    summary: SUMMARY[firm.id] ?? '',
    code: { code: 'JTNQ', title: 'My affiliate code' },
    stale: null,
    from: cheapest(sizeRows),
    columns: programs.map((p) => ({ name: p.name })),
    common: [...firmCommon, ...common.filter(Boolean)],
    rules,
    priceTitle: promo ? `Price with code ${promo.code}` : 'Price',
    priceSub: promo ? `${promo.discountPct}% off until ${endsLabel} New York time` : null,
    sizes: sizeRows,
    legend: [
      'Every limit is a percentage of your starting balance, the way perps firms publish them',
      ...(rules.some((r) => r.cells.some((c) => c.text === 'n/c')) ? ['n/c — the firm does not publish that rule per program'] : []),
    ],
    note:
      `Prices and rules read on the firm's own site on ${humanDate(firm.promo?.lastChecked ?? firm.lastChecked)}, not auto-synced.` +
      (promo ? ` Crossed-out prices are the normal prices; code ${promo.code} takes ${promo.discountPct}% off until ${endsLabel} New York time.` : '') +
      ' The live checkout price wins.',
    href: goHref('prop-firms', firm.id),
  };
}

export const perpsFirms = (promoLive: boolean): FirmView[] => DATA.firms.map((f) => firmView(f, promoLive));

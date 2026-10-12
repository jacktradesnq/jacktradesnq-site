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
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type Funded, type PriceCell } from './firm-view';

// price null = announced but not on sale yet ("Coming soon").
// dllPrice: Elite's cheaper version with a 3% daily loss limit, shown in the same cell after a « / »
// (Angelo, 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix »).
type PerpsPlan = {
  size: number;
  price: number | null;
  promoPrice: number | null;
  dllPrice?: number;
  dllPromoPrice?: number;
  note?: string;
};
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
  Elite: { split: '80% (90% option)', payouts: 'On demand', afterPayout: 'Stays at -5%', leverage: 'Boosted (40x indices)' },
};

// Rules MyFundedPerps applies to every program, from the same table.
const COMMON: Record<string, string[]> = {
  // No "1-step evaluation": MyFundedPerps sells no straight-to-funded account (Angelo,
  // 12/10/2026: « si la prop firm n'a pas de straight to funded ne précise pas évaluation »).
  myfundedperps: [
    'Static drawdown',
    'No consistency rule',
    'No minimum trading days',
    'No time limit',
    'Up to $300K funded in total',
  ],
};

// Funded rules, read on the firm's docs and FAQ on 12/10/2026 (docs.myfundedperpetuals.com:
// payouts « no minimum trading-day or qualifying-day requirement, consistency gate, or payout
// count cap », « one payout request per New York calendar day », « $100 of gross profit
// before the split », « at most $100,000 in total lifetime payouts »; elite-accounts: request
// from the first funded day once flat, minimum 1% of the size, the limit stays at -5%).
const MFP_STD: Funded = {
  pills: [
    { label: 'Winning days', value: 'None' },
    { label: 'Consistency', value: 'None' },
    { label: 'Payout request', value: 'Once per day' },
    { label: 'Minimum payout', value: '$100 gross' },
    { label: 'Drawdown after 1st payout', value: 'Locks at start balance' },
    { label: 'Lifetime payouts', value: 'Up to $100K' },
  ],
  rows: [],
};
const FUNDED: Record<string, Record<string, Funded>> = {
  myfundedperps: {
    Select: MFP_STD,
    Prime: MFP_STD,
    Signature: MFP_STD,
    Elite: {
      pills: [
        { label: 'Winning days', value: 'None' },
        { label: 'Consistency', value: 'None' },
        { label: 'Payout request', value: 'Any time, from day 1, positions closed' },
        { label: 'Minimum payout', value: '1% of the account' },
        { label: 'Drawdown after a payout', value: 'Stays at -5%' },
        { label: 'Lifetime payouts', value: 'Up to $100K' },
      ],
      rows: [],
    },
  },
};

const SUMMARY: Record<string, string> = {
  myfundedperps: '80–90% split',
};

const limit = (v: string | null): Cell =>
  v == null ? { text: 'n/c', muted: true } : v === 'None' ? { text: 'None', muted: true } : { text: v };
const text = (v: string | undefined): Cell => (v ? { text: v } : { text: 'n/c', muted: true });

function firmView(firm: PerpsFirm, promoLive: boolean): FirmView {
  const programs = firm.programs;
  const promo = promoLive ? firm.promo : null;
  const d = (p: PerpsProgram) => DETAILS[p.name.split(' ')[0]];

  const { common, rules } = splitCommon([
    // No target is a rule (instant funding), as the old block showed it: "None", not "n/c".
    {
      label: 'Profit target',
      cells: programs.map((p) => limit(p.profitTarget ?? 'None')),
      common: (c) => (c.muted ? 'No profit target' : `${c.text} profit target`),
    },
    { label: 'Max drawdown', cells: programs.map((p) => limit(p.maxDrawdown)), common: (c) => `${c.text} max drawdown` },
    { label: 'Daily loss limit', cells: programs.map((p) => limit(p.dailyLoss)), common: (c) => `${c.text} daily loss limit` },
    { label: 'Profit split', cells: programs.map((p) => text(d(p)?.split ?? p.split)), common: (c) => `${c.text} profit split` },
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
      const dllPromo = promo ? plan.dllPromoPrice ?? null : null;
      return {
        kind: 'price',
        now: promoPrice ?? plan.price,
        was: promoPrice != null ? plan.price : null,
        alt: plan.dllPrice != null ? { now: dllPromo ?? plan.dllPrice, was: dllPromo != null ? plan.dllPrice : null } : null,
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
    funded: FUNDED[firm.id] ? programs.map((p) => FUNDED[firm.id][p.name.split(' ')[0]] ?? null) : undefined,
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

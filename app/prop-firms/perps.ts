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
import { cheapest, hasDailyLoss, limitCell, splitCommon, type Cell, type FirmView, type Funded, type PriceCell } from './firm-view';

// price null = announced but not on sale yet ("Coming soon").
// altPrice: a second version of the same account, shown in the same cell after a « / » (Angelo,
// 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix »): MFP
// Elite's cheaper 3% DLL version, Vest 1-Step's 90% split (the first price is the 80% split).
// lines: rules that change with the size (Vest's max drawdown in dollars), a row under the price.
type PerpsPlan = {
  size: number;
  price: number | null;
  promoPrice: number | null;
  altPrice?: number;
  altPromoPrice?: number;
  lines?: { label: string; value: string }[];
  // more: other versions of the same account, one price row each under the main one (Vest 1-Step:
  // 3% DLL on the main row, then 4% DLL and No DLL; Angelo 21/10/2026: « les regrouper »).
  more?: { label: string; price: number; promoPrice: number | null; altPrice?: number; altPromoPrice?: number }[];
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
  priceLabel?: string; // name of the main price row when the plans carry `more` rows
  plans: PerpsPlan[];
};
type PerpsFirm = {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  lastChecked: string;
  markets: string[];
  // endsAt null: no announced end, no countdown. firstPurchase: the rate applies to a first order.
  // thenPct: the rate on every later order (MFP, 12/10/2026: « 35% off your first purchase — 30%
  // off every purchase after »).
  promo: { code: string; discountPct: number; endsAt: string | null; firstPurchase?: boolean; thenPct?: number; lastChecked: string } | null;
  programs: PerpsProgram[];
};

const DATA = rawData as unknown as { generatedAt: string; firms: PerpsFirm[] };
const BUILD_TS = Number(process.env.NEXT_PUBLIC_BUILD_TS ?? 0);

// Several firms can run a JTNQ promo at once (MyFundedPerps, Breakout since 13/10/2026). Only a
// promo with an end date needs the clock below; the page tracks the first such firm, or else the
// first firm with any promo. A promo without endsAt is always on (see promoOf).
const PROMO_FIRM = DATA.firms.find((f) => f.promo?.endsAt) ?? DATA.firms.find((f) => f.promo) ?? null;
export const PERPS_PROMO = PROMO_FIRM?.promo ?? null;
export const PERPS_PROMO_FIRM_ID = PROMO_FIRM?.id ?? null;
export const PROMO_ENDS_MS = PERPS_PROMO?.endsAt ? Date.parse(PERPS_PROMO.endsAt) : null;
const LIVE_AT_BUILD = PERPS_PROMO != null && (PROMO_ENDS_MS == null || BUILD_TS < PROMO_ENDS_MS);

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

// The promo a firm shows right now: one without endsAt always; a timed one while the page's
// clock says it runs (PROMO_FIRM), or, for another timed firm, while the build predates its end.
function promoOf(firm: PerpsFirm, promoLive: boolean): PerpsFirm['promo'] {
  const p = firm.promo;
  if (!p) return null;
  if (p.endsAt == null) return p;
  if (firm.id === PERPS_PROMO_FIRM_ID) return promoLive ? p : null;
  return BUILD_TS < Date.parse(p.endsAt) ? p : null;
}

// Split and leverage per program, by firm, from the firm's checkout and docs; the payout rules
// live in FUNDED below.
const DETAILS: Record<string, Record<string, { split: string; leverage: string }>> = {
  // MyFundedPerps checkout and docs, 12/10/2026.
  myfundedperps: {
    Select: { split: '80% (90% option)', leverage: 'Standard' },
    Prime: { split: '80% (90% option)', leverage: 'Standard' },
    Signature: { split: '80% (90% option)', leverage: 'Standard' },
    Elite: { split: '80% (90% option)', leverage: 'Boosted (40x indices)' },
  },
  // breakoutprop.com/pricing/, read 13/10/2026: every card « ONE-TIME, 80/20 SPLIT », « Upgrade to
  // 90/10 split » and « Max leverage 10x »; « 80/20 is the standard on every plan. Upgrade to 90/10
  // at checkout »; « Up to 10x leverage depending on the asset ». The portal checkout
  // (portal.breakoutprop.com/checkout) shows nothing without an account.
  breakout: {
    Classic: { split: '80% (90% option)', leverage: 'Up to 10x' },
    Pro: { split: '80% (90% option)', leverage: 'Up to 10x' },
    Turbo: { split: '80% (90% option)', leverage: 'Up to 10x' },
  },
  // Vest, read 21/10/2026 on next.vestmarkets.com/vest-capital/evaluation (« Create Bespoke
  // Account »: 1-Step « Profit Split 80% 90% », 2-Step « 80% », Instant « 95% profit split ») and
  // docs.vestmarkets.com/vest-capital/overview (« Up to 75x leverage (market-dependent) »).
  'vest-markets': {
    '1-Step': { split: '80% / 90%', leverage: 'Up to 75x' },
    '2-Step': { split: '80%', leverage: 'Up to 75x' },
    Instant: { split: '95%', leverage: 'Up to 75x' },
  },
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
  // Breakout, read 13/10/2026. No "1-step evaluation" either: Breakout sells no straight-to-funded
  // account (intercom.help/breakoutprop « What types of Breakout Evaluations can I purchase? »: three
  // 1-Step variants, Classic, Pro, Turbo). Sources: breakoutprop.com/pricing/ (« 6% static »,
  // « What is static drawdown? », « No min trading days », « No time limits », « You can hold up to
  // $200K in total funded capital across all accounts combined »); breakoutprop.com FAQ (« There is
  // no consistency rule on any Breakout account »).
  breakout: [
    'Static drawdown',
    'No consistency rule',
    'No minimum trading days',
    'No time limit',
    'Up to $200K funded in total',
  ],
  // Vest, docs.vestmarkets.com/vest-capital, read 21/10/2026: loss-limits « A fixed floor, set once
  // when your account is created. It never moves »; overview « No time limits » and « Maximum 10 Live
  // Funded Accounts per user, across both paths combined ». The docs say nothing about a consistency
  // rule or minimum trading days, so neither is claimed here.
  // Payouts, claiming-profit: « Claim as often as you like. There's no cap on frequency and no cap on
  // the amount you can claim »; « 24 hours for every claim »; « the USDC is credited to your Primary
  // Account ». Same for an evaluation or an Instant account (« This flow works identically »), and
  // loss-limits: « Whatever applies during the Evaluation Phase carries through unchanged once you're
  // Live ». So Vest has no Funded tab: it would repeat the evaluation (Angelo, 21/10/2026: « funded
  // c presque pareil que eval partout »).
  'vest-markets': [
    'Static drawdown',
    'No time limit',
    'Up to 10 live funded accounts',
    'Payouts any time, no cap',
    'Paid in USDC within 24 hours',
  ],
};

// No « Winning days: None » on a funded account whose payout pace is written (once a day, any
// time), the pace says it (Angelo, 22/10/2026 : « si c écrit daily payout c bon »).
// Funded rules, read on the firm's docs and FAQ on 12/10/2026 (docs.myfundedperpetuals.com:
// payouts « no minimum trading-day or qualifying-day requirement, consistency gate, or payout
// count cap », « one payout request per New York calendar day », « $100 of gross profit
// before the split », « at most $100,000 in total lifetime payouts »; elite-accounts: request
// from the first funded day once flat, minimum 1% of the size, the limit stays at -5%).
const MFP_STD: Funded = {
  pills: [
    { label: 'Consistency', value: 'None' },
    { label: 'Payout request', value: 'Once per day' },
    { label: 'Minimum payout', value: '$100 gross' },
    { label: 'Drawdown after 1st payout', value: 'Locks at start balance' },
    { label: 'Lifetime payouts', value: 'Up to $100K' },
  ],
  rows: [],
};
// Breakout funded rules, read 13/10/2026, the same for Classic, Pro and Turbo:
// - Winning days: breakoutprop.com « Your first payout can come the same day you're funded »;
//   intercom « When can I request a payout from my funded account? » lists the only conditions
//   (« at any time, on weekdays or weekends, as long as you have no open positions and haven't
//   breached your account »).
// - Consistency: breakoutprop.com FAQ « There is no consistency rule on any Breakout account ».
// - Minimum payout: intercom « What is the minimum payout amount? »: « $50, after Breakout's
//   performance-split percentage is applied ».
// Not shown, not written by the firm: a lifetime payout cap, what a payout does to the drawdown.
const BREAKOUT_FUNDED: Funded = {
  pills: [
    { label: 'Consistency', value: 'None' },
    { label: 'Payout request', value: 'Any time, with no open position' },
    { label: 'Minimum payout', value: '$50 after the split' },
  ],
  rows: [],
};
const FUNDED: Record<string, Record<string, Funded>> = {
  breakout: { Classic: BREAKOUT_FUNDED, Pro: BREAKOUT_FUNDED, Turbo: BREAKOUT_FUNDED },
  myfundedperps: {
    Select: MFP_STD,
    Prime: MFP_STD,
    Signature: MFP_STD,
    Elite: {
      pills: [
        { label: 'Consistency', value: 'None' },
        // Checkout, 12/10/2026: « Payout Eligibility Day one » / « Payout Frequency Daily ».
        { label: 'Payout request', value: 'Daily, from day one' },
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
  // breakoutprop.com, 13/10/2026: « Keep 80-90% of the profits ».
  breakout: '80–90% split',
  // docs.vestmarkets.com/vest-capital/overview, 21/10/2026: « keep 80–95% of your profits ».
  'vest-markets': '80–95% split',
};

// How the limits are measured. Breakout, intercom 13/10/2026: max drawdown « 6% [5%, 3%] of your
// initial account balance »; daily loss « 3% of your […] account balance at 00:30 UTC,
// recalculated every day at that time ».
// Vest, docs loss-limits 21/10/2026: the max drawdown is « Calculated as a percentage of your starting
// capital »; the daily loss limit is « 3% or 4% of your reset balance », « The daily reset boundary is
// 20:00 ET ».
const LEGEND: Record<string, string[]> = {
  breakout: ['Max drawdown is a percentage of your starting balance; the daily loss limit is a percentage of your balance at 00:30 UTC, reset every day'],
  'vest-markets': [
    'Max drawdown is a fixed floor, a percentage of your starting balance; the daily loss limit is a percentage of your balance at the 20:00 New York reset',
    '1-Step: the first price is the 80% split, the second the 90% split',
  ],
};

const text = (v: string | undefined): Cell => (v ? { text: v } : { text: 'n/c', muted: true });

function firmView(firm: PerpsFirm, promoLive: boolean): FirmView {
  const programs = firm.programs;
  const promo = promoOf(firm, promoLive);
  const d = (p: PerpsProgram) => DETAILS[firm.id]?.[p.name.split(' ')[0]];

  const { common, rules } = splitCommon([
    // No target is a rule (instant funding), as the old block showed it: "None", not "n/c".
    {
      label: 'Profit target',
      cells: programs.map((p) => limitCell(p.profitTarget ?? 'None')),
      common: (c) => (c.muted ? 'No profit target' : `${c.text} profit target`),
    },
    { label: 'Max drawdown', cells: programs.map((p) => limitCell(p.maxDrawdown)), common: (c) => `${c.text} max drawdown` },
    ...(hasDailyLoss(programs.map((p) => p.dailyLoss))
      ? [{ label: 'Daily loss limit', cells: programs.map((p) => limitCell(p.dailyLoss)), common: (c: Cell) => `${c.text} daily loss limit` }]
      : []),
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
      const altPromo = promo ? plan.altPromoPrice ?? null : null;
      return {
        kind: 'price',
        now: promoPrice ?? plan.price,
        was: promoPrice != null ? plan.price : null,
        alt: plan.altPrice != null ? { now: altPromo ?? plan.altPrice, was: altPromo != null ? plan.altPrice : null } : null,
        per: null,
        from: false,
        lines: (plan.lines ?? []).map((l) => ({ label: l.label, cell: { text: l.value } })),
      };
    }),
  }));

  const moreLabels = [...new Set(programs.flatMap((p) => p.plans.flatMap((pl) => (pl.more ?? []).map((m) => m.label))))];
  const extraPrices: NonNullable<FirmView['extraPrices']> = moreLabels.map((label) => ({
    label,
    byProgram: programs.map((p) => {
      const rows = p.plans.flatMap((pl) => (pl.more ?? []).filter((m) => m.label === label).map((m) => [pl.size, m] as const));
      if (!rows.length) return null;
      return Object.fromEntries(
        rows.map(([size, m]) => {
          const now = promo ? m.promoPrice : null;
          const altNow = promo ? m.altPromoPrice ?? null : null;
          return [size, {
            now: now ?? m.price,
            was: now != null ? m.price : null,
            alt: m.altPrice != null ? { now: altNow ?? m.altPrice, was: altNow != null ? m.altPrice : null } : null,
          }];
        }),
      );
    }),
  }));

  const hasPromoPrices = programs.some((p) => p.plans.some((pl) => pl.promoPrice != null));
  const endsLabel = promo?.endsAt
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
    // Prices with the code are shown only where they were read on the firm's checkout (promoPrice);
    // never computed from the rate. Vest: every price with code JTNQ read 21/10/2026 in the purchase
    // configurator of next.vestmarkets.com/vest-capital/evaluation, code typed in « Enter Discount
    // Code » (« 5% Discount »). Without them the table keeps the normal prices and only names
    // the rate (Breakout, Angelo 13/10/2026: « 5% off with code JTNQ »).
    priceTitle: promo && hasPromoPrices ? `Price with code ${promo.code}` : 'Price',
    priceSub: promo
      ? `${promo.discountPct}% off${promo.firstPurchase ? ' your first purchase' : ''}${hasPromoPrices && !extraPrices.length ? '' : ` with code ${promo.code}`}${promo.thenPct ? `\n${promo.thenPct}% off every purchase after` : ''}${endsLabel ? ` until ${endsLabel} New York time` : ''}`
      : null,
    sizes: sizeRows,
    ...(extraPrices.length ? { priceLabels: programs.map((p) => p.priceLabel ?? null), extraPrices } : {}),
    funded: FUNDED[firm.id] ? programs.map((p) => FUNDED[firm.id][p.name.split(' ')[0]] ?? null) : undefined,
    legend: [
      ...(LEGEND[firm.id] ?? ['Every limit is a percentage of your starting balance, the way perps firms publish them']),
      ...(rules.some((r) => r.cells.some((c) => c.text === 'n/c')) ? ['n/c — the firm does not publish that rule per program'] : []),
    ],
    href: goHref('prop-firms', firm.id),
  };
}

export const perpsFirms = (promoLive: boolean): FirmView[] => DATA.firms.map((f) => firmView(f, promoLive));

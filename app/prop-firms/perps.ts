// Perps firms (public/data/perps-firms.json, re-read every day on each firm's own site by
// scripts/scrape-perps.mjs since 28/11/2026) turned into FirmView (partner cards) and CompareRow
// (the comparator, one row per plan).
//
// The JTNQ promo has a hard end (endsAt), judged by the shared clock (promo-clock.ts): a
// build made after endsAt never shows it, the static HTML shows the state of the build with a
// placeholder clock of the same width as the real one (PromoClock in FirmTable.tsx), and the
// page flips to normal prices once endsAt passes (usePromoLive).

import { dailyLossChoices } from '@/lib/daily-loss-choices.mjs';
import { discountWords } from '@/lib/discount-words.mjs';
import rawData from '@/public/data/perps-firms.json';
import { runsAt } from '@/lib/promo-ends.mjs';
import { BUILD_TS, usePromoClock } from './promo-clock';
import { goHref } from '@/lib/go-links';
import { firstNumber } from '@/lib/compare-order.mjs';
import { sizeLabel } from './shared';
import { cellVal, cheapest, humanDate, pillValue, textVal, type ComparePrice, type CompareRow, type DailyLoss, type FirmView, type Funded, type Slider, type Val } from './firm-view';

// price null = announced but not on sale yet ("Coming soon").
// altPrice: a second version of the same account, shown in the same cell after a « / » (Angelo,
// 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix »): MFP
// Elite's cheaper 3% DLL version.
// altPrices: the same, for an account sold in more than two versions (E8 One at 80%, 90%, 100%).
// lines: rules that change with the size (Vest's max drawdown in dollars), a row under the price.
// grid: every price of a plan picked with sliders (Vest 1-Step since 28/11/2026), one entry per
// combination, keyed by the program's slider fields (profitTarget, maxDrawdown, split, in %); price
// and promoPrice of the plan are its default combination.
type PerpsPlan = {
  size: number;
  price: number | null;
  promoPrice: number | null;
  altPrice?: number;
  altPromoPrice?: number;
  altPrices?: { price: number; promoPrice: number | null }[];
  lines?: { label: string; value: string }[];
  grid?: ({ price: number; promoPrice: number | null } & Record<string, number | null>)[];
  // more: other versions of the same account, one price row each under the main one (Vest 1-Step
  // until 23/11/2026: 3% DLL on the main row, then 4% DLL and No DLL; Angelo 21/10/2026: « les regrouper »).
  more?: { label: string; price: number; promoPrice: number | null; altPrice?: number; altPromoPrice?: number }[];
  note?: string;
};
type PerpsProgram = {
  name: string;
  // Key of DETAILS and FUNDED when the first word of the name is not enough (« E8 One · 4% Max »).
  rulesKey?: string;
  steps: string;
  split: string;
  profitTarget: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  dailyLoss: string | null;
  note: string;
  priceLabel?: string; // name of the main price row when the plans carry `more` rows
  // The rules the buyer picks (Vest 1-Step: target, drawdown, split), each shown as a slider in place
  // of the program's own field of the same name; values in %, default = the firm's.
  sliders?: { field: SliderField; label: string; values: number[]; default: number }[];
  plans: PerpsPlan[];
};
type SliderField = 'profitTarget' | 'maxDrawdown' | 'split';
// The comparator column each slider sits in.
const SLIDER_COL: Record<SliderField, string> = { profitTarget: 'target', maxDrawdown: 'maxLoss', split: 'split' };
type PerpsFirm = {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  lastChecked: string;
  markets: string[];
  // Symbols the firm lists (E8: e8x.e8markets.com/trading-symbols, Perpetual Markets, 01/11/2026).
  pairs?: { count: number; title: string };
  // endsAt null: no announced end, no countdown. firstPurchase: the rate applies to a first order.
  // thenPct: the rate on every later order (MFP, 12/10/2026: « 35% off your first purchase — 30%
  // off every purchase after »). instantPct: the rate on Instant accounts when it differs (Vest,
  // affiliate dashboard 28/11/2026: « Evaluation 10% · Instant 5% »).
  promo: {
    code: string;
    discountPct: number;
    endsAt: string | null;
    firstPurchase?: boolean;
    thenPct?: number;
    instantPct?: number;
    // Lower rates on other programs (E8 Classic 10% while E8 One and E8 Pro are at 50%, 28/11/2026).
    otherPcts?: number[];
    lastChecked: string;
  } | null;
  // true: the daily sync could not read the firm's site, the prices are the last ones read (lastChecked).
  stale?: boolean;
  programs: PerpsProgram[];
};

const DATA = rawData as unknown as { generatedAt: string; firms: PerpsFirm[] };

// Several firms can run a JTNQ promo at once (MyFundedPerps, Breakout since 13/10/2026). Only a
// promo with an end date needs the clock below; the page tracks the first such firm, or else the
// first firm with any promo. A promo without endsAt is always on (see promoOf).
const PROMO_FIRM = DATA.firms.find((f) => f.promo?.endsAt) ?? DATA.firms.find((f) => f.promo) ?? null;
export const PERPS_PROMO = PROMO_FIRM?.promo ?? null;
export const PERPS_PROMO_FIRM_ID = PROMO_FIRM?.id ?? null;
export const PROMO_ENDS_MS = PERPS_PROMO?.endsAt ? Date.parse(PERPS_PROMO.endsAt) : null;
const PROMO_ENDS: readonly number[] = PROMO_ENDS_MS == null ? [] : [PROMO_ENDS_MS];

// True while the promo runs. Starts from the build state (static HTML), re-checks the
// clock once mounted, and flips to false at endsAt without re-rendering every second.
export function usePromoLive(): boolean {
  const at = usePromoClock(PROMO_ENDS);
  return PERPS_PROMO != null && runsAt(PROMO_ENDS_MS, at);
}

// The promo a firm shows right now: one without endsAt always; a timed one while the page's
// clock says it runs (PROMO_FIRM), or, for another timed firm, while the build predates its end.
function promoOf(firm: PerpsFirm, promoLive: boolean): PerpsFirm['promo'] {
  const p = firm.promo;
  if (!p) return null;
  if (p.endsAt == null) return p;
  if (firm.id === PERPS_PROMO_FIRM_ID) return promoLive ? p : null;
  return runsAt(p.endsAt, BUILD_TS) ? p : null;
}

// Split and leverage per program, by firm, from the firm's checkout and docs; the payout rules
// live in FUNDED below.
const DETAILS: Record<string, Record<string, { split?: string; leverage: string; leverageTitle?: string }>> = {
  // E8 Perpetual, read 01/11/2026 on help.e8markets.com, « How much leverage do you offer? »
  // (Perpetual futures table) and the product overview (« Payout 80%, 90%, 100% » for E8 One, « 80%,
  // 100% » for E8 Pro). Re-read 28/11/2026: « Other Crypto instruments 1:3 » for E8 One and E8 Pro
  // (1:2 on 01/11), and E8 Classic (back on 28/11/2026, help article « E8 Classic v.2 ») « 1:15 1:15
  // 1:3 1:5 1:30 1:20 1:25 1:10 » (BTC, ETH, other crypto, stocks, indices, metals, forex, energy).
  // Splits come from the synced programs. Its own id, e8-perps: e8-markets is the futures firm, and
  // one id in both families would open #compare=e8-markets on the wrong table.
  'e8-perps': {
    One: {
      split: '80% / 90% / 100%',
      leverage: 'Up to 25x',
      leverageTitle: 'BTC, ETH, indices, metals, energy 15x · stocks 5x · other crypto 3x · forex 25x',
    },
    Pro: {
      split: '80% / 100%',
      leverage: 'Up to 25x',
      leverageTitle: 'BTC, ETH, indices, metals, energy 15x · stocks 5x · other crypto 3x · forex 25x',
    },
    Classic: {
      leverage: 'Up to 30x',
      leverageTitle: 'BTC, ETH 15x · indices 30x · metals 20x · energy 10x · stocks 5x · other crypto 3x · forex 25x',
    },
  },
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
  // Vest, read 28/11/2026: docs.vestmarkets.com/vest-capital/overview « Up to 100x leverage
  // (market-dependent) » (« Up to 75x » until then). Splits, sizes, targets and drawdowns come from
  // their catalogue every day (scripts/lib/firms/perps-vest.mjs), so no split here: the program's own.
  'vest-markets': {
    '1-Step': { leverage: 'Up to 100x' },
    Instant: { leverage: 'Up to 100x' },
  },
};

// Payout pace of a firm with no funded rules written below. Vest, docs.vestmarkets.com/vest-capital,
// read 21/10/2026, claiming-profit: « Claim as often as you like. There's no cap on frequency and no
// cap on the amount you can claim »; « 24 hours for every claim ». Same for an evaluation or an
// Instant account (« This flow works identically »), and loss-limits: « Whatever applies during the
// Evaluation Phase carries through unchanged once you're Live ». So Vest has no funded rules of its
// own (Angelo, 21/10/2026: « funded c presque pareil que eval partout »).
const PAYOUTS: Record<string, string> = {
  'vest-markets': 'Any time, no cap',
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
  // E8 Perpetual, read 01/11/2026 on e8markets.com/?market=perpetual (every size, drawdown and payout
  // of the configurator) and help.e8markets.com: « What is Payout On Demand? » (E8 One: « you can
  // request a payout at any time », « 40% Best Day rule », « net profit (payout) must be greater
  // than 50% of your daily drawdown », « earliest first payout … 3 days »; E8 Pro: « daily payouts »,
  // « the minimum is 1% »), the product overview (« No best day », « 2% Daily profit cap », static
  // drawdown « Only moves when you request the first payout »).
  // Price with code: e8markets.com/e8-markets-discount-code, « 50% off », « E8 Pro (Perpetual), E8 One
  // (Perpetual) », « Apply for all purchases », no expiry; the configurator shows the same prices
  // (« with code E8 on first order »). Printed as JTNQ (CLAUDE.md, Angelo 11/10/2026 and 26/10/2026).
  'e8-perps': {
    One: {
      pills: [
        { label: 'Consistency', value: '40% best day' },
        { label: 'Payout request', value: 'Any time, first payout after 3 days at the earliest' },
        { label: 'Minimum payout', value: 'Above 50% of the daily drawdown' },
      ],
      rows: [],
    },
    Pro: {
      pills: [
        { label: 'Consistency', value: 'None' },
        { label: 'Payout request', value: 'Daily' },
        { label: 'Minimum payout', value: '1%' },
        { label: 'Daily profit cap', value: '2%' },
      ],
      rows: [],
    },
    // E8 Classic, read 28/11/2026 on e8markets.com/perpetual-futures (« No Consistency Rule », « Daily
    // Payouts », « Min. Payout $100 », « Your loss floor sits 5% below your start and never moves, even
    // after a payout ») and help.e8markets.com « E8 Classic v.2 » (« Minimum profit is $100 », « you can
    // request as many times per day as you want »).
    Classic: {
      pills: [
        { label: 'Consistency', value: 'None' },
        { label: 'Payout request', value: 'Daily' },
        { label: 'Minimum payout', value: '$100 net profit' },
        { label: 'Drawdown after a payout', value: 'Never moves' },
      ],
      rows: [],
    },
  },
  breakout: { Classic: BREAKOUT_FUNDED, Pro: BREAKOUT_FUNDED, Turbo: BREAKOUT_FUNDED },
  myfundedperps: {
    Select: MFP_STD,
    Prime: MFP_STD,
    Signature: MFP_STD,
    Elite: {
      pills: [
        { label: 'Consistency', value: 'None' },
        // docs.myfundedperpetuals.com/guides/elite-accounts, 28/11/2026: « When you can request On
        // demand », « On demand: you can request from your first day funded », « no daily request limit »
        // (the checkout said « Payout Frequency Daily » on 12/10/2026).
        { label: 'Payout request', value: 'On demand, from day one' },
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
  // docs.vestmarkets.com/vest-capital/overview, 28/11/2026: « keep 70–95% of your profits ».
  'vest-markets': '70–95% split',
  // help.e8markets.com product overview, 01/11/2026: E8 One « 80%, 90%, 100% », E8 Pro « 80%, 100% ».
  'e8-perps': '80–100% split',
};

const STEPS = (s: string) => (/^instant/i.test(s) ? 'Instant' : /^2/.test(s) ? '2 Steps' : /^1/.test(s) ? '1 Step' : s);
const figure = (text: string | null | undefined): Val | undefined => (text ? textVal(text, firstNumber(text)) : undefined);
const withTitle = (val: Val | undefined, title: string | undefined): Val | undefined => (val && title ? { ...val, title } : val);

// « 3% », « None », and the plans sold both ways: « None / 3% » (MFP Elite, shown « 3% or none »), « 3%, 4% or none » (Vest 1-Step).
function dailyLossOf(text: string | null): DailyLoss {
  if (!text) return null;
  const parts = text.split(/\s*(?:\/|,|\bor\b)\s*/).filter(Boolean);
  const none = parts.some((x) => /^none$/i.test(x));
  const some = parts.some((x) => !/^none$/i.test(x));
  return none && some ? 'both' : none ? 'without' : 'with';
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

// The sliders of a plan and its price for each combination (see CompareRow.sliders). A combination the
// grid does not hold is left out: the row then keeps its default price.
function slidersOf(p: PerpsProgram, plan: PerpsPlan, priceOf: (list: number, discounted: number | null) => ComparePrice) {
  if (!p.sliders?.length || !plan.grid?.length) return {};
  const sliders: Slider[] = p.sliders.map((s) => ({
    col: SLIDER_COL[s.field],
    label: s.label,
    values: s.values.map((v) => `${v}%`),
    sorts: s.values,
    // Max loss in dollars, as the plan's own line: the drawdown % of the account size.
    subs: s.field === 'maxDrawdown' ? s.values.map((v) => usd(Math.round((plan.size * v) / 100))) : undefined,
    start: Math.max(0, s.values.indexOf(s.default)),
  }));
  const combos: Record<string, ComparePrice> = {};
  for (const g of plan.grid) {
    const stops = p.sliders.map((s) => s.values.indexOf(g[s.field] as number));
    if (stops.every((i) => i >= 0)) combos[stops.join('|')] = priceOf(g.price, g.promoPrice);
  }
  return { sliders, combos };
}

function rowsOf(firm: PerpsFirm, promoLive: boolean): CompareRow[] {
  const promo = promoOf(firm, promoLive);
  const rulesKey = (p: PerpsProgram) => p.rulesKey ?? p.name.split(' ')[0];
  const d = (p: PerpsProgram) => DETAILS[firm.id]?.[rulesKey(p)];
  const funded = (p: PerpsProgram) => FUNDED[firm.id]?.[rulesKey(p)];
  const version = (list: number, discounted: number | null | undefined) => ({ list, discounted: promo ? discounted ?? null : null });
  return firm.programs.flatMap((p) =>
    p.plans.map((plan, i): CompareRow => {
      const steps = STEPS(p.steps);
      const dollars = plan.lines?.find((l) => l.label === 'Max drawdown')?.value;
      return {
        key: `${firm.id}|${p.name}|${plan.size}|${i}`,
        family: 'perps',
        firmId: firm.id,
        firmName: firm.name,
        logo: firm.logo,
        program: p.name,
        size: plan.size,
        steps,
        // Prices with the code from promoPrice. Breakout's are its prices minus 5%, written in the JSON
        // (Angelo, 01/11/2026: « breakout premier eval c'est belle et bien du 5% »).
        price:
          plan.price == null
            ? { kind: 'text', text: plan.note ?? 'Coming soon' }
            : {
                kind: 'price',
                list: plan.price,
                discounted: promo ? plan.promoPrice : null,
                alts: [
                  ...(plan.altPrice != null ? [version(plan.altPrice, plan.altPromoPrice)] : []),
                  ...(plan.altPrices ?? []).map((a) => version(a.price, a.promoPrice)),
                ],
                per: null,
                from: false,
              },
        cells: {
          size: { text: sizeLabel(plan.size), sort: plan.size },
          steps: { text: steps, sort: steps },
          pairs: firm.pairs ? { text: String(firm.pairs.count), sort: firm.pairs.count, title: firm.pairs.title } : undefined,
          leverage: withTitle(figure(d(p)?.leverage), d(p)?.leverageTitle),
          // No target on instant funding is not said (Angelo, 22/10/2026).
          target: figure(p.profitTarget),
          dailyLoss: cellVal('dailyLoss', p.dailyLoss),
          maxLoss: p.maxDrawdown ? { text: p.maxDrawdown, sort: firstNumber(p.maxDrawdown), sub: dollars } : undefined,
          lossType: p.ddType ? { text: '', sort: p.ddType, tag: { label: p.ddType, title: '', accent: false } } : undefined,
          split: cellVal('split', d(p)?.split ?? p.split),
          payoutFreq: cellVal('payoutFreq', pillValue(funded(p), 'Payout request') ?? PAYOUTS[firm.id]),
        },
        lossType: p.ddType,
        dailyLoss: dailyLossOf(p.dailyLoss),
        note: plan.price != null ? plan.note : undefined,
        ...slidersOf(p, plan, (list, discounted) => ({ kind: 'price', list, discounted: promo ? discounted : null, alts: [], per: null, from: false })),
        options: dailyLossChoices(p, plan)?.map((c) => ({
          label: c.label,
          price: {
            kind: 'price',
            list: c.price,
            discounted: promo ? c.promoPrice : null,
            alts: c.altPrice != null ? [version(c.altPrice, c.altPromoPrice)] : [],
            per: null,
            from: false,
          },
        })),
        href: goHref('prop-firms', firm.id),
        affiliate: true,
        code: { code: 'JTNQ', title: 'My affiliate code' },
      };
    }),
  );
}

export const perpsRows = (promoLive: boolean): CompareRow[] => DATA.firms.flatMap((f) => rowsOf(f, promoLive));

export const perpsFirms = (promoLive: boolean): FirmView[] =>
  DATA.firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    logo: firm.logo,
    summary: SUMMARY[firm.id] ?? '',
    code: { code: 'JTNQ', title: 'My affiliate code' },
    // The firm's published rate; MFP: 35% on a first order, then 30%, so « Up to 35% off »; Vest:
    // 10% on evaluations, 5% on Instant, « Up to 10% off ».
    offer: discountWords([
      promoOf(firm, promoLive)?.discountPct,
      promoOf(firm, promoLive)?.thenPct,
      promoOf(firm, promoLive)?.instantPct,
      ...(promoOf(firm, promoLive)?.otherPcts ?? []),
    ]),
    // A firm whose site the daily sync could not read keeps its last prices: say from when, like the
    // futures firms read by their own scraper (futures.ts, firmView).
    stale: firm.stale
      ? {
          label: `Prices ${humanDate(firm.lastChecked)}`,
          title: `Prices last verified on ${humanDate(firm.lastChecked)}. Check the live checkout price.`,
        }
      : null,
    from: cheapest(rowsOf(firm, promoLive)),
    href: goHref('prop-firms', firm.id),
  }));

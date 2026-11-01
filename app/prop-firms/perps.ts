// Perps firms (public/data/perps-firms.json, read by hand, not auto-synced) turned into
// FirmView (partner cards) and CompareRow (the comparator, one row per plan).
//
// The JTNQ promo has a hard end (endsAt), judged by the shared clock (promo-clock.ts): a
// build made after endsAt never shows it, the static HTML shows the state of the build with a
// placeholder clock of the same width as the real one (PromoClock in FirmTable.tsx), and the
// page flips to normal prices once endsAt passes (usePromoLive).

import rawData from '@/public/data/perps-firms.json';
import { runsAt } from '@/lib/promo-ends.mjs';
import { BUILD_TS, usePromoClock } from './promo-clock';
import { goHref } from '@/lib/go-links';
import { firstNumber } from '@/lib/compare-order.mjs';
import { sizeLabel } from './shared';
import { cellVal, cheapest, pillValue, textVal, type CompareRow, type DailyLoss, type FirmView, type Funded, type Val } from './firm-view';

// price null = announced but not on sale yet ("Coming soon").
// altPrice: a second version of the same account, shown in the same cell after a « / » (Angelo,
// 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix »): MFP
// Elite's cheaper 3% DLL version, Vest 1-Step's 90% split (the first price is the 80% split).
// altPrices: the same, for an account sold in more than two versions (E8 One at 80%, 90%, 100%).
// lines: rules that change with the size (Vest's max drawdown in dollars), a row under the price.
type PerpsPlan = {
  size: number;
  price: number | null;
  promoPrice: number | null;
  altPrice?: number;
  altPromoPrice?: number;
  altPrices?: { price: number; promoPrice: number | null }[];
  lines?: { label: string; value: string }[];
  // more: other versions of the same account, one price row each under the main one (Vest 1-Step:
  // 3% DLL on the main row, then 4% DLL and No DLL; Angelo 21/10/2026: « les regrouper »).
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
const DETAILS: Record<string, Record<string, { split: string; leverage: string; leverageTitle?: string }>> = {
  // E8 Perpetual, read 01/11/2026 on help.e8markets.com, « How much leverage do you offer? »
  // (Perpetual futures table, the same for E8 One and E8 Pro) and the product overview (« Payout
  // 80%, 90%, 100% » for E8 One, « 80%, 100% » for E8 Pro). Its own id, e8-perps: e8-markets is the
  // futures firm, and one id in both families would open #compare=e8-markets on the wrong table.
  'e8-perps': {
    One: {
      split: '80% / 90% / 100%',
      leverage: 'Up to 25x',
      leverageTitle: 'BTC, ETH, indices, metals, energy 15x · stocks 5x · other crypto 2x · forex 25x',
    },
    Pro: {
      split: '80% / 100%',
      leverage: 'Up to 25x',
      leverageTitle: 'BTC, ETH, indices, metals, energy 15x · stocks 5x · other crypto 2x · forex 25x',
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
  // Vest 50K (perps-firms.json), added after Vest's tweet of 21/10/2026, read 22/10/2026:
  // next.vestmarkets.com/vest-capital, Instant card « $50,000 Trading Capital », « Max. Drawdown
  // $2,000 », « One-Time Payment $2,000 »; Evaluation card « EMERALD », « Max. Drawdown $3,000 »;
  // www.vestmarkets.com « $50,000 … Max. Daily Loss 3% … Max. Drawdown $3,000 … Evaluation Goal
  // 10% … Profit Split 80% … One-Time Payment $415 »; « Create Your Bespoke Account » at $50,000
  // (tier « Emerald », « Max. Drawdown $3,000 (6%) »): 1-Step 10% 3%/4%/no DLL $415/$555/$745 at
  // 80%, $498/$666/$894 at 90%; 1-Step 20% $255/$335/$495 at 80%, $306/$402/$594 at 90%; 2-Step
  // « 10% → 5% » $175; Instant « $2,000 (4%) » $2,000. No 50K-specific rule published; the docs
  // (docs.vestmarkets.com/vest-capital/account-tiers) still say « from $500 up to $25,000 ».
  // Vest, read 21/10/2026 on next.vestmarkets.com/vest-capital/evaluation (« Create Bespoke
  // Account »: 1-Step « Profit Split 80% 90% », 2-Step « 80% », Instant « 95% profit split ») and
  // docs.vestmarkets.com/vest-capital/overview (« Up to 75x leverage (market-dependent) »).
  'vest-markets': {
    '1-Step': { split: '80% / 90%', leverage: 'Up to 75x' },
    '2-Step': { split: '80%', leverage: 'Up to 75x' },
    Instant: { split: '95%', leverage: 'Up to 75x' },
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
  },
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
    stale: null,
    from: cheapest(rowsOf(firm, promoLive)),
    href: goHref('prop-firms', firm.id),
  }));

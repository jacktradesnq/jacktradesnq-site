// Futures firms turned into FirmView (partner cards) and CompareRow (the comparator).
// - public/data/prop-firms.json: partner firms, scraped daily by scripts/scrape-prop-firms.mjs.
// - public/data/compare-extra-firms.json: firms Angelo is not partnered with (Lucid Trading,
//   Tradeify), same shape plus "affiliate": false and "code" = their public code. They show in
//   the comparator only, with their own site and code (Angelo, 01/11/2026). Once their
//   promo.ends passes, the comparator drops the code and the discounted prices (firmAt in
//   lib/promo-ends.mjs, judged by the shared clock of promo-clock.ts); Tradeify's are read
//   again every day by scripts/scrape-tradeify.mjs.

import rawData from '@/public/data/prop-firms.json';
import rawExtra from '@/public/data/compare-extra-firms.json';
import { goHref } from '@/lib/go-links';
import { firstNumber } from '@/lib/compare-order.mjs';
import { firmAt, promoEnds } from '@/lib/promo-ends.mjs';
import { money, sizeLabel } from './shared';
import {
  cheapest, humanDate, pillValue, textVal,
  type CompareRow, type FirmView, type Funded, type Pill, type Val,
} from './firm-view';
import codesMd from '@/content/prop-firms/codes.md';
import { parseCodes } from '@/lib/firm-codes.mjs';

// Affiliate code applied on every firm link.
const CODE = 'JTNQ';

type DdType = 'EOD' | 'EOD Trailing' | 'Intraday' | 'Static';
type Plan = {
  size: number;
  price: number;
  originalPrice?: number | null;
  profitTarget: number | null;
  maxDrawdown: number;
  ddType: DdType;
  dailyLoss?: number | null;
  dailyLossSoft?: boolean;
  // A rule no source publishes has no key: inventing a value would be worse than saying so.
  consistency?: string;
  // « Days to Pass: 3 minimum » where the firm's card prints it (Traders Launch).
  minDays?: number;
  contracts: string;
  // 0: the firm says there is none.
  activationFee?: number | null;
  // One product live at several prices at once: the cheapest is shown, and said.
  priceAmbiguous?: boolean;
  // What qualifies the price, written by the source (Legacy NYC hours, the split the
  // price is for). A plan cheaper for a stated reason carries that reason.
  note?: string;
  // The same account sold at other profit splits, list prices: {"60": 119, "90": 169}.
  splitPrices?: Record<string, number>;
};
// The optional program fields feed the comparator's columns (Angelo, 01/11/2026). Absent:
// the column falls back on what the page already knows (firm split, funded rules below),
// else stays empty. Never filled in by guess.
type Program = {
  name: string;
  type: 'eval' | 'instant';
  priceType: 'one-time' | 'monthly';
  promoCode?: string;
  promoLabel?: string;
  steps?: 1 | 2 | 'instant';
  split?: string;
  payoutFrequency?: string;
  maxPayout?: string;
  minPayout?: string;
  evalConsistency?: string;
  fundedConsistency?: string;
  plans: Plan[];
};
type Firm = {
  id: string;
  name: string;
  split: string;
  payout: string;
  promo: { label: string; code: string; ends?: string } | null;
  code?: string | null;
  codeDiscountPct?: number;
  url: string;
  lastChecked: string;
  stale: boolean;
  // compare-extra-firms.json only: false, not a partner.
  affiliate?: boolean;
  programs: Program[];
};
type PropData = { generatedAt: string; firms: Firm[] };

const DATA = rawData as unknown as PropData;
// Empty until filled ({ "generatedAt": "", "firms": [] }): nothing extra is shown.
const EXTRA = rawExtra as unknown as PropData;

const FIRM_LOGOS: Record<string, string> = {
  'traders-launch': '/logos/traders-launch.png',
  'e8-markets': '/logos/e8-markets.svg',
  blusky: '/logos/blusky.svg',
};

const DD_LABEL: Record<DdType, string> = {
  EOD: 'No trail',
  'EOD Trailing': 'EOD Trail',
  Intraday: 'Intraday Trail',
  Static: 'Static',
};
const DD_TITLE: Record<DdType, string> = {
  EOD: 'Static drawdown — fixed loss limit from your starting balance',
  'EOD Trailing': 'Trailing drawdown — the limit follows your end-of-day balance highs',
  Intraday: 'Trailing drawdown — the limit follows your equity in real time',
  // Traders Launch Static cards, read 21/10/2026: « static — Does not trail ».
  Static: 'Static drawdown — fixed loss limit, does not trail',
};

// A program-level promo wins, otherwise the firm-level promo.
function promoFor(firm: Firm, program: Program): { code: string | null; title: string } {
  const code = program.promoCode ?? firm.promo?.code ?? null;
  const label = program.promoLabel ?? firm.promo?.label ?? null;
  const ends = program.promoCode ? undefined : firm.promo?.ends;
  return { code, title: [label, ends ? `ends ${ends}` : null].filter(Boolean).join(' — ') };
}

// Code on the firm's chip: an explicit firm-level code wins (E8's tracking id), firms
// without the field use Angelo's code, code:null falls back to the firm's public code.
const chipCode = (firm: Firm, promoCode: string | null) => (firm.code === undefined ? CODE : firm.code ?? promoCode);

// content/prop-firms/codes.md decides what the page prints: « firm = link » means nothing to
// type, the link carries the discount, so no code chip (Traders Launch: « Mettre JTNQ la
// ferait taper un code qui n'existe pas chez eux »). Same file the promo feed reads.
const CODES: Record<string, string> = parseCodes(codesMd);
const discountViaLink = (firmId: string) => CODES[firmId]?.toLowerCase() === 'link';

// Price paid through Angelo's link/code. His permanent code discount (Traders Launch
// -20% since 21/10/2026, was 15%) only applies when the firm shows no public promo (originalPrice == null) —
// public promos already discount `price`. Same arithmetic as scripts/lib/promo-analysis.mjs.
function effectivePrice(firm: Firm, plan: Plan): { now: number; was: number | null; viaCode: boolean } {
  if (firm.codeDiscountPct != null && plan.originalPrice == null) {
    return { now: plan.price * (1 - firm.codeDiscountPct / 100), was: plan.price, viaCode: true };
  }
  return { now: plan.price, was: plan.originalPrice ?? null, viaCode: false };
}

// Funded rules per program, read on each firm's own help pages on 12/10/2026. Winning
// days always written as a figure or "None" (Angelo, 12/10/2026: « tu mets le chiffre, si y
// a pas tu mets none »).
// E8 (helpfutures.e8markets.com, articles « E8 Signature » and « E8 Zero (Starter and
// Max) »): Signature « Minimum profitable days between each payout: 5 (does not apply for
// first payout) », a profitable day being +0.3% closed PnL, buffer the size of the EOD
// drawdown, 4 payouts per account; Zero « No consistency rules / No minimum profitable days
// / Payout frequency: You can request it every day! », 4 payouts per account.
// Traders Launch (traderslaunch.com/faq): no minimum days before a payout, account above
// +1% profit, no consistency once Simfunded, a buffer to build before the first payout.
// E8 re-checked on its checkout and configurator on 12/10/2026: Signature has a 35% best-day
// rule and a 2% soft daily pause once funded only, and per-payout caps by size; Zero splits
// 80% or 100% (paid option), funded contracts start lower and scale with locked profit.
// No « Winning days: None » where the payout pace is written (Angelo, 22/10/2026 : « si c écrit daily
// payout c bon »).
const E8_ZERO_PILLS: Pill[] = [
  { label: 'Consistency', value: 'None' },
  { label: 'Payout request', value: 'Every day' },
  { label: 'Minimum payout', value: '$100' },
  { label: 'Profit split', value: '80% (100% option)' },
  { label: 'Payouts per account', value: '4, then a free challenge' },
];
const E8_ZERO_CONTRACTS = { 25000: '1 → 2 → 3', 50000: '2 → 3 → 5', 100000: '3 → 5 → 8', 200000: '4 → 7 → 10' };
// Their #pricing cards and FAQ (traderslaunch.com, read 21/10/2026): Premium and Legacy NYC
// « Starts at 2 minis or 20 micros, up to 15 minis. At least 1 trade a week »; FAQ « Up to 5
// funded futures accounts at a time », « At $100,000 in cumulative payouts you are paused and
// become eligible for scaling opportunities », « You must place at least 1 trade per week,
// both during the evaluation and in your SimFunded account ».
const TL_ACCOUNT_PILLS: Pill[] = [
  { label: 'Activity', value: 'At least 1 trade a week' },
  { label: 'Funded accounts', value: 'Up to 5 at a time' },
  { label: 'At $100K paid out', value: 'Paused, then eligible for scaling' },
];
// Daily payouts are in the firm line, so no « Winning days: None » (Angelo, 22/10/2026 : « si on a préicser
// que c " daily payout " alors oui on enleve le winnoing day »).
const TL_PILLS: Pill[] = [
  { label: 'Consistency', value: 'None' },
  { label: 'Payout from', value: '+1% profit' },
  { label: 'Payout cap', value: 'None' },
  { label: 'Drawdown', value: 'Locks at start balance, payouts don\'t lower it' },
  { label: 'Contracts', value: 'Scale up to 15 minis' },
  ...TL_ACCOUNT_PILLS,
];
// Traders Launch Static, its cards and « Static Accounts FAQ » on traderslaunch.com read
// 21/10/2026: « No consistency rule » once sim funded, « No buffer to build », « $200 minimum
// withdrawal, measured on profit before your split », and on 60% / 80% « positions are
// auto-flattened » at the daily earnings limit ($1,000 / $2,000 / $4,000); « The 90% option
// has unlimited daily earnings once SimFunded »; minimum payout « $200 of trading profit [...]
// measured before your split: $120 to you at 60%, $160 at 80%, or $180 at 90% ».
const TL_STATIC_PILLS: Pill[] = [
  { label: 'Consistency', value: 'None' },
  // Angelo, 22/10/2026 : « met " no buffer required " ».
  { label: 'No buffer required' },
  { label: 'Minimum payout', value: '$200 profit before your split ($120 / $160 / $180 to you at 60 / 80 / 90%)' },
  { label: 'Daily earnings cap', value: 'Positions flattened at the cap on 60% and 80%, none on 90%' },
  ...TL_ACCOUNT_PILLS,
];
// TL Drop #2 (Hyperprop only), its « Funded Terms » on traderslaunch.com read 26/10/2026:
// « $2,000 daily earning cap once sim funded: positions are auto-flattened and trading stops
// for the day » (60% / 80%; the 90% card: « unlimited daily earnings »), « The same drawdown and
// daily loss limit apply », « No consistency rule and no minimum trading days », « Withdraw
// everything above $25,600, $200 minimum, before your split, one payout a day ».
// Only shown while the published drop is this one (DROP_TERMS_FOR).
const TL_DROP2_PILLS: Pill[] = [
  { label: 'Consistency', value: 'None' },
  { label: 'No minimum trading days' },
  { label: 'Withdraw', value: 'Everything above $25,600, $200 minimum before your split' },
  { label: 'Daily earnings cap', value: '$2,000 on 60% and 80% (positions flattened), none on 90%' },
  { label: 'Drawdown', value: 'Same as the evaluation, $600 daily loss limit too' },
];
const DROP_TERMS_FOR = 'TL Drop #2';
// BluSky, help.blusky.pro read 27/10/2026. Launch and Propel (« Launch plans phases, rules
// and costs », « Propel plans… », « Sim Funded Accounts Rules »): after the evaluation a Buffer
// phase with its own target and 34% consistency (21% on Propel 300K), then Sim Funded;
// « Minimum payout request: $500 », « at least $500 in new profit » between requests, « Sim
// Funded payout caps operate on a rolling 7-day basis », « Stop trading for the day after
// reaching $5,000 in daily profit » / « for the week after reaching $10,000 », « Before
// exceeding $10,000 in total profit per account, you must open a Support Review Ticket ».
// Daily payouts are in the firm line (Angelo, 22/10/2026: no « Winning days » then).
const BLUSKY_SFA_PILLS: Pill[] = [
  { label: 'Buffer phase', value: 'A second target after the evaluation, 34% consistency (21% on 300K)' },
  { label: 'Minimum payout', value: '$500' },
  { label: 'Between payouts', value: '$500 of new profit' },
  { label: 'Profit stop', value: '$5,000 a day, $10,000 a week' },
  { label: 'At $10,000 total profit', value: 'Review ticket before going further' },
];
const BLUSKY_CAP = 'Payout cap, rolling 7 days';
// Orbit (« Orbit plans: two phases, faster payouts »): « A 40% consistency rule applies while Sim
// Funded, and payouts become available every three trading days once your balance is above the
// threshold », payout minimum $500, funded contracts per size. The checkout banner says the
// same: « Payouts every 3 days in SFA ».
const BLUSKY_ORBIT_PILLS: Pill[] = [
  { label: 'Consistency', value: '40%' },
  { label: 'Payout request', value: 'Every 3 trading days' },
  { label: 'Minimum payout', value: '$500' },
];
// Direct 2 Funded and Instant Sim Funded (« Instant Funding: Direct to Funded and Instant Sim
// Funded »): « Payouts are available every day, Monday to Friday, on any balance above $53,000,
// up to $2,500 in any 7-day window »; Direct to Funded « payouts on balance above $3,500 »,
// weekly cap $3,000.
const bluskyInstant = (above: string, cap: string): Funded => ({
  pills: [
    { label: 'Payouts from', value: `Balance above ${above}` },
    { label: 'Payout cap', value: `${cap} in any 7 days` },
    { label: 'Minimum payout', value: '$500' },
  ],
  rows: [],
});
const FUNDED: Record<string, Record<string, Funded>> = {
  'e8-markets': {
    'E8 Signature Futures': {
      pills: [
        { label: 'Winning days', value: 'None for the 1st payout, then 5 between payouts (day ≥ +0.3%)' },
        { label: 'Consistency', value: '35% best day' },
        { label: 'Daily pause', value: '2%, soft: trading stops for the day' },
        { label: 'Buffer', value: 'Same as your EOD drawdown' },
        { label: 'Minimum payout', value: '$100' },
        { label: 'Payouts per account', value: '4, then a free challenge' },
      ],
      rows: [
        { label: 'Daily pause', bySize: { 25000: '$500', 50000: '$1,000', 100000: '$2,000', 150000: '$3,000' } },
        {
          label: 'Payout caps 1 / 2 / 3 / 4',
          bySize: {
            25000: '$1,000 / 1,000 / 1,250 / 1,250',
            50000: '$1,250 / 1,250 / 2,000 / 2,000',
            100000: '$2,000 / 2,000 / 3,000 / 3,000',
            150000: '$3,000 / 3,000 / 3,500 / 3,500',
          },
        },
      ],
    },
    'E8 Zero MAX Futures': {
      pills: E8_ZERO_PILLS,
      rows: [
        { label: 'Payout cap', bySize: { 25000: '$1,500', 50000: '$3,000', 100000: '$5,000', 200000: '$7,000' } },
        { label: 'Funded contracts (minis)', bySize: E8_ZERO_CONTRACTS },
      ],
    },
    'E8 Zero Starter Futures': {
      pills: E8_ZERO_PILLS,
      rows: [{ label: 'Payout cap', bySize: { 25000: '$600', 50000: '$1,000', 100000: '$1,500', 150000: '$2,000' } }],
    },
  },
  'traders-launch': {
    Premium: {
      pills: TL_PILLS,
      rows: [{ label: 'Buffer before 1st payout', bySize: { 100000: '$1,000', 200000: '$2,000', 300000: '$3,000' } }],
    },
    Static: {
      pills: TL_STATIC_PILLS,
      rows: [
        {
          label: 'Daily earnings cap, 60% / 80% split',
          bySize: { 25000: '$1,000', 50000: '$2,000', 100000: '$4,000' },
        },
      ],
    },
    'Legacy NYC': {
      pills: TL_PILLS,
      rows: [{ label: 'Buffer before 1st payout', bySize: { 100000: '$1,000', 200000: '$1,000', 300000: '$2,000' } }],
    },
    Drop: { pills: TL_DROP2_PILLS, rows: [] },
  },
  blusky: {
    Launch: {
      pills: BLUSKY_SFA_PILLS,
      rows: [
        { label: 'Buffer target', bySize: { 50000: '$3,000', 100000: '$3,500', 200000: '$3,000' } },
        { label: BLUSKY_CAP, bySize: { 50000: '$2,500', 100000: '$3,000', 200000: '$2,500' } },
      ],
    },
    Propel: {
      pills: BLUSKY_SFA_PILLS,
      rows: [
        {
          label: 'Buffer target',
          bySize: { 25000: '$1,500', 50000: '$3,000', 100000: '$3,500', 150000: '$2,000', 200000: '$3,000', 300000: '$3,500' },
        },
        {
          label: BLUSKY_CAP,
          bySize: { 25000: '$1,500', 50000: '$2,500', 100000: '$3,000', 150000: '$1,500', 200000: '$2,500', 300000: '$3,000' },
        },
      ],
    },
    Orbit: {
      pills: BLUSKY_ORBIT_PILLS,
      rows: [
        { label: 'Payouts from', bySize: { 50000: '$52,000', 100000: '$103,000', 150000: '$154,500', 200000: '$203,000' } },
        { label: BLUSKY_CAP, bySize: { 50000: '$2,000', 100000: '$2,500', 150000: '$3,000', 200000: '$2,500' } },
        {
          label: 'Funded contracts',
          bySize: { 50000: '2 minis or 20 micros', 100000: '3 minis or 30 micros', 150000: '5 minis or 50 micros', 200000: '3 minis or 30 micros' },
        },
      ],
    },
    'Direct 2 Funded': bluskyInstant('$3,500', '$3,000'),
    'Instant Funded': bluskyInstant('$53,000', '$2,500'),
  },
};

// Firms whose own pages say there is no activation fee. Traders Launch, traderslaunch.com/faq
// read 12/10/2026: « None. You pay the evaluation fee once. No activation fee when you pass ».
const NO_ACTIVATION_FEE = new Set(['traders-launch']);

// The other profit splits a firm sells each account at (scraped into plan.splitPrices:
// Traders Launch Premium 60%, Static 60% and 90%, Legacy NYC 55%), lowest first.
function otherSplits(plans: Plan[]): string[] {
  const keys = new Set(plans.flatMap((p) => Object.keys(p.splitPrices ?? {})));
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

function fundedFor(firm: Firm, pr: Program): Funded | null {
  const by = FUNDED[firm.id];
  if (!by) return null;
  // A later drop has its own terms: the written ones only cover the drop they were read on.
  if (pr.name === 'Drop' && !pr.plans.every((pl) => pl.note?.startsWith(DROP_TERMS_FOR))) return null;
  return by[pr.name] ?? null;
}

// Futures say Evaluation or Instant for every firm, Lucid and Tradeify included (Angelo,
// 01/11/2026: « lucid tradeify met evaluation »).
const stepsOf = (pr: Program) => (pr.type === 'instant' || pr.steps === 'instant' ? 'Instant' : 'Evaluation');

// BluSky's instant accounts write their own split in the plan note (« Profit split 50% for 30
// trading days, then 80%. »), not the firm's 90%.
const NOTE_SPLIT = /^Profit split ([^.]+)\./;

function splitVal(firm: Firm, pr: Program, plan: Plan): Val {
  const own = pr.split ?? NOTE_SPLIT.exec(plan.note ?? '')?.[1];
  if (own) return { text: own, sort: firstNumber(own) };
  // The price shown is the firm's main split; the others it sells the account at, in brackets.
  const others = Object.keys(plan.splitPrices ?? {}).sort((a, b) => Number(a) - Number(b));
  const text = others.length
    ? `${firm.split} (${others.map((s) => `${s}%`).join(', ')} option${others.length > 1 ? 's' : ''})`
    : firm.split;
  return { text, sort: firstNumber(firm.split) };
}

const figure = (text: string | undefined): Val | undefined => (text ? textVal(text, firstNumber(text)) : undefined);

function maxPayout(pr: Program, funded: Funded | null, size: number): Val | undefined {
  if (pr.maxPayout) return figure(pr.maxPayout);
  const row = funded?.rows.find((r) => /^Payout caps?\b/.test(r.label));
  const v = row?.bySize[size];
  if (row && v) return { text: v, sort: firstNumber(v), title: row.label };
  return figure(pillValue(funded, 'Payout cap'));
}

function consistency(pr: Program, plan: Plan, funded: Funded | null): Val | undefined {
  const ev = pr.evalConsistency ?? plan.consistency;
  const fu = pr.fundedConsistency ?? pillValue(funded, 'Consistency');
  if (ev == null && fu == null) return undefined;
  return { text: `${ev ?? '—'} / ${fu ?? '—'}`, sort: firstNumber(ev) };
}

// "On-demand payouts" tells a trader nothing (Angelo, 12/10/2026: « enlève le on demand
// payout, car point de vue trader ça veut rien dire »); a real pace (Daily) stays.
const pace = (firm: Firm) => (firm.payout && !/on.?demand/i.test(firm.payout) ? firm.payout : undefined);

function activation(firm: Firm, plan: Plan, firmHasFee: boolean): Val | undefined {
  const fee = plan.activationFee;
  if (fee != null && fee > 0) return { text: money(fee), sort: fee };
  // « No activation fee » where the firm writes it, or where another plan of the firm has one.
  if (fee === 0 || NO_ACTIVATION_FEE.has(firm.id) || firmHasFee) return { text: 'None', sort: 0, muted: true };
  return undefined;
}

type Link = Pick<CompareRow, 'href' | 'affiliate' | 'code'>;

function rowsOf(firm: Firm, link: Link): CompareRow[] {
  const firmHasFee = firm.programs.some((pr) => pr.plans.some((p) => (p.activationFee ?? 0) > 0));
  return firm.programs.flatMap((pr) => {
    const funded = fundedFor(firm, pr);
    return pr.plans.map((plan, i): CompareRow => {
      const price = effectivePrice(firm, plan);
      const steps = stepsOf(pr);
      // No profit target written on an instant account that has none (Angelo, 22/10/2026).
      const target =
        plan.profitTarget != null
          ? { text: money(plan.profitTarget), sort: plan.profitTarget }
          : pr.type === 'instant'
            ? undefined
            : textVal('None');
      return {
        key: `${firm.id}|${pr.name}|${plan.size}|${i}`,
        family: 'futures',
        firmId: firm.id,
        firmName: firm.name,
        logo: FIRM_LOGOS[firm.id] ?? null,
        program: pr.name,
        size: plan.size,
        steps,
        price: {
          kind: 'price',
          // A list price equal to the price paid (no code on sale) is not struck through.
          list: price.was ?? price.now,
          discounted: price.was != null && price.was > price.now ? price.now : null,
          alt: null,
          per: pr.priceType === 'monthly' ? '/month' : 'one-time',
          from: !!plan.priceAmbiguous,
        },
        cells: {
          size: { text: sizeLabel(plan.size), sort: plan.size },
          steps: { text: steps, sort: steps },
          activation: activation(firm, plan, firmHasFee),
          contracts: { text: plan.contracts, sort: firstNumber(plan.contracts) },
          target,
          maxLoss: { text: money(plan.maxDrawdown), sort: plan.maxDrawdown },
          lossType: {
            text: '',
            sort: DD_LABEL[plan.ddType],
            tag: {
              label: DD_LABEL[plan.ddType],
              title: DD_TITLE[plan.ddType],
              accent: plan.ddType !== 'EOD' && plan.ddType !== 'Static',
            },
          },
          split: splitVal(firm, pr, plan),
          maxPayout: maxPayout(pr, funded, plan.size),
          minPayout: figure(pr.minPayout ?? pillValue(funded, 'Minimum payout')),
          consistency: consistency(pr, plan, funded),
          payoutFreq: figure(pr.payoutFrequency ?? pillValue(funded, 'Payout request') ?? pace(firm)),
          checked: { text: humanDate(firm.lastChecked), sort: firm.lastChecked },
        },
        lastChecked: firm.lastChecked,
        note: plan.note,
        ...link,
      };
    });
  });
}

// A partner firm: its /go/ link, and code JTNQ unless codes.md says the link carries it.
function partnerLink(firm: Firm): Link {
  const promo = firm.programs.length ? promoFor(firm, firm.programs[0]) : { code: null, title: '' };
  const code = discountViaLink(firm.id) ? null : chipCode(firm, promo.code);
  return {
    href: goHref('prop-firms', firm.id),
    affiliate: true,
    code: code ? { code, title: promo.title || 'My affiliate code' } : null,
  };
}

// A firm Angelo is not partnered with: its official site, its public code as written.
const extraLink = (firm: Firm): Link => ({
  href: firm.url,
  affiliate: false,
  code: firm.code ? { code: firm.code, title: 'The firm’s public code' } : null,
});

function firmView(firm: Firm, rows: CompareRow[], link: Link): FirmView {
  const programs = firm.programs;
  const allPlans = programs.flatMap((p) => p.plans);
  const p = pace(firm);
  // The header gives the best split on sale (Angelo, 21/10/2026: « si y a une option 90% pk
  // tu mettrais pas a 90% »).
  const splits = otherSplits(allPlans);
  const topSplit = Math.max(parseFloat(firm.split) || 0, ...splits.map(Number));
  const splitText = splits.length ? `Up to ${topSplit}%` : firm.split;
  // A fee kind shared by every plan goes into the firm's summary line (Angelo, 12/10/2026: « mets-le
  // ici et enlève la case »), said « No activation fee » where the firm writes it (« faut juste
  // préciser "no activation fee" à la place de one-time fee »).
  const kinds = new Set(programs.map((pr) => pr.priceType));
  const oneFee = kinds.size === 1 ? (kinds.has('monthly') ? 'Monthly fee' : 'One-time fee') : null;
  const sharedFee = oneFee === 'One-time fee' && NO_ACTIVATION_FEE.has(firm.id) ? 'No activation fee' : oneFee;

  // "from $X" on the card: the cheapest price on sale, other splits included (Traders Launch
  // Legacy NYC 55% is below every 80% price).
  let from = cheapest(rows);
  const pct = firm.codeDiscountPct ?? 0;
  for (const pl of allPlans)
    for (const sp of Object.values(pl.splitPrices ?? {})) {
      // A plan on a public promo (originalPrice) already lists discounted split prices.
      const now = pl.originalPrice != null ? sp : Math.round(sp * (100 - pct)) / 100;
      if (from == null || now < from.now) from = { now, per: null };
    }

  return {
    id: firm.id,
    name: firm.name,
    logo: FIRM_LOGOS[firm.id] ?? null,
    summary: `${splitText} split${p ? ` · ${p} payouts` : ''}${sharedFee ? ` · ${sharedFee}` : ''}`,
    code: link.code,
    // A firm whose scraper failed keeps its old prices while generatedAt says today: name
    // the firms that are behind instead of advertising one sync date for everyone.
    stale:
      firm.lastChecked !== DATA.generatedAt
        ? {
            label: `Prices ${humanDate(firm.lastChecked)}`,
            title: `Prices last verified on ${humanDate(firm.lastChecked)}, not at the last daily sync (${humanDate(DATA.generatedAt)}). Check the live checkout price.`,
          }
        : null,
    from,
    href: link.href,
  };
}

const PARTNERS = DATA.firms.map((firm) => {
  const link = partnerLink(firm);
  const rows = rowsOf(firm, link);
  return { view: firmView(firm, rows, link), rows };
});

export const FUTURES_FIRMS: FirmView[] = PARTNERS.map((p) => p.view);

// The extra firms' promo ends, for the clock (usePromoClock) to wake up at.
export const EXTRA_PROMO_ENDS: readonly number[] = promoEnds(EXTRA.firms);
const EXTRA_ONLY = EXTRA.firms.filter((f) => !DATA.firms.some((d) => d.id === f.id));

// Partners and the extra firms, one row per plan, at time `at` (the promo clock). A firm in
// both files is a partner.
export function futuresRows(at: number): CompareRow[] {
  return [
    ...PARTNERS.flatMap((p) => p.rows),
    ...EXTRA_ONLY.map((f) => firmAt(f, at)).flatMap((f) => rowsOf(f, extraLink(f))),
  ];
}

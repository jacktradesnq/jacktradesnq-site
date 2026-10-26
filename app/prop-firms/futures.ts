// Futures firms (public/data/prop-firms.json, scraped daily by scripts/scrape-prop-firms.mjs)
// turned into FirmView. Futures limits are dollar amounts that change with the account
// size, so a rule that differs between two sizes of the same program is written in each
// price cell; a rule fixed per program gets its own row; a rule fixed for the whole firm
// goes to "Same on every plan".

import rawData from '@/public/data/prop-firms.json';
import { goHref } from '@/lib/go-links';
import { money } from './shared';
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type Funded, type Pill, type PriceCell } from './firm-view';
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
  activationFee?: number | null;
  // One product live at several prices at once: the cheapest is shown, and said.
  priceAmbiguous?: boolean;
  // What qualifies the price, written by the source (Legacy NYC hours, the split the
  // price is for). A plan cheaper for a stated reason carries that reason.
  note?: string;
  // The same account sold at other profit splits, list prices: {"60": 119, "90": 169}.
  splitPrices?: Record<string, number>;
};
type Program = {
  name: string;
  type: 'eval' | 'instant';
  priceType: 'one-time' | 'monthly';
  promoCode?: string;
  promoLabel?: string;
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
  programs: Program[];
};
type PropData = { generatedAt: string; firms: Firm[] };

const DATA = rawData as unknown as PropData;

const FIRM_LOGOS: Record<string, string> = {
  'traders-launch': '/logos/traders-launch.png',
  'e8-markets': '/logos/e8-markets.svg',
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
const DD_LEGEND: Record<DdType, string> = {
  EOD: 'No trail — fixed loss limit, never moves',
  'EOD Trailing': 'EOD Trail — limit follows your end-of-day balance',
  Intraday: 'Intraday Trail — limit follows your equity in real time',
  Static: 'Static — fixed loss limit, does not trail',
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

type Field = {
  label: string;
  short: string;
  cell: (p: Plan) => Cell;
  common: (c: Cell) => string;
  // Left out when no plan of the firm has it (no activation fee anywhere, no note).
  optional?: (p: Plan) => boolean;
};

const FIELDS: Field[] = [
  {
    label: 'Profit target',
    short: 'Target',
    cell: (p) => (p.profitTarget != null ? { text: money(p.profitTarget) } : { text: 'None', muted: true }),
    common: (c) => (c.muted ? 'No profit target' : `${c.text} profit target`),
  },
  {
    label: 'Max loss limit',
    short: 'Max loss',
    cell: (p) => ({ text: money(p.maxDrawdown) }),
    common: (c) => `${c.text} max loss limit`,
  },
  {
    label: 'Loss limit type',
    short: 'Type',
    cell: (p) => ({
      text: '',
      tag: { label: DD_LABEL[p.ddType], title: DD_TITLE[p.ddType], accent: p.ddType !== 'EOD' && p.ddType !== 'Static' },
    }),
    common: (c) => `${c.tag?.label} loss limit`,
  },
  {
    label: 'Daily loss',
    short: 'Daily loss',
    // A program without one gets no pill ("–"), the same rule as the row itself.
    cell: (p) => (p.dailyLoss != null ? { text: money(p.dailyLoss), soft: !!p.dailyLossSoft } : { text: '–', muted: true }),
    common: (c) => `${c.text} daily loss${c.soft ? ' (soft)' : ''}`,
    // Shown only when one plan of the firm has a daily loss figure: no limit is not
    // mentioned (Angelo, 21/10/2026 : « si y a pas de daily loss limit ne le mentionne pas »).
    optional: (p) => p.dailyLoss != null,
  },
  {
    label: 'Consistency',
    short: 'Consistency',
    cell: (p) =>
      p.consistency == null
        ? { text: 'Not published', muted: true }
        : p.consistency === 'None'
          ? { text: 'None', muted: true }
          : { text: p.consistency },
    common: (c) =>
      c.text === 'None' ? 'No consistency rule' : c.muted ? 'Consistency not published' : `${c.text} consistency rule`,
  },
  {
    label: 'Days to pass',
    short: 'Min days',
    // No figure, no pill: Traders Launch Static has none, its consistency says it (Angelo, 22/10/2026 : « le
    // 40% consistency fait comprendre indicrement que c du 3 wining day minimum. donc oui pas besoin »).
    cell: (p) => (p.minDays != null ? { text: `${p.minDays} minimum` } : { text: '–', muted: true }),
    common: (c) => `Days to pass: ${c.text}`,
    optional: (p) => p.minDays != null,
  },
  {
    label: 'Contracts',
    short: 'Contracts',
    cell: (p) => ({ text: p.contracts }),
    common: (c) => `Up to ${c.text}`,
  },
  {
    label: 'Activation fee',
    short: 'Activation',
    cell: (p) => (p.activationFee != null ? { text: `+ ${money(p.activationFee)}` } : { text: 'None', muted: true }),
    common: (c) => (c.muted ? 'No activation fee' : `${c.text} activation fee`),
    optional: (p) => p.activationFee != null,
  },
  {
    label: 'Notes',
    short: 'Note',
    cell: (p) => {
      // The price rows now say which split they are for.
      const note = p.note?.replace(SPLIT_NOTE, '').trim();
      return note ? { text: note, note: true } : { text: '–', muted: true };
    },
    common: (c) => c.text,
    optional: (p) => !!p.note?.replace(SPLIT_NOTE, '').trim(),
  },
];

const cellKey = (c: Cell) => JSON.stringify([c.text, c.tag?.label ?? '', !!c.soft]);

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
  },
};

// Firms whose own pages say there is no activation fee. Traders Launch, traderslaunch.com/faq
// read 12/10/2026: « None. You pay the evaluation fee once. No activation fee when you pass ».
const NO_ACTIVATION_FEE = new Set(['traders-launch']);

// Rules a firm publishes for every account, outside its price cards. Traders Launch FAQ
// (traderslaunch.com, 21/10/2026): « The evaluation window is 60 days. If you haven't passed
// by day 60 but you're above 50% of your profit target, you get a free 30-day extension ».
const FIRM_RULES: Record<string, string[]> = {
  'traders-launch': ['60 days to pass, +30 free if above 50% of the target'],
};

const SPLIT_NOTE = / ?Price shown for the 80% split\./;

// The other profit splits a firm sells each account at (scraped into plan.splitPrices:
// Traders Launch Premium 60%, Static 60% and 90%, Legacy NYC 55%), lowest first.
function otherSplits(plans: Plan[]): string[] {
  const keys = new Set(plans.flatMap((p) => Object.keys(p.splitPrices ?? {})));
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

// "from $X" on the firm's card: the cheapest price on sale, other splits included (Traders
// Launch Legacy NYC 55% is below every 80% price).
function cheapestWithSplits(from: FirmView['from'], extra: NonNullable<FirmView['extraPrices']>): FirmView['from'] {
  let best = from;
  for (const x of extra)
    for (const byProgram of x.byProgram)
      for (const p of Object.values(byProgram ?? {}))
        if (best == null || p.now < best.now) best = { now: p.now, per: null };
  return best;
}

function firmView(firm: Firm): FirmView {
  const programs = firm.programs;
  const allPlans = programs.flatMap((p) => p.plans);
  const fields = FIELDS.filter((f) => !f.optional || allPlans.some(f.optional));
  // A field whose value moves with the size inside one program is written per size.
  const perSize = fields.filter((f) =>
    programs.some((pr) => new Set(pr.plans.map((pl) => cellKey(f.cell(pl)))).size > 1),
  );
  const perProgram = fields.filter((f) => !perSize.includes(f));

  const kind = (pr: Program) => (pr.type === 'eval' ? 'Evaluation' : 'Instant funding');
  const fee = (pr: Program) => (pr.priceType === 'monthly' ? 'Monthly fee' : 'One-time fee');
  const fundedBy = FUNDED[firm.id];
  const { common, rules } = splitCommon([
    // "Evaluation" only says something next to straight-to-funded accounts (Angelo, 12/10/2026:
    // « si la prop firm n'a pas de straight to funded ne précise pas évaluation »).
    {
      label: 'Program type',
      cells: programs.map((pr) => ({ text: kind(pr) })),
      common: (c) => c.text,
      skip: programs.every((pr) => pr.type === 'eval'),
    },
    { label: 'Fee', cells: programs.map((pr) => ({ text: fee(pr) })), common: (c) => c.text },
    ...perProgram.map((f) => ({
      label: f.label,
      cells: programs.map((pr) => f.cell(pr.plans[0])),
      common: f.common,
    })),
  ]);
  // "On-demand payouts" tells a trader nothing (Angelo, 12/10/2026: « enlève le on demand
  // payout, car point de vue trader ça veut rien dire »); a real pace (Daily) stays.
  const pace = /on.?demand/i.test(firm.payout) ? null : `${firm.payout} payouts`;
  // With a 60% version the price rows name each split; the firm line says « Up to 80% »,
  // the checkout's own words (« Up to 80% profit split »).
  // The header gives the best split on sale (Angelo, 21/10/2026: « si y a une option 90% pk
  // tu mettrais pas a 90% »).
  const splits = otherSplits(allPlans);
  const topSplit = Math.max(parseFloat(firm.split) || 0, ...splits.map(Number));
  const splitText = splits.length ? `Up to ${topSplit}%` : firm.split;
  common.splice(2, 0, ...(splits.length ? [] : [`${firm.split} profit split`]), ...(pace ? [pace] : []));
  common.push(...(FIRM_RULES[firm.id] ?? []));
  // A fee kind shared by every plan goes up into the firm's summary line, not a column
  // (Angelo, 12/10/2026: « mets-le ici et enlève la case […] si tous les plans n'ont pas
  // de activation fee, pourquoi le préciser ? »).
  const oneFee = common.find((t) => t === 'One-time fee' || t === 'Monthly fee');
  if (oneFee) common.splice(common.indexOf(oneFee), 1);
  // Said as "No activation fee" where the firm writes it (Angelo, 12/10/2026: « faut juste
  // préciser "no activation fee" à la place de one-time fee »).
  const sharedFee = oneFee === 'One-time fee' && NO_ACTIVATION_FEE.has(firm.id) ? 'No activation fee' : oneFee;

  const sizes = [...new Set(allPlans.map((p) => p.size))].sort((a, b) => a - b);
  const sizeRows = sizes.map((size) => ({
    size,
    cells: programs.map((pr): PriceCell => {
      const plan = pr.plans.find((p) => p.size === size);
      if (!plan) return null;
      const price = effectivePrice(firm, plan);
      return {
        kind: 'price',
        now: price.now,
        was: price.was,
        per: pr.priceType === 'monthly' ? '/mo' : null,
        from: !!plan.priceAmbiguous,
        lines: perSize.map((f) => ({ label: f.short, cell: f.cell(plan) })),
      };
    }),
  }));

  const pct = firm.codeDiscountPct ?? 0;
  const extraPrices: NonNullable<FirmView['extraPrices']> = splits.map((split) => ({
    label: `${split}% split`,
    byProgram: programs.map((pr) => {
      const priced = pr.plans.filter((pl) => pl.splitPrices?.[split] != null);
      if (!priced.length) return null;
      return Object.fromEntries(
        priced.map((pl) => {
          const price = pl.splitPrices![split];
          // A plan on a public promo (originalPrice) already lists discounted split prices, like effectivePrice.
          if (pl.originalPrice != null) return [pl.size, { now: price, was: null }];
          return [pl.size, { now: Math.round(price * (100 - pct)) / 100, was: pct ? price : null }];
        }),
      );
    }),
  }));

  const promo = programs.length ? promoFor(firm, programs[0]) : { code: null, title: '' };
  const viaLink = discountViaLink(firm.id);
  const code = viaLink ? null : chipCode(firm, promo.code);
  const viaCode = allPlans.some((p) => effectivePrice(firm, p).viaCode);
  const ddTypes = [...new Set(allPlans.map((p) => p.ddType))];
  const legend = ddTypes.map((t) => DD_LEGEND[t]);
  if (allPlans.some((p) => p.dailyLossSoft)) legend.push('soft — position flattened, account survives');
  if (allPlans.some((p) => p.priceAmbiguous)) legend.push('"from $X" — the plan is on sale at several prices; the lowest is shown');

  return {
    id: firm.id,
    name: firm.name,
    logo: FIRM_LOGOS[firm.id] ?? null,
    summary: `${splitText} split${pace ? ` · ${pace}` : ''}${sharedFee ? ` · ${sharedFee}` : ''}`,
    code: code ? { code, title: promo.title || 'My affiliate code' } : null,
    stale:
      firm.lastChecked !== DATA.generatedAt
        ? {
            label: `Prices ${humanDate(firm.lastChecked)}`,
            title: `Prices last verified on ${humanDate(firm.lastChecked)}, not at the last daily sync (${humanDate(DATA.generatedAt)}). Check the live checkout price.`,
          }
        : null,
    from: cheapestWithSplits(cheapest(sizeRows), extraPrices),
    columns: programs.map((pr) => ({ name: pr.name })),
    common,
    rules,
    priceTitle: code ? `Price with code ${code}` : viaLink && viaCode ? 'Price via my link' : 'Price',
    priceSub: viaCode
      ? viaLink
        ? `${firm.codeDiscountPct}% off via my link, no code to type`
        : `${firm.codeDiscountPct}% off with code ${code}`
      : promo.title || null,
    sizes: sizeRows,
    funded: fundedBy ? programs.map((pr) => fundedBy[pr.name] ?? null) : undefined,
    ...(splits.length ? { priceLabel: `${firm.split} split`, extraPrices } : {}),
    legend,
    href: goHref('prop-firms', firm.id),
  };
}

// A firm whose scraper failed keeps its old prices while generatedAt says today: name
// the firms that are behind instead of advertising one sync date for everyone.


export const FUTURES_FIRMS: FirmView[] = DATA.firms.map(firmView);

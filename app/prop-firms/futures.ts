// Futures firms (public/data/prop-firms.json, scraped daily by scripts/scrape-prop-firms.mjs)
// turned into FirmView. Futures limits are dollar amounts that change with the account
// size, so a rule that differs between two sizes of the same program is written in each
// price cell; a rule fixed per program gets its own row; a rule fixed for the whole firm
// goes to "Same on every plan".

import rawData from '@/public/data/prop-firms.json';
import { goHref } from '@/lib/go-links';
import { money } from './shared';
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type Funded, type Pill, type PriceCell } from './firm-view';

// Affiliate code applied on every firm link.
const CODE = 'JTNQ';

type DdType = 'EOD' | 'EOD Trailing' | 'Intraday';
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
  contracts: string;
  activationFee?: number | null;
  // One product live at several prices at once: the cheapest is shown, and said.
  priceAmbiguous?: boolean;
  // What qualifies the price, written by the source (Legacy NYC hours, the split the
  // price is for). A plan cheaper for a stated reason carries that reason.
  note?: string;
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
};
const DD_TITLE: Record<DdType, string> = {
  EOD: 'Static drawdown — fixed loss limit from your starting balance',
  'EOD Trailing': 'Trailing drawdown — the limit follows your end-of-day balance highs',
  Intraday: 'Trailing drawdown — the limit follows your equity in real time',
};
const DD_LEGEND: Record<DdType, string> = {
  EOD: 'No trail — fixed loss limit, never moves',
  'EOD Trailing': 'EOD Trail — limit follows your end-of-day balance',
  Intraday: 'Intraday Trail — limit follows your equity in real time',
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

// Price paid through Angelo's link/code. His permanent code discount (Traders Launch
// -15%) only applies when the firm shows no public promo (originalPrice == null) —
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
      tag: { label: DD_LABEL[p.ddType], title: DD_TITLE[p.ddType], accent: p.ddType !== 'EOD' },
    }),
    common: (c) => `${c.tag?.label} loss limit`,
  },
  {
    label: 'Daily loss',
    short: 'Daily loss',
    cell: (p) =>
      p.dailyLoss != null ? { text: money(p.dailyLoss), soft: !!p.dailyLossSoft } : { text: 'None', muted: true },
    common: (c) => (c.muted ? 'No daily loss limit' : `${c.text} daily loss${c.soft ? ' (soft)' : ''}`),
    // No key: no source publishes a daily loss rule either way (Traders Launch, 12/10/2026),
    // so nothing is said rather than "None".
    optional: (p) => 'dailyLoss' in p,
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
const E8_ZERO_PILLS: Pill[] = [
  { label: 'Winning days', value: 'None' },
  { label: 'Consistency', value: 'None' },
  { label: 'Payout request', value: 'Every day' },
  { label: 'Minimum payout', value: '$100' },
  { label: 'Profit split', value: '80% (100% option)' },
  { label: 'Payouts per account', value: '4, then a free challenge' },
];
const E8_ZERO_CONTRACTS = { 25000: '1 → 2 → 3', 50000: '2 → 3 → 5', 100000: '3 → 5 → 8', 200000: '4 → 7 → 10' };
const TL_PILLS: Pill[] = [
  { label: 'Winning days', value: 'None' },
  { label: 'Consistency', value: 'None' },
  { label: 'Payout from', value: '+1% profit' },
  { label: 'Payout cap', value: 'None' },
  { label: 'Drawdown', value: 'Locks at start balance, payouts don\'t lower it' },
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
    '1-Step': {
      pills: TL_PILLS,
      rows: [{ label: 'Buffer before 1st payout', bySize: { 100000: '$1,000', 200000: '$2,000', 300000: '$3,000' } }],
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

// The 60% split version of the same accounts, list prices from the firm's checkout read on
// 12/10/2026 (« 60% Profit Split $159 $99 evaluation fee »; /pricing: « Choose a 60% profit
// split from $99 or an 80% profit split from $159 »). Same target, loss limit and buffer.
// The scraper reads the 80% prices; the JSON plans are those. Legacy NYC sells at 80% only
// on the checkout (its 55% shows on the home page alone), so it has none.
const SPLIT_60: Record<string, Record<string, Record<number, number>>> = {
  'traders-launch': { '1-Step': { 100000: 99, 200000: 199, 300000: 399 } },
};
const SPLIT_NOTE = / ?Price shown for the 80% split\./;

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
  const splitText = SPLIT_60[firm.id] ? `Up to ${firm.split}` : firm.split;
  common.splice(2, 0, ...(SPLIT_60[firm.id] ? [] : [`${firm.split} profit split`]), ...(pace ? [pace] : []));
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

  const promo = programs.length ? promoFor(firm, programs[0]) : { code: null, title: '' };
  const code = chipCode(firm, promo.code);
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
    from: cheapest(sizeRows),
    columns: programs.map((pr) => ({ name: pr.name })),
    common,
    rules,
    priceTitle: code ? `Price with code ${code}` : 'Price',
    priceSub: viaCode ? `${firm.codeDiscountPct}% off with code ${code}` : promo.title || null,
    sizes: sizeRows,
    funded: fundedBy ? programs.map((pr) => fundedBy[pr.name] ?? null) : undefined,
    ...(SPLIT_60[firm.id]
      ? {
          priceLabel: `${firm.split} split`,
          extraPrices: [
            {
              label: '60% split',
              byProgram: programs.map((pr) => {
                const list = SPLIT_60[firm.id][pr.name];
                if (!list) return null;
                const pct = firm.codeDiscountPct ?? 0;
                return Object.fromEntries(
                  Object.entries(list).map(([size, price]) => [
                    Number(size),
                    { now: Math.round(price * (100 - pct)) / 100, was: pct ? price : null },
                  ]),
                );
              }),
            },
          ],
        }
      : {}),
    legend,
    href: goHref('prop-firms', firm.id),
  };
}

// A firm whose scraper failed keeps its old prices while generatedAt says today: name
// the firms that are behind instead of advertising one sync date for everyone.


export const FUTURES_FIRMS: FirmView[] = DATA.firms.map(firmView);

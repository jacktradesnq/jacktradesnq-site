// Futures firms (public/data/prop-firms.json, scraped daily by scripts/scrape-prop-firms.mjs)
// turned into FirmView. Futures limits are dollar amounts that change with the account
// size, so a rule that differs between two sizes of the same program is written in each
// price cell; a rule fixed per program gets its own row; a rule fixed for the whole firm
// goes to "Same on every plan".

import rawData from '@/public/data/prop-firms.json';
import { goHref } from '@/lib/go-links';
import { money } from './shared';
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type PriceCell } from './firm-view';

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
  // A rule no source publishes has no key: the "Legacy NYC" cards of Traders Launch say
  // nothing of their consistency, and inventing a value would be worse than saying so.
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
    cell: (p) => (p.note ? { text: p.note, note: true } : { text: '–', muted: true }),
    common: (c) => c.text,
    optional: (p) => !!p.note,
  },
];

const cellKey = (c: Cell) => JSON.stringify([c.text, c.tag?.label ?? '', !!c.soft]);

// Winning days needed before a payout, per program: the figure, or "None" (Angelo,
// 12/10/2026: « mets juste une colonne winning day et tu mets le chiffre, si y a pas tu
// mets none »). E8 help center, read 12/10/2026: Zero « No minimum profitable days »;
// Signature « Minimum profitable days between each payout: 5 (does not apply for first
// payout) », a profitable day being +0.3% closed PnL.
const WINNING_DAYS: Record<string, Record<string, number | null>> = {
  'e8-markets': {
    'E8 Signature Futures': 5,
    'E8 Zero MAX Futures': null,
    'E8 Zero Starter Futures': null,
  },
  // traderslaunch.com/faq, read 12/10/2026: « Simfunded accounts have no minimum trading
  // days before requesting a payout ».
  'traders-launch': { '1-Step': null, 'Legacy NYC': null },
};

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
  const winBy = WINNING_DAYS[firm.id];
  const winCell = (pr: Program): Cell => {
    const n = winBy?.[pr.name];
    return n == null ? { text: 'None', muted: true } : { text: String(n) };
  };
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
    {
      label: 'Winning days',
      cells: programs.map(winCell),
      common: (c) => (c.muted ? 'No winning days' : `${c.text} winning days`),
      skip: !winBy,
    },
    ...perProgram.map((f) => ({
      label: f.label,
      cells: programs.map((pr) => f.cell(pr.plans[0])),
      common: f.common,
    })),
  ]);
  common.splice(2, 0, `${firm.split} profit split`, `${firm.payout} payouts`);
  // A fee kind shared by every plan goes up into the firm's summary line, not a column
  // (Angelo, 12/10/2026: « mets-le ici et enlève la case […] si tous les plans n'ont pas
  // de activation fee, pourquoi le préciser ? »).
  const sharedFee = common.find((t) => t === 'One-time fee' || t === 'Monthly fee');
  if (sharedFee) common.splice(common.indexOf(sharedFee), 1);

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
    summary: `${firm.split} split · ${firm.payout} payouts${sharedFee ? ` · ${sharedFee}` : ''}`,
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
    legend,
    note: NOTE,
    href: goHref('prop-firms', firm.id),
  };
}

// A firm whose scraper failed keeps its old prices while generatedAt says today: name
// the firms that are behind instead of advertising one sync date for everyone.
const behindFirms = DATA.firms.filter((f) => f.lastChecked !== DATA.generatedAt);
const SYNC_NOTE =
  behindFirms.length === 0
    ? `Prices and promo codes auto-checked daily — last sync ${humanDate(DATA.generatedAt)}.`
    : `Prices and promo codes auto-checked daily — last sync ${humanDate(DATA.generatedAt)}, except ${behindFirms
        .map((f) => `${f.name}, checked ${humanDate(f.lastChecked)}`)
        .join('; ')}.`;
const NOTE = `Figures pulled from each firm's official site. ${SYNC_NOTE} Risk rules verified manually 19 Jul 2026. Promos change fast; the live checkout price wins.`;

export const FUTURES_FIRMS: FirmView[] = DATA.firms.map(firmView);

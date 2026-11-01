// The shapes /prop-firms draws, whatever the family. Each family (futures.ts, perps.ts) turns
// its own JSON into:
// - FirmView: a partner firm's card and its window (Angelo, 11/10/2026: « ils choisissent juste
//   entre les trois types de prop firm, et après […] ils cliquent dessus »);
// - CompareRow: one plan (firm × program × size) of the comparator, « Prop compare » (Angelo,
//   01/11/2026). The firm window no longer holds a table of plans: « See all plans » opens the
//   comparator on that firm.

import { firstNumber } from '@/lib/compare-order.mjs';
import {
  consistencyWords, contractsWords, dailyLossWords, moneyFirst, payoutFreqWords, payoutWords, splitWords,
} from '@/lib/compare-words.mjs';

export type Family = 'futures' | 'perps';

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'futures', label: 'Futures' },
  { id: 'perps', label: 'Perps' },
];

export type Cell = {
  text: string;
  // Drawdown kind shown as a pill (EOD Trail, Static…), with its explanation on hover.
  tag?: { label: string; title: string; accent: boolean };
  // "None": a rule the firm says it does not have, not a figure.
  muted?: boolean;
};

// One cell of the comparator: what it says, and what a click on its column sorts by.
export type Val = Cell & {
  sort: number | string | null;
  // A second line under the figure (the dollar max loss of a perps plan).
  sub?: string;
  // Where the value was read, on hover (« Payout caps 1 / 2 / 3 / 4 »).
  title?: string;
};

// Prices without and with the discount (code JTNQ, the firm's public promo, a public code):
// the comparator's « Apply discount » switch picks one.
export type ComparePrice =
  | {
      kind: 'price';
      list: number;
      discounted: number | null;
      // Other versions of the same account, each after a « / » (MFP Elite 3% DLL, Vest 90% split,
      // E8 One 90% and 100% payout).
      alts: { list: number; discounted: number | null }[];
      per: '/month' | 'one-time' | null;
      // Several prices live for the same product: the cheapest is shown, prefixed "from".
      from: boolean;
    }
  | { kind: 'text'; text: string }; // "Coming soon"

// 'both': the same plan is sold with and without one (MFP Elite / Elite 3% DLL, Vest 1-Step 3%, 4% or none).
export type DailyLoss = 'with' | 'without' | 'both' | null;

export type CompareRow = {
  key: string;
  family: Family;
  firmId: string;
  firmName: string;
  logo: string | null;
  program: string;
  size: number;
  steps: string;
  price: ComparePrice;
  // Keyed by column id (compare/columns.ts); no key = nothing published, drawn « — ».
  cells: Partial<Record<string, Val>>;
  // For the Max loss type filter: the label the column shows (EOD Trail, Static…); null = not published.
  lossType: string | null;
  // For the Daily loss limit filter; null = not published (shown under « Any » only).
  dailyLoss: DailyLoss;
  // What the firm writes about the price or the plan (paid options, trading hours), shown folded.
  note?: string;
  href: string;
  // false: a firm Angelo is not partnered with (compare-extra-firms.json), its own site and
  // its public code, shown in the comparator only.
  affiliate: boolean;
  code: { code: string; title: string } | null;
};

export type FirmView = {
  id: string;
  name: string;
  logo: string | null;
  summary: string;
  code: { code: string; title: string } | null;
  stale: { label: string; title: string } | null;
  // Cheapest price paid with code JTNQ, any program, any size.
  from: { now: number; per: string | null } | null;
  href: string;
};

// A rule shown as a pill: a label, and its value when it has one.
export type Pill = { label: string; value?: string };

// What changes once funded, per program, as read on the firm's own pages: pills, and the
// rules that change with the account size. The comparator reads its payout columns here.
export type Funded = {
  pills: Pill[];
  rows: { label: string; bySize: Record<number, string> }[];
};

export const pillValue = (f: Funded | null | undefined, label: string): string | undefined =>
  f?.pills.find((p) => p.label === label)?.value;

export const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

export const textVal = (text: string, sort: number | string | null = text): Val =>
  text === 'None' ? { text, sort: null, muted: true } : { text, sort };

// The price a row shows, with or without the discount.
export function shownPrice(p: ComparePrice, discount: boolean): { now: number; was: number | null; alts: { now: number; was: number | null }[] } | null {
  if (p.kind !== 'price') return null;
  const pick = (x: { list: number; discounted: number | null }) =>
    discount && x.discounted != null ? { now: x.discounted, was: x.list } : { now: x.list, was: null };
  return { ...pick(p), alts: p.alts.map(pick) };
}

// "from $X" on a firm's card: the cheapest price with the discount, any plan.
export function cheapest(rows: CompareRow[]): FirmView['from'] {
  let best: FirmView['from'] = null;
  for (const r of rows) {
    const p = shownPrice(r.price, true);
    if (!p || r.price.kind !== 'price') continue;
    const per = r.price.per === '/month' ? '/mo' : null;
    for (const now of [p.now, ...p.alts.map((a) => a.now)]) if (best == null || now < best.now) best = { now, per };
  }
  return best;
}

// The comparator's words, one place per column (Angelo, 01/11/2026: « je préfère que les mêmes
// appellations soient le même mot », for the whole comparator): lib/compare-words.mjs says each
// column's shared format, the data keeps each firm's own words, the firm's sentence stays on hover
// where the cell drops part of it. Futures and perps both build their cells here.
type Words = { text: string; title?: string };
const WORDS = {
  contracts: (raw: string) => contractsWords(raw),
  split: (raw: string) => splitWords(raw),
  dailyLoss: (raw: string) => dailyLossWords(raw),
  consistency: (raw: string) => consistencyWords(raw),
  payoutFreq: (raw: string) => payoutFreqWords(raw),
  // A row is one account size: its own value of a sentence that lists every size.
  maxPayout: (raw: string, size: number, label?: string) => payoutWords(raw, size, label),
  minPayout: (raw: string, size: number, label?: string) => payoutWords(raw, size, label),
} satisfies Record<string, (raw: string, size: number, label?: string) => Words>;
export type WordsColumn = keyof typeof WORDS;

const SORT_BY_MONEY = new Set<WordsColumn>(['maxPayout', 'minPayout']);

// A cell of `column` from the firm's words. `size`: the row's account size; `label`: where the
// value was read (« Payout caps 1 / 2 / 3 / 4 »), on hover. « None » is muted, as in textVal.
export function cellVal(
  column: WordsColumn,
  raw: string | null | undefined,
  { size = 0, label, sort }: { size?: number; label?: string; sort?: number | string | null } = {},
): Val | undefined {
  if (!raw) return undefined;
  const w = WORDS[column](raw, size, label);
  const val: Val = {
    text: w.text,
    sort: sort !== undefined ? sort : SORT_BY_MONEY.has(column) ? moneyFirst(w.text) : firstNumber(w.text),
  };
  if (w.title) val.title = w.title;
  if (w.text === 'None') return { ...val, sort: null, muted: true };
  return val;
}

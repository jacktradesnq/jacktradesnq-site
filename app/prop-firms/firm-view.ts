// The shapes /prop-firms draws, whatever the family. Each family (futures.ts, perps.ts) turns
// its own JSON into:
// - FirmView: a partner firm's card and its window (Angelo, 11/10/2026: « ils choisissent juste
//   entre les trois types de prop firm, et après […] ils cliquent dessus »);
// - CompareRow: one plan (firm × program × size) of the comparator, « Prop compare » (Angelo,
//   01/11/2026). The firm window no longer holds a table of plans: « See all plans » opens the
//   comparator on that firm.

import { firstNumber } from '@/lib/compare-order.mjs';

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
      // A second version of the same account after a « / » (MFP Elite 3% DLL, Vest 90% split).
      alt: { list: number; discounted: number | null } | null;
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
export function shownPrice(p: ComparePrice, discount: boolean): { now: number; was: number | null; alt: { now: number; was: number | null } | null } | null {
  if (p.kind !== 'price') return null;
  const pick = (x: { list: number; discounted: number | null }) =>
    discount && x.discounted != null ? { now: x.discounted, was: x.list } : { now: x.list, was: null };
  return { ...pick(p), alt: p.alt ? pick(p.alt) : null };
}

// "from $X" on a firm's card: the cheapest price with the discount, any plan.
export function cheapest(rows: CompareRow[]): FirmView['from'] {
  let best: FirmView['from'] = null;
  for (const r of rows) {
    const p = shownPrice(r.price, true);
    if (!p || r.price.kind !== 'price') continue;
    const per = r.price.per === '/month' ? '/mo' : null;
    for (const now of [p.now, p.alt?.now]) if (now != null && (best == null || now < best.now)) best = { now, per };
  }
  return best;
}

// Payout frequency, one word per meaning, for futures and perps alike (Angelo, 01/11/2026: « je
// préfère que les mêmes appellations soient le même mot », on « Daily » next to « Every day »):
// « Daily » for once a day, « On demand » for any time. The data keeps each firm's own words; the
// cell shows the shared word, the firm's whole sentence is read on hover, so a condition that
// leaves the cell (« from day one », « with no open position », « no cap ») stays there. A long
// sentence (Lucid, Tradeify) only has its start rewritten, when it means the same thing; two
// different rules never share a word (« 5 days to payout », a wait before the first payout, is
// not « 5 winning days » between payouts; Tradeify Lightning's « 5 Days » has no winning-day rule,
// its help center says « No Minimum Trading Day Count », so it stays).
const PAYOUT_WORDS: [RegExp, string][] = [
  [/^(?:daily|every day|once (?:per|a) day)(?=$|[\s,;(])/i, 'Daily'],
  [/^(?:any ?time|on[- ]?demand)(?=$|[\s,;(])/i, 'On demand'],
  // A number of days above a minimum profit before each payout: Tradeify Growth « 5 Days (5
  // winning days of $100 / … ) », Lucid Flex « 5 profitable days per cycle ($100 / … minimum per day) ».
  [/^(\d+) Days \(\1 winning days of /i, '$1 winning days ('],
  [/^(\d+) profitable days per cycle(?= \()/i, '$1 winning days'],
];

export function payoutFreqVal(raw: string | null | undefined): Val | undefined {
  if (!raw) return undefined;
  const rule = PAYOUT_WORDS.find(([re]) => re.test(raw));
  let text = rule ? raw.replace(rule[0], rule[1]) : raw;
  // « Daily, from day one » / « Any time, no cap »: the condition after the comma goes to the hover.
  const cond = /^(Daily|On demand),/.exec(text);
  if (cond) text = cond[1];
  // The same word inside a sentence too (Lucid « On Demand Payouts »).
  text = text.replace(/\bOn Demand Payouts\b/g, 'On demand payouts').replace(/\bOn Demand\b/g, 'On demand');
  return { text, sort: firstNumber(text), title: text !== raw ? raw : undefined };
}

// One shape for every firm on /prop-firms, whatever its family. Angelo, 11/10/2026:
// « ils choisissent juste entre les trois types de prop firm, et après […] ils cliquent
// dessus, ça leur montre le tableau avec tout d'un coup ». Each family (futures.ts,
// perps.ts) turns its own JSON into FirmView; FirmTable.tsx only draws it: one
// program at a time, its rules as pills, one column per account size, Eval / Funded.

export type Family = 'futures' | 'perps';

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'futures', label: 'Futures' },
  { id: 'perps', label: 'Perps' },
];

export type Cell = {
  text: string;
  // Drawdown kind shown as a pill (EOD Trail, Static…), with its explanation on hover.
  tag?: { label: string; title: string; accent: boolean };
  // Soft daily loss: position flattened, account survives.
  soft?: boolean;
  // "None", "Not published", "n/c": a rule, but not a figure.
  muted?: boolean;
  // A sentence rather than a figure (plan notes): smaller, wraps.
  note?: boolean;
  // Said on its own, without the row's label (« One-day pass per step » for a consistency).
  alone?: boolean;
};

export type PriceCell =
  | {
      kind: 'price';
      now: number;
      was: number | null;
      alt?: { now: number; was: number | null } | null; // second price after « / » (MFP Elite 3% DLL)
      per: string | null;
      // Several prices live for the same product: the cheapest is shown, prefixed "from".
      from: boolean;
      // Rules that change with the account size (futures dollar limits, contracts).
      lines: { label: string; cell: Cell }[];
    }
  | { kind: 'text'; text: string } // "Coming soon"
  | null; // size not sold on that program

export type RuleRow = { label: string; cells: Cell[] };

// A rule shown as a pill above the table: a label, and its value when it has one.
export type Pill = { label: string; value?: string };

export type Funded = {
  pills: Pill[];
  // Funded rules that change with the account size, keyed by size.
  rows: { label: string; bySize: Record<number, string> }[];
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
  // drop: a limited Traders Launch drop, its tab sits after Eval / Funded.
  columns: { name: string; drop?: boolean }[];
  common: string[];
  rules: RuleRow[];
  priceTitle: string;
  priceSub: string | null;
  // The same, program by program, when one program differs (a drop on a public promo: no code).
  priceSubs?: (string | null)[];
  sizes: { size: number; cells: PriceCell[] }[];
  // What changes once funded, per program (null: not documented for that program). The
  // table switches between the evaluation and these rules (Angelo, 12/10/2026, after
  // Lucid's « Funded Rules »: « peut-être un filtre Eval/Funded »).
  funded?: (Funded | null)[];
  // A second price for the same account (Traders Launch sells each size at a 60% and an 80%
  // split): the main price row is then named priceLabel, the others by their own label.
  priceLabel?: string;
  // The same, program by program (Vest: « 3% DLL » on the 1-Step tabs, nothing on 2-Step / Instant).
  priceLabels?: (string | null)[];
  extraPrices?: {
    label: string;
    byProgram: (Record<number, { now: number; was: number | null; alt?: { now: number; was: number | null } | null }> | null)[];
  }[];
  legend: string[];
  href: string;
};

export const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const cellKey = (c: Cell) => JSON.stringify([c.text, c.tag?.label ?? '', !!c.soft]);

// A rule that reads the same on every program leaves the table for the "Same on every
// plan" box, phrased as a sentence; the table keeps only what differs.
export function splitCommon(
  // keep: always a column, even when every program reads the same.
  rows: { label: string; cells: Cell[]; common: (c: Cell) => string; skip?: boolean }[],
): { common: string[]; rules: RuleRow[] } {
  const common: string[] = [];
  const rules: RuleRow[] = [];
  for (const row of rows) {
    if (row.skip) continue;
    const same = row.cells.length > 1 && row.cells.every((c) => cellKey(c) === cellKey(row.cells[0]));
    if (same || row.cells.length === 1) common.push(row.common(row.cells[0]));
    else rules.push({ label: row.label, cells: row.cells });
  }
  return { common, rules };
}

// A limit as perps firms publish it: "None" is a rule (no daily loss), null means
// the firm does not publish it ("n/c").
export const limitCell = (v: string | null): Cell =>
  v == null ? { text: 'n/c', muted: true } : v === 'None' ? { text: 'None', muted: true } : { text: v };

// No daily loss limit (or none published) on any program: the row is left out, the page
// does not mention it. Angelo, 21/10/2026: « si y a pas de daily loss limit ne le mentionne pas ».
export const hasDailyLoss = (values: (string | null)[]): boolean => values.some((v) => v != null && v !== 'None');

export function cheapest(sizes: FirmView['sizes']): FirmView['from'] {
  let best: FirmView['from'] = null;
  for (const row of sizes)
    for (const c of row.cells)
      if (c?.kind === 'price')
        for (const now of [c.now, c.alt?.now])
          if (now != null && (best == null || now < best.now)) best = { now, per: c.per };
  return best;
}

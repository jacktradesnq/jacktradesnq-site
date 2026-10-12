// One shape for every firm on /prop-firms, whatever its family. Angelo, 11/10/2026:
// « ils choisissent juste entre les trois types de prop firm, et après […] ils cliquent
// dessus, ça leur montre le tableau avec tout d'un coup ». Each family (futures.ts,
// perps.ts, cfd.ts) turns its own JSON into FirmView; FirmTable.tsx only draws it,
// in the layout of the MyFundedPerps comparison table he made (jtnq-promo,
// out/myfundedperps/table.html): the rules shared by every plan in one box, then one
// column per program, one row per rule, one row per account size for the prices.

export type Family = 'futures' | 'perps' | 'cfd';

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'futures', label: 'Futures' },
  { id: 'perps', label: 'Perps' },
  { id: 'cfd', label: 'CFD' },
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

export type FirmView = {
  id: string;
  name: string;
  logo: string | null;
  summary: string;
  code: { code: string; title: string } | null;
  stale: { label: string; title: string } | null;
  // Cheapest price paid with code JTNQ, any program, any size.
  from: { now: number; per: string | null } | null;
  columns: { name: string }[];
  common: string[];
  rules: RuleRow[];
  priceTitle: string;
  priceSub: string | null;
  sizes: { size: number; cells: PriceCell[] }[];
  legend: string[];
  note: string;
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
  rows: { label: string; cells: Cell[]; common: (c: Cell) => string; skip?: boolean; keep?: boolean }[],
): { common: string[]; rules: RuleRow[] } {
  const common: string[] = [];
  const rules: RuleRow[] = [];
  for (const row of rows) {
    if (row.skip) continue;
    const same = row.cells.length > 1 && row.cells.every((c) => cellKey(c) === cellKey(row.cells[0]));
    if (!row.keep && (same || row.cells.length === 1)) common.push(row.common(row.cells[0]));
    else rules.push({ label: row.label, cells: row.cells });
  }
  return { common, rules };
}

export function cheapest(sizes: FirmView['sizes']): FirmView['from'] {
  let best: FirmView['from'] = null;
  for (const row of sizes)
    for (const c of row.cells)
      if (c?.kind === 'price')
        for (const now of [c.now, c.alt?.now])
          if (now != null && (best == null || now < best.now)) best = { now, per: c.per };
  return best;
}

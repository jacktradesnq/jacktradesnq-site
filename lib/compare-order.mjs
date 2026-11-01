// Order and filters of the prop firm comparator (/prop-firms, « Prop compare »).
// Angelo, 01/11/2026: no ranking of any kind (partner contracts), so the default order is
// the alphabet: firm name, then account size. The visitor may sort a column himself.
// Pure (no React, no data): app/prop-firms/compare/ComparePanel.tsx uses it, the tests
// in scripts/compare-order.test.mjs check it.

/**
 * @template {{ firmName: string; size: number }} R
 * @param {R[]} rows
 * @returns {R[]}  A→Z by firm, then smallest size first; ties keep the source order.
 */
export function defaultOrder(rows) {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => a.row.firmName.localeCompare(b.row.firmName, 'en') || a.row.size - b.row.size || a.i - b.i)
    .map((x) => x.row);
}

/**
 * Sort by one column. A row with no value for it stays at the bottom whatever the
 * direction; equal values keep the order they came in.
 * @template R
 * @param {R[]} rows
 * @param {(row: R) => number | string | null | undefined} key
 * @param {'asc' | 'desc'} dir
 * @returns {R[]}
 */
export function sortBy(rows, key, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i, k: key(row) }))
    .sort((a, b) => {
      const ae = a.k == null || a.k === '';
      const be = b.k == null || b.k === '';
      if (ae || be) return ae && be ? a.i - b.i : ae ? 1 : -1;
      const c =
        typeof a.k === 'number' && typeof b.k === 'number'
          ? a.k - b.k
          : String(a.k).localeCompare(String(b.k), 'en', { numeric: true });
      return c * sign || a.i - b.i;
    })
    .map((x) => x.row);
}

/**
 * @template {{ firmId: string; size: number; steps: string }} R
 * @param {R[]} rows
 * @param {{ firmId?: string | null; size?: number | null; steps?: string | null; maxPrice?: number | null }} f
 * @param {(row: R) => number | null} priceOf  the price shown (with or without the discount); null = no price
 * @returns {R[]}
 */
export function filterRows(rows, f, priceOf) {
  return rows.filter((r) => {
    if (f.firmId && r.firmId !== f.firmId) return false;
    if (f.size != null && r.size !== f.size) return false;
    if (f.steps && r.steps !== f.steps) return false;
    if (f.maxPrice != null) {
      const p = priceOf(r);
      if (p == null || p > f.maxPrice) return false;
    }
    return true;
  });
}

/**
 * First number in a text ("2 minis or 20 micros" -> 2, "$1,250 / 1,000" -> 1250, "40%" -> 40).
 * Used to sort columns written as words.
 * @param {string | null | undefined} text
 * @returns {number | null}
 */
export function firstNumber(text) {
  const m = /\d[\d,]*(?:\.\d+)?/.exec(String(text ?? ''));
  return m ? Number(m[0].replace(/,/g, '')) : null;
}

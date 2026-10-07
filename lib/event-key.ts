/**
 * Client-safe helpers — no fs/path, safe to import from 'use client' components.
 * Lives here, not in study-stats.ts (which uses fs); study-stats imports it.
 */

// Distinct underlying event/setup key for a study slug.
// Collapses asset ports (-gc/-es/-si/-ym, __asset) and analysis variants
// (-ifvg-smt*, -day-stats*) onto the one event they describe.
// Returns null for the multi-event asset rollup cards (es/si/nq-ifvg-smt) — those are not a single event.

// Distinct underlying event/setup key for a study slug.
// Collapses asset ports (-gc/-es/-si/-ym, __asset) and analysis variants
// (-ifvg-smt*, -day-stats*) onto the one event they describe.
// Returns null for the multi-event asset rollup cards (es/si/nq-ifvg-smt).
export function eventKeyOf(slug: string): string | null {
  let s = slug.replace(/__(nq|gc|es|si|ym)$/, '');
  s = s.replace(/-ifvg-smt.*$/, '');
  s = s.replace(/-day-stats.*$/, '');
  s = s.replace(/-(gc|es|si|ym)$/, '');
  if (s === 'joblessclaims') s = 'jobless-claims';
  if (s === 'retailsales') s = 'retail-sales';
  if (s === 'es' || s === 'si' || s === 'nq') return null;
  return s;
}

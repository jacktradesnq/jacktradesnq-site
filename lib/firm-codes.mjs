// content/prop-firms/codes.md: the "## codes" block holds "firm-id = JTNQ" or
// "firm-id = link" lines (link: nothing to type, the URL carries the discount).
// Pure (no fs): read by the promo feed (scripts/lib/promo-analysis.mjs) and by the
// /prop-firms page (app/prop-firms/futures.ts, which bundles codes.md as text).

/**
 * @param {string} text  codes.md
 * @returns {Record<string, string>}  firm id -> "JTNQ" | "link" | another code
 */
export function parseCodes(text) {
  /** @type {Record<string, string>} */
  const out = {};
  let inCodes = false;
  for (const line of String(text).split('\n')) {
    if (/^##\s+codes\s*$/.test(line)) inCodes = true;
    else if (/^---+\s*$/.test(line) || /^#\s+/.test(line)) inCodes = false;
    else if (inCodes) {
      const m = /^([a-z0-9_-]+)\s*=\s*(.+)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

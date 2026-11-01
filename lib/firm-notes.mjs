// content/prop-firms/firm-notes.md: Angelo's own words on each partner firm, shown in the
// firm's window on /prop-firms (Angelo, 01/11/2026: an intro sentence and « Angelo's take »,
// written by him only). One "## <firm-id>" section per firm, with "### intro" and
// "### take" under it. An empty slot stays out of the page.
// Pure (no fs): app/prop-firms/FirmWindow.tsx bundles the file as text (next.config.js).

/**
 * @param {string} text  firm-notes.md
 * @returns {Record<string, { intro: string; take: string }>}  firm id -> its two texts, trimmed ('' when empty)
 */
export function parseFirmNotes(text) {
  /** @type {Record<string, { intro: string; take: string }>} */
  const out = {};
  /** @type {string | null} */
  let firm = null;
  /** @type {'intro' | 'take' | null} */
  let slot = null;
  /** @type {Record<string, { intro: string[]; take: string[] }>} */
  const lines = {};
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const h2 = /^##\s+([a-z0-9_-]+)\s*$/.exec(line);
    const h3 = /^###\s+(intro|take)\s*$/i.exec(line);
    if (h2) {
      firm = h2[1];
      slot = null;
      lines[firm] ??= { intro: [], take: [] };
    } else if (/^#{1,2}\s/.test(line)) {
      // Any other title closes the current firm (the explanation at the top of the file).
      firm = null;
      slot = null;
    } else if (h3 && firm) {
      slot = /** @type {'intro' | 'take'} */ (h3[1].toLowerCase());
    } else if (firm && slot && !/^\s*<!--.*-->\s*$/.test(line)) {
      lines[firm][slot].push(line);
    }
  }
  for (const [id, l] of Object.entries(lines)) {
    out[id] = { intro: l.intro.join('\n').trim(), take: l.take.join('\n').trim() };
  }
  return out;
}

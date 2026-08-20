/**
 * FundedSeat's own backend: GET https://fundedseat.com/api/pullchallenges
 * Public, no auth, returns every challenge they sell (24 rows on 2026-08-20).
 *
 * Why the mapping is by EXACT name and nothing else
 * -------------------------------------------------
 * Their catalogue carries families we do not list, whose names CONTAIN ours:
 *
 *   "1 Step Daily (35%) - 50K"        $104.95   <- our "Daily" 50K
 *   "1 Step Daily Ultra (35%) - 50K"  $229.95   <- a different product
 *   "1 Step Daily Ultra (25%) - 50K"  $199.95   <- a third one, same size
 *   "Instant Funding Direct - 100K"   $494.95   <- our "Instant Funding" 100K
 *   "Instant Funding Bolt - 100K "    $439.95   <- another product (note the
 *                                                  trailing space in their name)
 *
 * A substring or regex read ("Daily", "Instant Funding") publishes $229.95 for a
 * plan their page sells at $104.95. So the name we look for is BUILT from each
 * row's own account_size and compared for equality, trimmed. Nothing else matches.
 *
 * Two more traps this module refuses to fall into:
 *   - the root `dailyloss` is the FUNDED-account limit, not the challenge one.
 *     Sprint 50K: root 1000, challenge step 1200. The challenge value lives in
 *     steps[order=1], so that is what we read.
 *   - a null field means "this endpoint does not encode that rule", not "no such
 *     rule". Instant Funding has a 15%-biggest-trade rule the API leaves null.
 *     Null therefore yields NO CLAIM (undefined), never an asserted null.
 *
 * Our "Flex" program has no counterpart here: it stays on the rendered cards.
 */

export const FUNDEDSEAT_API = 'https://fundedseat.com/api/pullchallenges';

// program name in prop-firms.json -> the exact product name they sell it under
const PROGRAM_NAMES = {
  Daily: (k) => `1 Step Daily (35%) - ${k}K`,
  Sprint: (k) => `1 Step Sprint - ${k}K`,
  'Instant Funding': (k) => `Instant Funding Direct - ${k}K`,
};

// Programs we list that this endpoint does not sell. Kept explicit so a reader
// sees the hole instead of wondering why the count is 11 and not 15.
export const FUNDEDSEAT_API_UNCOVERED = ['Flex'];

const asNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @param {unknown} payload  parsed /api/pullchallenges body
 * @returns {Array<{programName: string, size: number, price: number,
 *                  originalPrice: number|null, rules: object}>}
 *          rules keys are omitted (not null) when the API does not encode them.
 * @throws  when the payload is unusable, a name is ambiguous, or a whole family
 *          stops matching — i.e. whenever staying silent would keep stale prices.
 */
export function fundedseatPlansFrom(payload) {
  if (!Array.isArray(payload) || payload.length === 0)
    throw new Error('pullchallenges: expected a non-empty array');

  const seen = new Map(); // "program|size" -> row
  for (const row of payload) {
    if (!row || row.active !== true) continue;
    const size = asNumber(row.account_size);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (size == null || size % 1000 !== 0 || name === '') continue;
    for (const [programName, nameFor] of Object.entries(PROGRAM_NAMES)) {
      if (nameFor(size / 1000) !== name) continue;
      const key = `${programName}|${size}`;
      if (seen.has(key))
        throw new Error(`two active challenges named "${name}" — refusing to guess which one they sell`);
      seen.set(key, row);
    }
  }

  for (const programName of Object.keys(PROGRAM_NAMES)) {
    const hits = [...seen.keys()].filter((k) => k.startsWith(`${programName}|`));
    if (hits.length === 0)
      throw new Error(
        `no active challenge matches "${PROGRAM_NAMES[programName]('<size>')}" — their product naming changed, ` +
          `mapping must be re-read before trusting any price`,
      );
  }

  return [...seen.entries()].map(([key, row]) => {
    const [programName, size] = key.split('|');
    const challenge = (row.steps ?? []).find((s) => s.order === 1) ?? {};
    const rules = {};
    // A value is claimed only when the API actually carries it (see header).
    const claim = (field, v) => {
      if (v != null) rules[field] = v;
    };
    claim('profitTarget', asNumber(row.profit_goal));
    claim('maxDrawdown', asNumber(row.Trailing_treshold));
    claim('dailyLoss', asNumber(challenge.dailyloss));
    claim('consistency', asNumber(challenge.consistency_percentage) == null ? null : `${challenge.consistency_percentage}%`);
    // They expose the mini limit only; micros stay unclaimed rather than derived.
    claim('contracts', asNumber(row.contracts) == null ? null : { minis: row.contracts, micros: null });
    // Consistency the API attaches to the FUNDED step, which their buy-screen
    // card does not show: Sprint cards read "Consistency: None" while every
    // Sprint funded step carries 25%. Reported, never published — two of the
    // firm's own sources disagree, so a human decides what the page says.
    const funded = (row.steps ?? []).find((s) => s.funded === true && asNumber(s.consistency_percentage) != null);
    return {
      programName,
      size: Number(size),
      price: asNumber(row.price),
      originalPrice: asNumber(row.full_price),
      rules,
      payoutConsistency: funded ? `${funded.consistency_percentage}%` : null,
    };
  });
}

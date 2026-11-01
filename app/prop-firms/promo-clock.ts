// The one clock every promo with an end date is judged by: the perps JTNQ promos (endsAt,
// perps.ts) and the public codes of the comparator's non-partner firms (promo.ends,
// compare-extra-firms.json, futures.ts). Three moments to get right:
// - build: a build made after the end never shows the promo (BUILD_TS, inlined by
//   next.config.js), so the daily rebuild drops it on its own;
// - before hydration: the static HTML shows the state of the build;
// - in the browser: the page flips to normal prices once the end passes, without
//   re-rendering every second.

import { useEffect, useState } from 'react';

export const BUILD_TS = Number(process.env.NEXT_PUBLIC_BUILD_TS ?? 0);

// setTimeout caps at ~24.8 days; a longer wait re-arms itself.
const MAX_WAIT = 2 ** 31 - 1;

// The time promos are judged at: BUILD_TS in the static HTML and at hydration, then the
// browser clock, moved only when one of `ends` (ms, a module constant) is crossed.
export function usePromoClock(ends: readonly number[]): number {
  const [at, setAt] = useState(BUILD_TS);
  useEffect(() => {
    let id: number | undefined;
    const tick = () => {
      const now = Date.now();
      setAt((prev) => (ends.some((e) => prev < e && e <= now) ? now : prev));
      const next = Math.min(...ends.filter((e) => e > now));
      if (Number.isFinite(next)) id = window.setTimeout(tick, Math.min(next - now + 1, MAX_WAIT));
    };
    tick();
    return () => window.clearTimeout(id);
  }, [ends]);
  return at;
}

'use client';

// Perps block under the CFD one on /prop-firms. Angelo, 11/10/2026: « faut que tu
// mettes perps comme truc, du coup on aura futures, CFD et perps » — same section as
// CFD (PercentBlock.tsx), with the JTNQ promo countdown as a banner above the sizes.
//
// The JTNQ promo has a hard end (endsAt). Three moments to get right:
// - build: a build made after endsAt never shows the promo (BUILD_TS, inlined
//   by next.config.js), so the daily rebuild drops it on its own;
// - before hydration: the static HTML shows the state of the build, with a
//   placeholder clock of the same width as the real one (no layout jump);
// - in the browser: the clock ticks every second and, once endsAt passes, the
//   block falls back to normal prices only.

import { useCallback, useEffect, useMemo, useState } from 'react';
import rawData from '@/public/data/perps-firms.json';
import { META } from './shared';
import { PercentBlock, type PercentRow } from './PercentBlock';
import { goHref } from '@/lib/go-links';

// price null = announced but not on sale yet ("Coming soon"): not listed, like a
// size the CFD firm does not sell.
type PerpsPlan = { size: number; price: number | null; promoPrice: number | null; note?: string };
type PerpsProgram = {
  name: string;
  steps: string;
  split: string;
  profitTarget: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  dailyLoss: string | null;
  note: string;
  plans: PerpsPlan[];
};
type PerpsFirm = {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  lastChecked: string;
  markets: string[];
  promo: { code: string; discountPct: number; endsAt: string; lastChecked: string } | null;
  programs: PerpsProgram[];
};

const DATA = rawData as unknown as { generatedAt: string; firms: PerpsFirm[] };
const BUILD_TS = Number(process.env.NEXT_PUBLIC_BUILD_TS ?? 0);
const DEFAULT_SIZE = 25000;
// Rules shared by every MyFundedPerps plan. Angelo, 11/10/2026: « les gens savent qu'il y
// a des règles communes, c'est précisé. Parce qu'il faut qu'ils le voient. »
const COMMON_RULES = [
  '1-step evaluation',
  'Static drawdown',
  'No consistency rule',
  'No minimum trading days',
  'No time limit',
  'Up to $300K funded in total',
];

const pad = (n: number) => String(n).padStart(2, '0');
function clock(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

function useNow(endsMs: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (endsMs == null || Date.now() >= endsMs) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsMs) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsMs]);
  return now;
}

// One promo on the page: the first firm that has one (MyFundedPerps today).
const PROMO = DATA.firms.find((f) => f.promo)?.promo ?? null;
const ENDS_MS = PROMO ? Date.parse(PROMO.endsAt) : null;
const LIVE_AT_BUILD = ENDS_MS != null && BUILD_TS < ENDS_MS;

export function PerpsBlock() {
  const now = useNow(LIVE_AT_BUILD ? ENDS_MS : null);
  const promo = LIVE_AT_BUILD && (now == null || now < (ENDS_MS as number)) ? PROMO : null;

  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const firm of DATA.firms)
      for (const program of firm.programs) for (const plan of program.plans) if (plan.price != null) all.add(plan.size);
    return [...all].sort((a, b) => a - b);
  }, []);

  const rowsFor = useCallback(
    (size: number) => {
      const out: PercentRow[] = [];
      for (const firm of DATA.firms)
        for (const program of firm.programs) {
          const plan = program.plans.find((p) => p.size === size);
          if (!plan || plan.price == null) continue;
          const promoPrice = promo && firm.promo ? plan.promoPrice : null;
          out.push({
            key: `${firm.id}-${program.name}`,
            logo: firm.logo,
            firmName: firm.name,
            program: program.name,
            meta: [program.steps, `${program.split} split`],
            note: program.note,
            chip: { code: 'JTNQ', title: 'My affiliate code' },
            price: promoPrice ?? plan.price,
            was: promoPrice != null ? plan.price : null,
            priceNotes: promo && promoPrice != null ? [`${promo.discountPct}% off with code ${promo.code}`] : [],
            profitTarget: program.profitTarget,
            maxDrawdown: program.maxDrawdown,
            ddType: program.ddType,
            dailyLoss: program.dailyLoss,
            href: goHref('prop-firms', firm.id),
          });
        }
      return out;
    },
    [promo],
  );

  if (DATA.firms.length === 0) return null;

  const endsLabel = promo
    ? new Date(promo.endsAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      })
    : '';
  const note =
    `Prices and rules read on each firm's own site on ${humanDate(PROMO?.lastChecked ?? DATA.generatedAt)}, not auto-synced.` +
    (promo ? ` Crossed-out prices are the normal prices; code ${promo.code} takes ${promo.discountPct}% off until ${endsLabel} New York time.` : '') +
    ' The live checkout price wins.';

  return (
    <>
      <style>{PERPS_CSS}</style>
      <PercentBlock
        id="perps"
        eyebrow={META.heroPerps.eyebrow}
        title="Perps"
        intro={META.heroPerps.phrase}
        sizeAria="Perps account size"
        sizes={sizes}
        defaultSize={DEFAULT_SIZE}
        rowsFor={rowsFor}
        commonRules={{ label: 'MyFundedPerps, every plan', items: COMMON_RULES }}
        banner={
          promo && (
            <p className="perps-promo">
              <span className="promo-chip">code {promo.code}</span>
              <span className="perps-promo-text">
                {promo.discountPct}% off with code {promo.code} — ends in{' '}
                <span className="perps-clock" role="timer" aria-live="off">
                  {now == null ? '--h --m --s' : clock((ENDS_MS as number) - now)}
                </span>
              </span>
            </p>
          )
        }
        legendFirst="Every limit is a percentage of your starting balance, the way perps firms publish them"
        note={note}
      />
    </>
  );
}

const PERPS_CSS = `
.jtnq-cmp .common-rules{ margin: 0 0 24px; }
.jtnq-cmp .common-rules-label{
  display: block; margin: 0 0 8px; font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em;
  text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp .common-rules-list{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.jtnq-cmp .common-rules-list li{
  padding: 4px 12px; border: 1px solid var(--c-line); border-radius: 999px;
  background: var(--c-bg-raise); color: var(--c-text); font-size: 14px; line-height: 24px;
}
.jtnq-cmp .perps-promo{
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0 0 24px;
  padding: 12px 16px; border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 12px;
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 6%);
}
.jtnq-cmp .perps-promo .promo-chip{ cursor: default; }
.jtnq-cmp .perps-promo-text{ font-size: 14px; color: var(--c-text); }
.jtnq-cmp .perps-clock{
  font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-weight: 500; color: var(--c-accent);
  white-space: nowrap;
}
`;

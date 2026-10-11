'use client';

import { useCallback, useMemo } from 'react';
import rawCfdData from '@/public/data/cfd-firms.json';
import { META } from './shared';
import { PercentBlock, type PercentRow } from './PercentBlock';
import { goHref } from '@/lib/go-links';

// CFD block under the futures table on /prop-firms (Angelo, 11/10/2026: « Le tableau
// futures reste tel quel, j'ajoute en dessous un bloc CFD avec Tradeify FX, son lien et
// JTNQ »). Same row layout as the CFD comparator retired on 27/09 (254f83e): CFD firms
// publish their limits as a percentage of the balance, so the cells are strings.
// The drawing is shared with the Perps block (PercentBlock.tsx).

type CfdPlan = { size: number; price: number };
type CfdProgram = {
  name: string;
  market: 'cfd';
  steps: string;
  profitTarget: string | null;
  dailyLoss: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  minDays: string | null;
  split: string;
  leverage: string;
  note: string;
  plans: CfdPlan[];
};
// Firm-wide discount applied by the affiliate link itself (checked on the firm's checkout).
type CfdDiscount = {
  code: string;
  discountPct: number;
  appliedByLink: boolean;
  endsAt: string | null;
  lastChecked: string;
};
type CfdFirm = {
  id: string;
  name: string;
  logo: string | null;
  payout: string;
  promo: { label: string; code: string } | null;
  discount?: CfdDiscount;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: CfdProgram[];
};
type CfdData = { generatedAt: string; firms: CfdFirm[] };

const DATA = rawCfdData as unknown as CfdData;

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const NOTE = `List prices and rules read on each firm's own site and help center on ${humanDate(DATA.generatedAt)}, not auto-synced. Discounted prices are the list price minus the firm's discount, checked on its checkout on ${humanDate(DATA.firms.find((f) => f.discount)?.discount?.lastChecked ?? DATA.generatedAt)}. Promos change fast; the live checkout price wins.`;

// Same arithmetic as the firm's checkout: list price x (100 - pct) / 100, to the cent.
// price * (100 - pct) is an integer, so the division by 100 is exact to the cent.
const discounted = (price: number, pct: number) => Math.round(price * (100 - pct)) / 100;

const DEFAULT_SIZE = 25000;

export function CfdBlock() {
  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const firm of DATA.firms)
      for (const program of firm.programs) for (const plan of program.plans) all.add(plan.size);
    return [...all].sort((a, b) => a - b);
  }, []);

  const rowsFor = useCallback((size: number) => {
    const out: PercentRow[] = [];
    for (const firm of DATA.firms)
      for (const program of firm.programs) {
        const plan = program.plans.find((p) => p.size === size);
        if (!plan) continue;
        const d = firm.discount;
        const priceNotes: string[] = [];
        if (d) priceNotes.push(`${d.discountPct}% off with code ${d.code}${d.appliedByLink ? ', applied by the link' : ''}`);
        if (program.minDays) priceNotes.push(`min ${program.minDays}`);
        out.push({
          key: `${firm.id}-${program.name}`,
          logo: firm.logo,
          firmName: firm.name,
          program: program.name,
          meta: [program.steps, `${program.split} split`, program.leverage],
          note: program.note,
          chip: firm.promo ? { code: firm.promo.code, title: firm.promo.label } : null,
          price: d ? discounted(plan.price, d.discountPct) : plan.price,
          was: d ? plan.price : null,
          priceNotes,
          profitTarget: program.profitTarget,
          maxDrawdown: program.maxDrawdown,
          ddType: program.ddType,
          dailyLoss: program.dailyLoss,
          href: goHref('prop-firms', firm.id),
        });
      }
    return out;
  }, []);

  if (DATA.firms.length === 0) return null;

  return (
    <PercentBlock
      id="cfd"
      eyebrow={META.heroCfd.eyebrow}
      title="CFD"
      intro={META.heroCfd.phrase}
      sizeAria="CFD account size"
      sizes={sizes}
      defaultSize={DEFAULT_SIZE}
      rowsFor={rowsFor}
      legendFirst="Every limit is a percentage of your starting balance, the way CFD firms publish them"
      note={NOTE}
    />
  );
}

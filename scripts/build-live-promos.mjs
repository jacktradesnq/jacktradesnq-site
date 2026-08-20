#!/usr/bin/env node
// Writes public/data/live-promos.json: every firm with a promo running right
// now, in the order the page shows them.
//
// It reuses the newsletter engine on purpose. The page and the emails read the
// same rules, so they cannot contradict each other: reference size first, his
// code and never a public one, and a discount only when the arithmetic on one
// plan's two prices supports it.
//
// Run by the daily workflow before the build.
//   node scripts/build-live-promos.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeFirms } from './lib/deal-of-day.mjs';

const DATA_URL = new URL('../public/data/prop-firms.json', import.meta.url);
const OUT_URL = new URL('../public/data/live-promos.json', import.meta.url);
const DRY = process.argv.includes('--dry');

const today = process.argv.find((a) => a.startsWith('--today='))?.split('=')[1]
  ?? new Date().toISOString().slice(0, 10);

const data = JSON.parse(readFileSync(DATA_URL, 'utf8'));
const candidates = analyzeFirms(data, { today });

// Firms whose live prices are NOT in the HTML we scrape would go here: our
// figures would be known wrong, and publishing a stale price on a promo page is
// worse than publishing nothing.
//
// legends-trading was held back on 2026-08-20 for exactly that reason, and is
// back: scrapeLegends now reads their own public shop API instead of a Webflow
// page that served a stale table to every HTTP client.
const NEEDS_RENDERED_SCRAPE = new Set();

// A promo is worth a card when there is something to show: a real discount, or
// a code of his that unlocks one.
const live = candidates.filter(
  (c) => c.headline.discountPct > 0 && !NEEDS_RENDERED_SCRAPE.has(c.firmId)
);

for (const id of NEEDS_RENDERED_SCRAPE) {
  console.log(`  held back: ${id} (prices need a rendered scrape, see the comment above)`);
}

const promos = live
  .sort((a, b) => {
    const urgency = Number(b.signals.includes('expiring')) - Number(a.signals.includes('expiring'));
    if (urgency) return urgency;
    if (b.headline.discountPct !== a.headline.discountPct) {
      return b.headline.discountPct - a.headline.discountPct;
    }
    return a.firmName.localeCompare(b.firmName);
  })
  .map((c) => ({
    firmId: c.firmId,
    firmName: c.firmName,
    logo: `/logos/email/${c.firmId}.png`,
    url: c.url,
    code: c.code,
    codeViaLink: c.codeViaLink,
    program: c.programLabel,
    programType: c.programType,
    priceType: c.priceType,
    size: c.headline.size,
    price: c.headline.price,
    originalPrice: c.headline.originalPrice,
    discountPct: c.headline.discountPct,
    endsAt: c.endsAt,
    expiring: c.signals.includes('expiring'),
    split: c.split,
    payout: c.payout,
    ddType: c.rules.ddType,
    profitTarget: c.rules.profitTarget,
    maxDrawdown: c.rules.maxDrawdown,
    dailyLoss: c.rules.dailyLoss,
    consistency: c.rules.consistency,
    activationFee: c.rules.activationFee,
    contracts: c.rules.contracts,
    lastChecked: c.lastChecked,
  }));

const out = { generatedAt: data.generatedAt, builtFor: today, promos };

console.log(`${promos.length} live promo(s) out of ${data.firms.length} firms:`);
for (const p of promos) {
  console.log(
    `  ${p.firmName.padEnd(18)} ${p.discountPct}% off  ${p.size / 1000}K at $${p.price}` +
      `${p.expiring ? `  (ends ${p.endsAt})` : ''}`
  );
}

if (DRY) {
  console.log('--dry: nothing written');
} else {
  writeFileSync(OUT_URL, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote ${OUT_URL.pathname}`);
}

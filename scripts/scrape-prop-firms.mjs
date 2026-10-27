#!/usr/bin/env node
/**
 * Daily sync for public/data/prop-firms.json.
 *
 * Deux chemins, selon ce que rend le scraper d'une firme :
 *
 *  - `{ programs }` — un LECTEUR de catalogue (scripts/lib/firms/*.mjs) a lu
 *    tout ce que la firme vend. guardCatalog() + syncCatalog() creent les
 *    programmes et les tailles nouveaux, retirent ce qui n'est plus vendu, et
 *    gardent les regles curatees a la main que le lecteur n'encode pas.
 *    Traders Launch.
 *
 *  - `{ updates }` — le chemin historique, un metteur a jour de PRIX sur des
 *    programmes figes a la main : guard() + apply() ne touchent que price /
 *    originalPrice / activationFee. E8 reste dessus, faute de lecteur.
 *
 * Dans les deux cas les promos (promo firme, promoCode / promoLabel par
 * programme) passent par applyPromos(), et une firme dont le scraper echoue
 * garde ses donnees avec stale: true — les autres firmes continuent.
 * Exit code is 0 unless the JSON write fails.
 *
 * Usage: node scripts/scrape-prop-firms.mjs [--dry] [--only=<firm id>]
 */

import fs from 'node:fs';

import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';
import { fetchBluSkyPlans } from './lib/firms/blusky.mjs';
import { fetchE8Plans } from './lib/firms/e8.mjs';
import { fetchTradersLaunchPrograms } from './lib/firms/traderslaunch.mjs';

const DATA_URL = new URL('../public/data/prop-firms.json', import.meta.url);
const DRY = process.argv.includes('--dry');
// --only=<firm id> : ne relit que cette firme (les autres gardent leurs donnees telles quelles).
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? null;
const TODAY = new Date().toISOString().slice(0, 10);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const num = (s) => parseFloat(String(s).replace(/[,\s]/g, ''));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/* ------------------------------------------------------------------ */
/* Traders Launch — #pricing de https://traderslaunch.com (Playwright)  */
/* ------------------------------------------------------------------ */

// Les cartes ecrivent leur drawdown en deux mots (lus par le lecteur sous la
// forme « <type> - <precision> ») :
//  - « EOD — Locks at starting balance » (Premium, Legacy NYC) : un drawdown de
//    fin de journee qui suit les plus hauts jusqu'au solde de depart, ou il se
//    fige — "EOD Trailing" dans notre vocabulaire.
//  - « static — Does not trail » (Static) : une perte max fixe — "Static".
// Une formulation inconnue arrete la firme plutot que de publier un drawdown
// que la page ne sait pas nommer.
const TRADERSLAUNCH_DD = {
  'EOD - Locks at starting balance': 'EOD Trailing',
  'static - Does not trail': 'Static',
};

async function scrapeTradersLaunch() {
  const programs = await fetchTradersLaunchPrograms({ log: (l) => console.log(`traders-launch: ${l}`) });
  for (const program of programs) {
    for (const plan of program.plans) {
      if (plan.ddType == null) continue;
      // « EOD trailing — Stops trailing at $25,000 » (drops) : il se fige au solde de depart,
      // comme « Locks at starting balance », seulement si ce montant est bien la taille du compte.
      const stops = plan.ddType.match(/^EOD - Stops trailing at \$([\d,]+)$/);
      const vocab = stops && Number(stops[1].replace(/,/g, '')) === plan.size ? 'EOD Trailing' : TRADERSLAUNCH_DD[plan.ddType];
      if (!vocab) throw new Error(`drawdown « ${plan.ddType} » hors du vocabulaire du comparateur`);
      plan.ddType = vocab;
    }
  }
  return { programs }; // no promo recipe for this firm — promo stays manual
}

/* ------------------------------------------------------------------ */
/* E8 Markets — client-rendered pricing on https://e8futures.com, needs playwright (optional) */
/* ------------------------------------------------------------------ */

// E8 : le configurateur de e8futures.com, lu tuile par tuile (scripts/lib/firms/e8.mjs).
// Chemin `updates` : seuls price / originalPrice bougent ; les programmes et les
// tailles du JSON restent decides a la main.
export async function scrapeE8Markets(read) {
  if (!read) {
    let pw;
    try {
      pw = await import('playwright');
    } catch {
      console.log('e8-markets: playwright not installed, skipped');
      return null;
    }
    // PLAYWRIGHT_CHANNEL=chrome : le Chrome installe plutot que le Chromium de Playwright (local).
    const launch = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};
    read = () => fetchE8Plans(pw, launch);
  }
  const plans = await read();
  return {
    updates: plans.map(({ programName, size, price, originalPrice }) => ({
      programName,
      size,
      price,
      originalPrice,
    })),
  }; // promo stays manual — site banner label is vaguer than the curated JSON copy
}

/* ------------------------------------------------------------------ */
/* BluSky — l'API publique de leur checkout (JSON, pas de navigateur)  */
/* ------------------------------------------------------------------ */

// Chemin `updates`, comme E8 : prix seulement, regles ecrites a la main.
export async function scrapeBluSky(read = fetchBluSkyPlans) {
  const plans = await read();
  return { updates: plans }; // promo stays manual
}

/** Ce que la firme vend et que le JSON n'a pas : signale, jamais ajoute (choix d'Angelo). */
export function unlistedPlans(firm, res) {
  return res.updates
    .filter((u) => !firm.programs.some((p) => p.name === u.programName && p.plans.some((x) => x.size === u.size)))
    .map((u) => `${u.programName} $${u.size / 1000}K (${u.price}/${u.originalPrice})`);
}

export function guard(firm, res) {
  const plansTotal = firm.programs.reduce((n, p) => n + p.plans.length, 0);
  let matched = 0;
  for (const program of firm.programs) {
    for (const plan of program.plans) {
      const u = res.updates.find((x) => x.programName === program.name && x.size === plan.size);
      if (!u) continue;
      if (!Number.isFinite(u.price)) throw new Error(`${program.name} $${plan.size / 1000}K: non-numeric price`);
      if (u.price < 10 || u.price > 6000)
        throw new Error(`${program.name} $${plan.size / 1000}K: price ${u.price} out of range [10, 6000]`);
      if (u.originalPrice != null && u.price > u.originalPrice)
        throw new Error(
          `${program.name} $${plan.size / 1000}K: price ${u.price} > originalPrice ${u.originalPrice}`,
        );
      matched++;
    }
  }
  if (matched !== plansTotal)
    throw new Error(`scraped ${matched}/${plansTotal} expected plans — refusing partial update`);
}

export function apply(firm, res, changes) {
  for (const program of firm.programs) {
    for (const plan of program.plans) {
      const u = res.updates.find((x) => x.programName === program.name && x.size === plan.size);
      const tag = `${firm.name} / ${program.name} $${plan.size / 1000}K`;
      // Only firms whose scraper reports the field carry the key: for everyone
      // else it stays hand-maintained, untouched.
      if ('activationFee' in u) {
        const before = plan.activationFee ?? null;
        if (before !== u.activationFee) {
          changes.push(`${tag}: activationFee ${before} -> ${u.activationFee}`);
          if (u.activationFee == null) delete plan.activationFee;
          else plan.activationFee = u.activationFee;
        }
      }
      if (plan.price !== u.price) {
        changes.push(`${tag}: price ${plan.price} -> ${u.price}`);
        plan.price = u.price;
      }
      if (plan.originalPrice !== u.originalPrice) {
        changes.push(`${tag}: originalPrice ${plan.originalPrice} -> ${u.originalPrice}`);
        plan.originalPrice = u.originalPrice;
      }
    }
  }
  applyPromos(firm, res, changes);
}

// Les promos, communes aux deux chemins : un `firmPromo` absent (undefined)
// garde celle qui est publiee, un `null` explicite dit que la promo est finie.
function applyPromos(firm, res, changes) {
  for (const program of firm.programs) {
    const promo = res.programPromos?.[program.name];
    if (!promo) continue;
    if (program.promoCode !== promo.code) {
      changes.push(`${firm.name} / ${program.name}: promoCode ${program.promoCode} -> ${promo.code}`);
      program.promoCode = promo.code;
    }
    if (promo.label != null && program.promoLabel !== promo.label) {
      changes.push(`${firm.name} / ${program.name}: promoLabel ${program.promoLabel} -> ${promo.label}`);
      program.promoLabel = promo.label;
    }
  }
  if (res.firmPromo !== undefined) {
    const oldStr = JSON.stringify(firm.promo);
    const newStr = JSON.stringify(res.firmPromo);
    if (oldStr !== newStr) {
      changes.push(`${firm.name}: promo ${oldStr} -> ${newStr}`);
      firm.promo = res.firmPromo;
    }
  }
  firm.lastChecked = TODAY;
  firm.stale = false;
}

const SCRAPERS = {
  'traders-launch': scrapeTradersLaunch,
  'e8-markets': scrapeE8Markets,
  blusky: scrapeBluSky,
};

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  let totalChanges = 0;

  for (const firm of data.firms) {
    if (ONLY && firm.id !== ONLY) continue;
    const scraper = SCRAPERS[firm.id];
    if (!scraper) {
      console.log(`${firm.id}: no scraper defined, skipped`);
      continue;
    }
    try {
      const res = await scraper();
      if (res === null) continue; // skipped (playwright missing)
      const changes = [];
      if (res.programs) {
        // Un lecteur a rendu tout ce que la firme vend : le catalogue suit.
        guardCatalog(firm, res.programs);
        syncCatalog(firm, res.programs, changes);
        applyPromos(firm, res, changes);
      } else {
        // Chemin historique : des prix sur des programmes figes a la main.
        guard(firm, res);
        apply(firm, res, changes);
        for (const extra of unlistedPlans(firm, res))
          console.log(`${firm.id}: NOTICE — sold on their site, not on ours (not added): ${extra}`);
      }
      totalChanges += changes.length;
      const plansTotal = firm.programs.reduce((n, p) => n + p.plans.length, 0);
      if (changes.length === 0) {
        console.log(`${firm.id}: OK — ${plansTotal} plans verified, no changes`);
      } else {
        console.log(`${firm.id}: OK — ${plansTotal} plans verified, ${changes.length} change(s):`);
        for (const c of changes) console.log(`  ${c}`);
      }
    } catch (e) {
      firm.stale = true;
      console.error(`${firm.id}: FAILED — ${e.message} — keeping existing data, stale: true`);
    }
  }

  if (DRY) {
    console.log(`--dry: no write. ${totalChanges} pending change(s).`);
    return;
  }
  data.generatedAt = TODAY;
  try {
    fs.writeFileSync(DATA_URL, JSON.stringify(data, null, 2) + '\n');
    console.log(`wrote ${DATA_URL.pathname} (${totalChanges} change(s), generatedAt ${TODAY})`);
  } catch (e) {
    console.error(`FATAL: could not write JSON: ${e.message}`);
    process.exit(1);
  }
}

// Importable for tests without running the sync.
if (process.argv[1] && process.argv[1].endsWith('scrape-prop-firms.mjs')) main();

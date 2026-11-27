#!/usr/bin/env node
/**
 * Synchro quotidienne des firmes perps : public/data/perps-firms.json (onglet Perps de /prop-firms et
 * comparateur), lancée par .github/workflows/update-prop-firms.yml.
 *
 * Avant le 28/11/2026 ce fichier était écrit à la main et rien ne le relisait (Angelo, 28/11 : « le sync
 * est où la ») : Vest affichait encore un 2-Step retiré depuis le 23/11. Chaque firme a maintenant son
 * lecteur (scripts/lib/firms/perps-<firme>.mjs) qui relit LEUR site et rend ses programmes et sa promo
 * entiers : un compte que la firme ajoute ou retire apparaît / disparaît seul (Angelo, 28/11/2026 ; règle
 * du 21/10 : « tant que y a sur leur site faut que ca sois sur nôtre site aussi »).
 *
 * Page illisible, compte annoncé mais absent, prix aberrant = la firme garde ses données d'avant, passe
 * stale (le site dit « Prices <date> », l'alerte Discord « stale firms » la nomme) et le script sort en 1
 * (job rouge), comme scrape-tradeify.mjs et scrape-lucid.mjs.
 *
 *   node scripts/scrape-perps.mjs                 relit tout et réécrit le JSON
 *   node scripts/scrape-perps.mjs --dry           relit tout, n'écrit rien
 *   node scripts/scrape-perps.mjs --only=vest-markets[,breakout]
 *   node scripts/scrape-perps.mjs --dump=<dossier> garde chaque lecture brute (pour une fixture)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchPageText } from './lib/cf-fetch.mjs';
import { readVestPerps, vestPerpsFromSnapshot } from './lib/firms/perps-vest.mjs';
import { readBreakoutPerps, breakoutPerpsFromSnapshot } from './lib/firms/perps-breakout.mjs';
import { readMfpPerps, mfpPerpsFromSnapshot } from './lib/firms/perps-mfp.mjs';
import { readE8Perps, e8PerpsFromSnapshot } from './lib/firms/perps-e8.mjs';

const DATA_URL = new URL('../public/data/perps-firms.json', import.meta.url);

/** id de la firme -> { read(ctx) : lecture brute, apply(snapshot, firm, checkedOn) : { programs, promo, pairs? } }. */
export const READERS = {
  myfundedperps: {
    read: (ctx) => readMfpPerps({ fetchText: ctx.fetchText }),
    apply: (snap, firm, checkedOn) => mfpPerpsFromSnapshot(snap, { checkedOn, previous: firm }),
  },
  'e8-perps': {
    read: (ctx) => readE8Perps({ fetchText: ctx.fetchText }),
    apply: (snap, firm, checkedOn) => e8PerpsFromSnapshot(snap, { checkedOn, previous: firm }),
  },
  'vest-markets': {
    read: (ctx) => readVestPerps(ctx),
    apply: (snap, firm, checkedOn) => vestPerpsFromSnapshot(snap, { checkedOn, promo: firm.promo }),
  },
  breakout: {
    read: (ctx) => readBreakoutPerps({ fetchText: ctx.fetchText }),
    apply: (snap, firm, checkedOn) => breakoutPerpsFromSnapshot(snap, { checkedOn, previous: firm }),
  },
};

const RULES = ['steps', 'split', 'profitTarget', 'maxDrawdown', 'ddType', 'dailyLoss', 'note'];
const sizeWord = (n) => (n >= 1000 ? `${n / 1000}K` : `$${n}`);
const prices = (plan) => [plan.price, ...(plan.altPrice != null ? [plan.altPrice] : []), ...(plan.altPrices ?? []).map((a) => a.price)];
const promoPrices = (plan) => [plan.promoPrice, ...(plan.altPromoPrice != null ? [plan.altPromoPrice] : []), ...(plan.altPrices ?? []).map((a) => a.promoPrice)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Ce qui a changé entre deux versions d'une firme, une ligne par changement (journal du job). */
export function describeChanges(before, after) {
  const out = [];
  const byName = (f) => new Map((f.programs ?? []).map((p) => [p.name, p]));
  const a = byName(before);
  const b = byName(after);
  for (const [name, p] of b) if (!a.has(name)) out.push(`+ programme ${name} (${p.plans.map((x) => sizeWord(x.size)).join(', ')})`);
  for (const name of a.keys()) if (!b.has(name)) out.push(`- programme ${name}`);
  for (const [name, p] of b) {
    const old = a.get(name);
    if (!old) continue;
    for (const k of RULES) if (!same(old[k] ?? null, p[k] ?? null)) out.push(`${name} : ${k} ${JSON.stringify(old[k] ?? null)} -> ${JSON.stringify(p[k] ?? null)}`);
    const oldPlans = new Map(old.plans.map((x) => [x.size, x]));
    const newPlans = new Map(p.plans.map((x) => [x.size, x]));
    for (const s of newPlans.keys()) if (!oldPlans.has(s)) out.push(`${name} : + ${sizeWord(s)} (${prices(newPlans.get(s)).join(' / ')})`);
    for (const s of oldPlans.keys()) if (!newPlans.has(s)) out.push(`${name} : - ${sizeWord(s)}`);
    for (const [s, x] of newPlans) {
      const y = oldPlans.get(s);
      if (!y) continue;
      if (!same(prices(y), prices(x))) out.push(`${name} ${sizeWord(s)} : prix ${prices(y).join(' / ')} -> ${prices(x).join(' / ')}`);
      else if (!same(promoPrices(y), promoPrices(x))) out.push(`${name} ${sizeWord(s)} : prix JTNQ ${promoPrices(y).join(' / ')} -> ${promoPrices(x).join(' / ')}`);
      if (!same(y.more ?? null, x.more ?? null) || !same(y.lines ?? null, x.lines ?? null)) out.push(`${name} ${sizeWord(s)} : versions / lignes changées`);
    }
  }
  const { lastChecked: _a, ...pa } = before.promo ?? {};
  const { lastChecked: _b, ...pb } = after.promo ?? {};
  if (!same(pa, pb)) out.push(`promo ${JSON.stringify(pa)} -> ${JSON.stringify(pb)}`);
  if (!same(before.pairs ?? null, after.pairs ?? null)) out.push(`pairs ${JSON.stringify(before.pairs ?? null)} -> ${JSON.stringify(after.pairs ?? null)}`);
  return out;
}

/**
 * Une relecture complète sans fichier : `data` = contenu de perps-firms.json, modifié en place.
 * ok:false dès qu'une firme n'a pas pu être relue (elle garde ses données, stale: true).
 */
export async function runPerps(data, { readers = READERS, ctx = {}, now = Date.now(), log = console.log, only = null, dump = null } = {}) {
  const today = new Date(now).toISOString().slice(0, 10);
  let ok = true;
  const changes = {};
  for (const firm of data.firms) {
    if (only && !only.includes(firm.id)) continue;
    const reader = readers[firm.id];
    if (!reader) {
      ok = false;
      firm.stale = true;
      log(`${firm.id}: ÉCHEC — aucun lecteur pour cette firme — données gardées, stale: true`);
      continue;
    }
    const before = structuredClone(firm);
    let res;
    try {
      const snap = await reader.read(ctx);
      if (dump) dump(firm.id, snap);
      res = reader.apply(snap, firm, today);
      if (!res?.programs?.length) throw new Error('aucun programme lu');
    } catch (e) {
      ok = false;
      firm.stale = true;
      log(`${firm.id}: ÉCHEC — ${e.message} — données gardées, stale: true`);
      continue;
    }
    firm.programs = res.programs;
    firm.promo = res.promo;
    if (res.pairs) firm.pairs = res.pairs;
    firm.lastChecked = today;
    firm.stale = false;
    const list = describeChanges(before, firm);
    changes[firm.id] = list;
    const count = firm.programs.reduce((n, p) => n + p.plans.length, 0);
    if (!list.length) log(`${firm.id}: OK — ${firm.programs.length} programmes, ${count} comptes relus, rien n'a changé`);
    else {
      log(`${firm.id}: OK — ${firm.programs.length} programmes, ${count} comptes relus, ${list.length} changement(s) :`);
      for (const c of list) log(`  ${c}`);
    }
  }
  data.generatedAt = today;
  return { ok, changes };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',') ?? null;
  const dumpDir = args.find((a) => a.startsWith('--dump='))?.slice('--dump='.length) ?? null;
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  let chromium = null;
  const ctx = {
    fetchText: (url) => fetchPageText(url),
    // Navigateur seulement pour un lecteur qui en a besoin (playwright est installé par le workflow).
    get chromium() {
      return chromium;
    },
  };
  if (Object.keys(READERS).some((id) => READERS[id].needsBrowser)) chromium = (await import('playwright')).chromium;
  const { ok } = await runPerps(data, {
    ctx,
    only,
    dump: dumpDir ? (id, snap) => fs.writeFileSync(path.join(dumpDir, `perps-${id}.json`), JSON.stringify(snap, null, 1) + '\n') : null,
    log: (l) => (l.includes('ÉCHEC') ? console.error(l) : console.log(l)),
  });
  if (dry) console.log('--dry : rien écrit.');
  else fs.writeFileSync(DATA_URL, JSON.stringify(data, null, 2) + '\n');
  if (!ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

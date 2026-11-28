// Lecture d'E8 Markets, marche Perpetual (e8-perps), sur l'instantane enregistre le 2026-11-28 :
// api/data/global (comptes), api/data/discount-codes, le code du configurateur (catalogue, prix,
// regles), son rendu serveur et la liste des symboles. Pas de reseau, et jamais le JSON vivant que le
// bot reecrit chaque jour (CLAUDE.md) : l'entree « previous » est une copie figee dans ce fichier.
// Run: node --test scripts/firms-perps-e8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { E8_PERPS_SOURCE, configuratorStart, e8PerpsFromSnapshot, e8Price, e8PromoPrice, readE8Perps } from './lib/firms/perps-e8.mjs';

const SNAP = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/perps-e8-2026-11-28.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(SNAP);
const OUT = e8PerpsFromSnapshot(SNAP, { checkedOn: '2026-11-28' });
const row = (pl) => [
  pl.size,
  pl.price,
  pl.promoPrice,
  ...(pl.altPrices ? pl.altPrices.flatMap((a) => [a.price, a.promoPrice]) : pl.altPrice != null ? [pl.altPrice, pl.altPromoPrice] : []),
  ...(pl.more ?? []).flatMap((m) => [m.price, m.promoPrice, m.altPrice, m.altPromoPrice]),
  pl.lines[0].value,
];
const prog = (name) => OUT.programs.find((p) => p.name === name);
// E8 One en curseurs : une ligne de prix d'un drawdown, lue dans la grille [taille, 80 %, avec code, 90 %,
// avec code, 100 %, avec code] (la forme des anciens programmes « E8 One · X% Max », sans le dollar).
const oneRow = (dd) => (pl) => [pl.size, ...[80, 90, 100].flatMap((s) => {
  const g = pl.grid.find((x) => x.maxDrawdown === dd && x.split === s);
  return [g.price, g.promoPrice];
})];

test('les programmes Perpetual du configurateur, dans son ordre, avec leurs regles', () => {
  const rules = OUT.programs.map((p) => [p.name, p.rulesKey, p.steps, p.split, p.profitTarget, p.maxDrawdown, p.ddType, p.dailyLoss, p.priceLabel ?? null]);
  assert.deepEqual(rules, [
    // E8 One en curseurs depuis le 28/11/2026 : les fourchettes, le detail par drawdown dans ses curseurs.
    ['E8 One', 'One', '1 step', '80% / 90% / 100%', '6–21%', '4–14%', 'Dynamic', '3–9.2%', null],
    ['E8 Pro · 6% Max', 'Pro', '1 step', '80% / 100%', '6%', '6%', 'Static', '2.5%', null],
    ['E8 Pro · 8% Max', 'Pro', '1 step', '80% / 100%', '8%', '8%', 'Static', '2.5%', null],
    ['E8 Pro · 10% Max', 'Pro', '1 step', '80% / 100%', '10%', '10%', 'Static', '2.5%', null],
    // Nouveau depuis le 01/11 ; 5 % pendant le Black Friday (« Buy Classic before Wed 2 Dec and your max
    // drawdown is 5%, not 4% », e8markets.com/black-friday).
    ['E8 Classic · 5% Max', 'Classic', '1 step', '80% / 90%', '8%', '5%', 'Static', '2% or none', '2% DLL'],
  ]);
  assert.ok(OUT.programs.every((p) => p.note === ''));
});

test('E8 One : curseurs drawdown et split, cible et perte journaliere suivent le drawdown, depart = le configurateur', () => {
  const one = prog('E8 One');
  // E8 One : cible = 1,5 x drawdown, perte journaliere = 0,66 x drawdown arrondi a 0,1, sauf 4 % -> x 0,75.
  assert.deepEqual(one.sliders, [
    { field: 'maxDrawdown', label: 'Max drawdown', values: [4, 6, 8, 10, 14], default: 6, with: { profitTarget: [6, 9, 12, 15, 21], dailyLoss: [3, 4, 5.3, 6.6, 9.2] } },
    { field: 'split', label: 'Profit split', values: [80, 90, 100], default: 80 },
  ]);
  // Le rendu serveur du configurateur : « Configure account: · Drawdown · 6% Max · Payout · 80% ».
  assert.deepEqual(configuratorStart(SNAP.configurator, 'E8 One'), { drawdown: 6, payout: 80 });
  assert.equal(configuratorStart(SNAP.configurator, 'E8 Pro'), null);
  // La ligne = la position de depart : 6 % / 80 %, ses $48 / $24 (tuile $5K du configurateur), $300 de drawdown.
  assert.deepEqual(one.plans.map((p) => [p.size, p.price, p.promoPrice, p.lines[0].value]).slice(0, 2), [
    [5000, 48, 24, '$300'],
    [10000, 88, 44, '$600'],
  ]);
  for (const p of one.plans) {
    assert.equal(p.grid.length, 15);
    assert.equal(p.altPrices, undefined);
  }
  // Sans position lisible sur la page : la premiere valeur de chaque curseur.
  const s = copy();
  s.configurator = [];
  const first = e8PerpsFromSnapshot(s, { checkedOn: '2026-11-28' }).programs[0];
  assert.deepEqual(first.sliders.map((x) => x.default), [4, 80]);
  assert.deepEqual([first.plans[0].price, first.plans[0].lines[0].value], [40, '$200']);
  // E8 Pro et E8 Classic : un programme par drawdown, comme avant.
  assert.ok(OUT.programs.filter((p) => p.rulesKey !== 'One').every((p) => !p.sliders && p.plans.every((pl) => !pl.grid)));
});

test('chaque taille, chaque payout : les prix du configurateur, avec code (leur arrondi)', () => {
  // E8 One / E8 Pro : [taille, 80 %, avec code, 90 %, avec code, 100 %, avec code, perte max en $] ; ce sont
  // les memes prix que ceux relus a la main dans le configurateur le 01/11/2026 (perps-firms.json).
  assert.deepEqual(prog('E8 One').plans.map(oneRow(4)), [
    [5000, 40, 20, 44, 22, 49, 25],
    [10000, 72, 36, 81, 41, 89, 45],
    [25000, 154, 77, 172, 86, 190, 95],
    [50000, 235, 118, 263, 132, 291, 146],
    [100000, 398, 199, 445, 223, 493, 247],
    [200000, 650, 325, 728, 364, 806, 403],
    [400000, 1301, 651, 1457, 729, 1613, 807],
    [500000, 1627, 814, 1822, 911, 2017, 1009],
  ]);
  assert.deepEqual(prog('E8 One').plans.map(oneRow(14)), [
    [5000, 87, 44, 97, 49, 108, 54],
    [10000, 159, 80, 178, 89, 197, 99],
    [25000, 339, 170, 380, 190, 420, 210],
    [50000, 519, 260, 581, 291, 643, 322],
    [100000, 879, 440, 984, 492, 1090, 545],
    [200000, 1437, 719, 1609, 805, 1782, 891],
    [400000, 2877, 1439, 3222, 1611, 3567, 1784],
    [500000, 3597, 1799, 4028, 2014, 4460, 2230],
  ]);
  assert.deepEqual(prog('E8 Pro · 6% Max').plans.map(row), [
    [5000, 28, 14, 34, 17, '$300'],
    [10000, 59, 30, 70, 35, '$600'],
    [25000, 138, 69, 166, 83, '$1,500'],
    [50000, 218, 109, 262, 131, '$3,000'],
    [100000, 468, 234, 562, 281, '$6,000'],
    [200000, 949, 475, 1138, 569, '$12,000'],
    [400000, 1999, 1000, 2398, 1199, '$24,000'],
    [500000, 2469, 1235, 2962, 1481, '$30,000'],
  ]);
  assert.deepEqual(prog('E8 Pro · 10% Max').plans.map(row), [
    [5000, 48, 24, 58, 29, '$500'],
    [10000, 78, 39, 94, 47, '$1,000'],
    [25000, 159, 80, 190, 95, '$2,500'],
    [50000, 249, 125, 298, 149, '$5,000'],
    [100000, 539, 270, 646, 323, '$10,000'],
    [200000, 1098, 549, 1318, 659, '$20,000'],
    [400000, 2309, 1155, 2770, 1385, '$40,000'],
    [500000, 2858, 1429, 3430, 1715, '$50,000'],
  ]);
  // E8 Classic : [taille, 2 % DLL 80 %, avec code, 2 % DLL 90 %, avec code, sans DLL 80 %, avec code,
  // sans DLL 90 %, avec code, perte max]. e8markets.com/black-friday le 28/11 : « 2% DAILY » $27 / $54 / $108 /
  // $207 / $405, « NO DAILY LIMIT » $33 / $63 / $117 / $288 / $567 ; /perpetual-futures : 50K « $449 $405 »,
  // « No Daily Limit +$162 » (567 - 405).
  assert.deepEqual(prog('E8 Classic · 5% Max').plans.map(row), [
    [2000, 29, 27, 35, 32, 36, 33, 44, 40, '$100'],
    [5000, 59, 54, 71, 64, 69, 63, 83, 75, '$250'],
    [10000, 119, 108, 143, 129, 129, 117, 155, 140, '$500'],
    [25000, 229, 207, 275, 248, 319, 288, 383, 345, '$1,250'],
    [50000, 449, 405, 539, 486, 629, 567, 755, 680, '$2,500'],
  ]);
  assert.equal(prog('E8 Classic · 5% Max').plans[0].more[0].label, 'No DLL');
  // Toutes les tailles de chaque programme.
  assert.deepEqual(
    Object.fromEntries(OUT.programs.map((p) => [p.name.split(' · ')[0], p.plans.map((pl) => pl.size / 1000).join('/')])),
    { 'E8 One': '5/10/25/50/100/200/400/500', 'E8 Pro': '5/10/25/50/100/200/400/500', 'E8 Classic': '2/5/10/25/50' },
  );
});

test('le calcul du site, pas a pas (arrondi au dollar superieur, remise arrondie au dollar superieur)', () => {
  const one = { ...SNAP.products.e8one_perp, id: 'e8one_perp' };
  // 48 x (1 + (4 - 6) x 0,093) = 39,072 -> 40 ; x 1,12 (90 %) = 43,76 -> 44 ; x 1,24 = 48,45 -> 49.
  assert.equal(e8Price(one, 5000, 4, 80), 40);
  assert.equal(e8Price(one, 5000, 4, 90), 44);
  assert.equal(e8Price(one, 5000, 4, 100), 49);
  assert.equal(e8PromoPrice(49, 50), 25);
  assert.equal(e8PromoPrice(449, 10), 405);
  assert.equal(e8PromoPrice(449, 0), 449);
});

test('promo : JTNQ, la meilleure remise affichee sur le Perpetual, sans fin annoncee', () => {
  assert.deepEqual(OUT.promo, { code: 'JTNQ', discountPct: 50, endsAt: null, otherPcts: [10], lastChecked: '2026-11-28' }); // E8 Classic à 10 %
  // Le code public de la firme n'est nulle part : ni dans l'instantane, ni dans la sortie.
  for (const c of ['E8BF', 'REB8']) {
    assert.ok(!JSON.stringify(SNAP).includes(c), `${c} dans la fixture`);
    assert.ok(!JSON.stringify(OUT).includes(c), `${c} dans la sortie`);
  }
});

test('fin de promo : une date avec fuseau passe en ISO UTC, une date sans heure ne se devine pas', () => {
  const s = copy();
  s.discountCodes.find((c) => c.available_products.includes('e8one_perp')).expiration_date = '2026-12-02T23:59:59-05:00';
  assert.equal(e8PerpsFromSnapshot(s, { checkedOn: '2026-11-28' }).promo.endsAt, '2026-12-03T04:59:59.000Z');
  s.discountCodes.find((c) => c.available_products.includes('e8one_perp')).expiration_date = '2026-12-02';
  assert.throws(() => e8PerpsFromSnapshot(s), /E8 perps illisible : date de fin du code « 2026-12-02 »/);
});

test('pairs : les symboles Perpetual de trading-symbols, par groupe', () => {
  assert.deepEqual(OUT.pairs, { count: 263, title: 'Crypto 162 · Stocks 86 · Metals 5 · Indices 4 · Energy 3 · FX 3' });
});

test('notes : reprises de l\'entree precedente, la phrase sur l\'ordre des prix suit les payouts du site', () => {
  const previous = {
    programs: [
      {
        name: 'E8 Pro · 6% Max',
        note: '',
        plans: [{ size: 5000, note: 'Prices for 80%, 90% and 100% payout, in that order. Daily payouts, 1% minimum.' }],
      },
    ],
  };
  const out = e8PerpsFromSnapshot(SNAP, { checkedOn: '2026-11-28', previous });
  const pro = out.programs.find((p) => p.name === 'E8 Pro · 6% Max');
  assert.equal(pro.plans[0].note, 'Prices for 80% and 100% payout, in that order. Daily payouts, 1% minimum.');
  assert.equal(pro.plans[1].note, 'Prices for 80% and 100% payout, in that order.');
  assert.equal(prog('E8 Classic · 5% Max').plans[0].note, 'Prices for 80% and 90% payout, in that order.');
  // E8 One : la note de l'ancien format (« E8 One · X% Max ») reprise, sans la phrase sur l'ordre des prix.
  const old = { programs: [{ name: 'E8 One · 4% Max', note: '', plans: [{ size: 5000, note: 'Prices for 80%, 90% and 100% payout, in that order. 40% best-day rule.' }] }] };
  const one = e8PerpsFromSnapshot(SNAP, { checkedOn: '2026-11-28', previous: old }).programs[0];
  assert.equal(one.plans[0].note, '40% best-day rule.');
  assert.equal(one.plans[1].note, undefined);
  const again = e8PerpsFromSnapshot(SNAP, { checkedOn: '2026-11-28', previous: { programs: [{ name: 'E8 One', note: '', plans: [{ size: 5000, note: '40% best-day rule.' }] }] } });
  assert.equal(again.programs[0].plans[0].note, '40% best-day rule.');
});

test('un compte, un drawdown ou une taille que la firme retire disparait seul ; un compte ajoute apparait seul', () => {
  const s = copy();
  delete s.products.e8classic_perp;
  assert.deepEqual(
    e8PerpsFromSnapshot(s).programs.map((p) => p.name),
    OUT.programs.map((p) => p.name).filter((n) => !n.startsWith('E8 Classic')),
  );
  const a = copy();
  a.code.catalog = a.code.catalog.replace('e8one_perp:{', 'e8zero_perp:{id:"e8zero_perp",name:"E8 Zero",code:"PZ",market:"perpetual"},e8one_perp:{');
  a.products.e8zero_perp = structuredClone(a.products.e8pro_v2_perp);
  assert.deepEqual(
    e8PerpsFromSnapshot(a).programs.map((p) => p.name).slice(0, 3),
    ['E8 Zero · 6% Max', 'E8 Zero · 8% Max', 'E8 Zero · 10% Max'],
  );
  const t = copy();
  t.products.e8pro_v2_perp.settings.drawdowns = [6, 8];
  t.products.e8pro_v2_perp.balances = Object.fromEntries(Object.entries(t.products.e8pro_v2_perp.balances).filter(([k]) => k !== '500000'));
  const pros = e8PerpsFromSnapshot(t).programs.filter((p) => p.rulesKey === 'Pro');
  assert.deepEqual(pros.map((p) => p.name), ['E8 Pro · 6% Max', 'E8 Pro · 8% Max']);
  assert.equal(pros[0].plans.at(-1).size, 400000);
});

test('l\'exception de perte journaliere est relue dans le code du site', () => {
  const s = copy();
  s.code.rules = s.code.rules.replace(/===4\?\.75:null/, '===4?.8:null');
  const one = e8PerpsFromSnapshot(s).programs[0];
  assert.equal(one.sliders[0].with.dailyLoss[0], 3.2);
  assert.equal(one.dailyLoss, '3.2–9.2%');
});

test('snapshot casse ou vide : erreur « E8 perps illisible »', () => {
  const E = /^Error: E8 perps illisible : /;
  const bad = (mutate) => {
    const s = copy();
    mutate(s);
    return () => e8PerpsFromSnapshot(s);
  };
  assert.throws(() => e8PerpsFromSnapshot(null), E);
  assert.throws(() => e8PerpsFromSnapshot({}), E);
  assert.throws(bad((s) => (s.products = {})), E);
  assert.throws(bad((s) => delete s.code.pricing), /code du configurateur absent \(pricing\)/);
  // Formule changee : la lecture s'arrete au lieu de publier des prix faux.
  assert.throws(bad((s) => (s.code.pricing = s.code.pricing.replace('Math.ceil(u)', 'Math.round(u)'))), /formule de prix du configurateur changee \(arrondi du prix\)/);
  assert.throws(bad((s) => (s.code.pricing = s.code.pricing.replace(/\(100-(\w)\)\/100/, '(100-$1)/90'))), /formule de prix du configurateur changee \(prix avec code\)/);
  assert.throws(bad((s) => (s.code.rules = s.code.rules.replace(/Math\.round\((\w)\*(\w)\*10\)\/10/, 'Math.round($1*$2)'))), /regles du configurateur changees/);
  // Aucun compte Perpetual en vente.
  assert.throws(bad((s) => { for (const id of ['e8one_perp', 'e8pro_v2_perp', 'e8classic_perp']) s.products[id].balances = {}; }), /aucun compte Perpetual en vente/);
  // Prix manquant ou aberrant.
  assert.throws(bad((s) => (s.products.e8one_perp.balances['5000'].price = 0)), /prix aberrant/);
  assert.throws(bad((s) => (s.products.e8one_perp.balances['5000'].price = 'x')), /E8 perps illisible/);
  assert.throws(bad((s) => (s.products.e8pro_v2_perp.balances['5000'].price = 1e6)), /prix aberrant/);
  // Programme sans payout, regle inconnue.
  assert.throws(bad((s) => (s.products.e8pro_v2_perp.settings.payoutShares = [])), /aucun payout/);
  assert.throws(bad((s) => (s.products.e8pro_v2_perp.drawdownType = 'eod')), /type de drawdown « eod »/);
  // Le configurateur rendu par le serveur ne montre pas ce que le calcul donne.
  assert.throws(bad((s) => (s.configurator[s.configurator.indexOf('$24')] = '$25')), /le configurateur affiche E8 One \$5K a \$48 \/ \$25/);
  // Symboles vides ou tronques.
  assert.throws(bad((s) => (s.symbols.nodes = [])), /liste des symboles vide/);
  assert.throws(bad((s) => (s.symbols.totalRows = 600)), /liste des symboles tronquee/);
});

test('readE8Perps : les GET du site -> l\'instantane, sans le code public de la firme', async () => {
  const PUBLIC = 'ZZCODE';
  const files = { '/_nuxt/entry.js': 'entry', '/_nuxt/other.js': 'export{}', '/_nuxt/cat.js': SNAP.code.catalog, '/_nuxt/price.js': SNAP.code.pricing, '/_nuxt/rules.js': SNAP.code.rules };
  const lines = SNAP.configurator.map((l) => (l === 'Save $244 with code [code]' ? `Save $244 with code ${PUBLIC}` : l));
  const html =
    '<html><head><link rel="modulepreload" as="script" crossorigin href="/_nuxt/entry.js">' +
    Object.keys(files).slice(1).map((f) => `<link rel="modulepreload" as="script" crossorigin href="${f}">`).join('') +
    '<script type="module" src="/_nuxt/entry.js" crossorigin></script></head><body>' +
    lines.map((l) => `<div>${l}</div>`).join('') +
    `<div>${PUBLIC}</div><script>var x = 1;</script></body></html>`;
  const products = structuredClone(SNAP.products);
  for (const p of Object.values(products)) p.discountCode = PUBLIC;
  const seen = [];
  const fetchText = async (url) => {
    seen.push(url);
    if (url === E8_PERPS_SOURCE.page) return html;
    if (url === E8_PERPS_SOURCE.products) return JSON.stringify({ success: true, data: { products, payouts: { recent: [{ name: 'X' }] } } });
    if (url === E8_PERPS_SOURCE.codes) return JSON.stringify({ success: true, data: SNAP.discountCodes.map((c) => ({ code: PUBLIC, ...c })) });
    if (url === E8_PERPS_SOURCE.symbols) return JSON.stringify({ data: { symbols: SNAP.symbols } });
    const f = files[new URL(url).pathname];
    if (f != null) return f;
    throw new Error(`HTTP 404 sur ${url}`);
  };
  const snap = await readE8Perps({ fetchText });
  assert.ok(!seen.includes('https://e8markets.com/_nuxt/entry.js'), 'le gros fichier d\'entree n\'est pas lu');
  assert.ok(!JSON.stringify(snap).includes(PUBLIC), 'code public dans l\'instantane');
  assert.ok(!JSON.stringify(snap).includes('"recent"'), 'payouts recents (noms de traders) dans l\'instantane');
  assert.deepEqual(snap.code.files, { catalog: '/_nuxt/cat.js', pricing: '/_nuxt/price.js', rules: '/_nuxt/rules.js' });
  assert.deepEqual(e8PerpsFromSnapshot(snap, { checkedOn: '2026-11-28' }), OUT);
  // Page sans le code du configurateur : illisible.
  await assert.rejects(readE8Perps({ fetchText: (u) => (u === E8_PERPS_SOURCE.page ? '<html></html>' : fetchText(u)) }).then((s) => e8PerpsFromSnapshot(s)), /code du configurateur absent/);
});

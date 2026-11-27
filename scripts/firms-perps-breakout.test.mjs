import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BREAKOUT_PERPS_SOURCE,
  breakoutEndsAt,
  breakoutPerpsFromSnapshot,
  readBreakoutPerps,
} from './lib/firms/perps-breakout.mjs';

// Lu sur https://www.breakoutprop.com/pricing/ et sa page de promo /lp/bfcm25 le 28/11/2026 (Paris).
const SNAP = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/perps-breakout-2026-11-28.json', import.meta.url), 'utf8'));
const DAY = '2026-11-28';
const at = (iso) => ({ ...SNAP, fetchedAt: iso });
const withPricing = (fn) => ({ ...SNAP, pricing: { ...SNAP.pricing, html: fn(SNAP.pricing.html) } });
const withPromo = (fn) => ({ ...SNAP, promo: { ...SNAP.promo, html: fn(SNAP.promo.html) } });
const table = (r) => r.programs.map((p) => [p.name, p.plans.map((x) => [x.size, x.price, x.promoPrice])]);

const RULES = { steps: '1 step', split: '80% / 90%', ddType: 'Static', note: '' };

test('les 3 programmes, toutes les tailles et les règles du 28/11/2026', () => {
  const { programs } = breakoutPerpsFromSnapshot(SNAP, { checkedOn: DAY });
  assert.deepEqual(
    programs.map(({ plans, ...rules }) => rules),
    [
      { name: 'Classic', ...RULES, profitTarget: '10%', maxDrawdown: '6%', dailyLoss: '3%' },
      { name: 'Pro', ...RULES, profitTarget: '12%', maxDrawdown: '5%', dailyLoss: '3%' },
      { name: 'Turbo', ...RULES, profitTarget: '9%', maxDrawdown: '3%', dailyLoss: '3%' },
    ],
  );
  // Ordre des clés = celui de public/data/perps-firms.json.
  assert.deepEqual(Object.keys(programs[0]), ['name', 'steps', 'split', 'profitTarget', 'maxDrawdown', 'ddType', 'dailyLoss', 'note', 'plans']);
  assert.deepEqual(Object.keys(programs[0].plans[0]), ['size', 'price', 'promoPrice', 'altPrice', 'altPromoPrice']);
});

test('le 90/10 (« the 90/10 upgrade at checkout costs 20% more ») : second prix de la case, celui de la carte', () => {
  const r = breakoutPerpsFromSnapshot(SNAP, { checkedOn: DAY });
  const alt = r.programs.map((p) => [p.name, p.plans.map((x) => [x.size, x.altPrice, x.altPromoPrice])]);
  assert.deepEqual(alt[0], ['Classic', [[5000, 54, 40.5], [10000, 102, 76.5], [25000, 258, 193.5], [50000, 480, 360], [100000, 960, 720]]]);
  assert.deepEqual(alt[1][1][0], [5000, 39.6, 29.7]); // la carte affiche $39.60
  const later = breakoutPerpsFromSnapshot(at('2026-12-01T00:00:00Z'), { checkedOn: '2026-12-01' });
  assert.deepEqual(later.programs[2].plans[0], { size: 5000, price: 20, promoPrice: 19, altPrice: 24, altPromoPrice: 22.8 });
  // Une page qui ne parle plus du 90/10 : un seul prix, split 80 %.
  const noUpgrade = withPricing((h) => h.split('; the 90/10 upgrade at checkout costs 20% more').join(''));
  const one = breakoutPerpsFromSnapshot(noUpgrade, { checkedOn: DAY });
  assert.equal(one.programs[0].split, '80%');
  assert.deepEqual(Object.keys(one.programs[0].plans[0]), ['size', 'price', 'promoPrice']);
});

test('Black Friday : 25 % pour JTNQ jusqu au 30/11 23:59 UTC, prix remisés affichés par leur page', () => {
  const r = breakoutPerpsFromSnapshot(SNAP, { checkedOn: DAY });
  assert.deepEqual(r.promo, { code: 'JTNQ', discountPct: 25, endsAt: '2026-11-30T23:59:00Z', lastChecked: DAY });
  assert.deepEqual(table(r), [
    ['Classic', [[5000, 45, 33.75], [10000, 85, 63.75], [25000, 215, 161.25], [50000, 400, 300], [100000, 800, 600]]],
    ['Pro', [[5000, 33, 24.75], [10000, 65, 48.75], [25000, 150, 112.5], [50000, 280, 210], [100000, 545, 408.75], [200000, 1090, 817.5]]],
    ['Turbo', [[5000, 20, 15], [10000, 40, 30], [25000, 95, 71.25], [50000, 180, 135], [100000, 330, 247.5], [200000, 660, 495]]],
  ]);
  assert.ok(!JSON.stringify(r).includes('BFCM25'), 'leur code public ne sort jamais');
});

test('après la fin annoncée : retour à JTNQ 5 % sans date de fin, prix × 0,95 au centime', () => {
  const r = breakoutPerpsFromSnapshot(at('2026-12-01T00:00:00Z'), { checkedOn: '2026-12-01' });
  assert.deepEqual(r.promo, { code: 'JTNQ', discountPct: 5, endsAt: null, lastChecked: '2026-12-01' });
  assert.deepEqual(table(r), [
    ['Classic', [[5000, 45, 42.75], [10000, 85, 80.75], [25000, 215, 204.25], [50000, 400, 380], [100000, 800, 760]]],
    ['Pro', [[5000, 33, 31.35], [10000, 65, 61.75], [25000, 150, 142.5], [50000, 280, 266], [100000, 545, 517.75], [200000, 1090, 1035.5]]],
    ['Turbo', [[5000, 20, 19], [10000, 40, 38], [25000, 95, 90.25], [50000, 180, 171], [100000, 330, 313.5], [200000, 660, 627]]],
  ]);
});

test('page de promo passée en phase « cyber » (frais seulement) : plus de remise Black Friday', () => {
  const r = breakoutPerpsFromSnapshot(withPromo((h) => h.replace('data-bf data-offer="friday"', 'data-bf data-offer="cyber"')), { checkedOn: DAY });
  assert.equal(r.promo.discountPct, 5);
  assert.equal(r.promo.endsAt, null);
});

test('bannière pas encore affichée (avant data-start) : JTNQ 5 %', () => {
  const r = breakoutPerpsFromSnapshot(at('2026-11-27T10:00:00Z'), { checkedOn: '2026-11-27' });
  assert.equal(r.promo.discountPct, 5);
});

test('page sans bannière : JTNQ 5 %, la page de promo n est pas demandée', () => {
  const snap = { ...withPricing((h) => h.replace(/<a id="lp24-banner"[\s\S]*?<\/a>/, '')), promo: null };
  assert.equal(breakoutPerpsFromSnapshot(snap, { checkedOn: DAY }).promo.discountPct, 5);
});

test('un plan retiré disparaît, un plan ajouté apparaît seul', () => {
  const hp = (h, fn) => h.replace(/window\.breakoutHomepageData = (\{.*?\});\n/s, (m, json) => `window.breakoutHomepageData = ${JSON.stringify(fn(JSON.parse(json)))};\n`);
  const noTable = (h) => h.replace(/<div class="bk-price-noscript">[\s\S]*?<\/table>/, '');
  const without = withPricing((h) => noTable(hp(h, (d) => ({ ...d, plans: d.plans.filter((p) => p.id !== 'turbo') }))));
  assert.deepEqual(breakoutPerpsFromSnapshot(without, { checkedOn: DAY }).programs.map((p) => p.name), ['Classic', 'Pro']);
  const added = withPricing((h) =>
    noTable(hp(h, (d) => ({ ...d, plans: [...d.plans, { id: 'x', name: '2-Step Swing', target: '8%', dailyLoss: '4%', drawdown: '8%', phases: '2', sizes: { 10000: { p: 70 } } }] }))),
  );
  const last = breakoutPerpsFromSnapshot(added, { checkedOn: DAY }).programs.at(-1);
  // Le tableau <noscript> (qui porte la légende du 90/10) est retiré ici : un seul prix, split 80 %.
  assert.deepEqual(last, { name: 'Swing', steps: '2 steps', split: '80%', profitTarget: '8%', maxDrawdown: '8%', ddType: 'Static', dailyLoss: '4%', note: '', plans: [{ size: 10000, price: 70, promoPrice: 52.5 }] });
});

test('previous : la note du JSON actuel est gardée, la page n en porte pas', () => {
  const previous = { programs: [{ name: 'Pro', note: 'gardée' }] };
  const r = breakoutPerpsFromSnapshot(SNAP, { checkedOn: DAY, previous });
  assert.deepEqual(r.programs.map((p) => p.note), ['', 'gardée', '']);
});

test('page cassée, vide ou incomplète : erreur « Breakout illisible »', () => {
  const hp = (fn) => withPricing((h) => h.replace(/window\.breakoutHomepageData = (\{.*?\});\n/s, (m, json) => `window.breakoutHomepageData = ${JSON.stringify(fn(JSON.parse(json)))};\n`));
  const editPlan = (id, fn) => hp((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? fn(p) : p)) }));
  const cases = {
    'snapshot vide': {},
    'page vide': { ...SNAP, pricing: { url: BREAKOUT_PERPS_SOURCE, html: '' } },
    'page sans données': withPricing((h) => h.replace('window.breakoutHomepageData', 'window.autreChose')),
    'aucun plan': hp((d) => ({ ...d, plans: [] })),
    'programme sans taille': editPlan('pro', (p) => ({ ...p, sizes: {} })),
    'prix manquant': editPlan('pro', (p) => ({ ...p, sizes: { ...p.sizes, 5000: { u: 40 } } })),
    'prix aberrant': editPlan('turbo', (p) => ({ ...p, sizes: { ...p.sizes, 5000: { p: 2 } } })),
    'champ inconnu dans une taille': editPlan('turbo', (p) => ({ ...p, sizes: { ...p.sizes, 5000: { ...p.sizes[5000], sale: 15 } } })),
    'règle manquante': editPlan('1step', (p) => ({ ...p, target: '' })),
    'tableau <noscript> en désaccord': withPricing((h) => h.replace('<td>$45</td>', '<td>$49</td>')),
    'Spark affiché': hp((d) => ({ ...d, spark: { ...d.spark, enabled: true } })),
    'remise affichée hors bannière': withPricing((h) => h.replace('Help Me Choose</a>', 'Help Me Choose</a><p>Today 30% off everything</p>')),
    'bannière affichée, page de promo absente': { ...SNAP, promo: { url: SNAP.promo.url, error: 'HTTP 404' } },
    'page de promo sans bf-config': withPromo((h) => h.replace('id="bf-config"', 'id="autre"')),
    'prix de la page promo en désaccord': withPromo((h) => h.replace('"5k":[4500,3375]', '"5k":[4900,3675]')),
  };
  for (const [why, snap] of Object.entries(cases))
    assert.throws(() => breakoutPerpsFromSnapshot(snap, { checkedOn: DAY }), /^Error: Breakout illisible : /, why);
});

test('fin annoncée sans année : l année la plus proche de la lecture', () => {
  const t = Date.parse('2026-11-28T00:00:00Z');
  assert.equal(breakoutEndsAt('Promotion will terminate on 30 November, 23:59 UTC.', t), '2026-11-30T23:59:00Z');
  assert.equal(breakoutEndsAt('Expires 5 January at 08:00 UTC.', Date.parse('2026-12-20T00:00:00Z')), '2027-01-05T08:00:00Z');
  assert.equal(breakoutEndsAt('rien', t), null);
});

test('readBreakoutPerps : /pricing/, puis la page de la bannière ; même résultat que la fixture', async () => {
  const asked = [];
  const pages = { [BREAKOUT_PERPS_SOURCE]: SNAP.pricing.html, [SNAP.promo.url]: SNAP.promo.html };
  const snap = await readBreakoutPerps({
    fetchText: async (url) => {
      asked.push(url);
      return pages[url];
    },
    now: () => new Date(SNAP.fetchedAt),
  });
  assert.deepEqual(asked, [BREAKOUT_PERPS_SOURCE, 'https://www.breakoutprop.com/lp/bfcm25']);
  assert.deepEqual(breakoutPerpsFromSnapshot(snap, { checkedOn: DAY }), breakoutPerpsFromSnapshot(SNAP, { checkedOn: DAY }));
  const failing = await readBreakoutPerps({
    fetchText: async (url) => {
      if (url !== BREAKOUT_PERPS_SOURCE) throw new Error('HTTP 503');
      return SNAP.pricing.html;
    },
    now: () => new Date(SNAP.fetchedAt),
  });
  assert.deepEqual(failing.promo, { url: 'https://www.breakoutprop.com/lp/bfcm25', error: 'HTTP 503' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { formatPriceValue, parseTradeify, runTradeify } from './scrape-tradeify.mjs';

// tradeify.co enregistrée le 2026-11-01 à 00:45 UTC (curl, User-Agent navigateur), code GEMS -30 %.
const PAGE = fs.readFileSync(new URL('./__fixtures__/tradeify-2026-11-01.html', import.meta.url), 'utf8');
const RECORDED = Date.parse('2026-11-01T00:45:00Z');
const DATA = JSON.parse(fs.readFileSync(new URL('../public/data/compare-extra-firms.json', import.meta.url), 'utf8'));

// Relevé à la main sur leur page le 01/11/2026 (price avec GEMS / originalPrice).
const GEMS_TABLE = [
  ['Growth', 25000, 69, 99],
  ['Growth', 50000, 102, 145],
  ['Growth', 100000, 179, 255],
  ['Growth', 150000, 258, 369],
  ['Select', 25000, 76, 109],
  ['Select', 50000, 116, 165],
  ['Select', 100000, 186, 265],
  ['Select', 150000, 258, 369],
  ['Lightning', 25000, 242, 345],
  ['Lightning', 50000, 344, 492],
  ['Lightning', 100000, 462, 660],
  ['Lightning', 150000, 557, 796],
];

const table = (plans) => plans.map((p) => [p.programName, p.size, p.price, p.originalPrice]);
const firmTable = (firm) => firm.programs.flatMap((pr) => pr.plans.map((pl) => [pr.name, pl.size, pl.price, pl.originalPrice]));
// La page enregistrée le 01/11 cachait le Select 300K (is300visible = false) : le JSON sans lui.
const without300K = (data) => {
  const select = data.firms.find((f) => f.id === 'tradeify').programs.find((p) => p.name === 'Select');
  select.plans = select.plans.filter((p) => p.size !== 300000);
  return data;
};
const freshData = () => without300K(structuredClone(DATA));
const quiet = () => {};

// La même page, sans aucun code : leurs couponDetails à 0 % (getDiscountValue : pas de remise,
// ni prix barré ni « Save $X with code »).
const NO_CODE = PAGE.replace(/(const couponDetails = \{)([\s\S]*?)(\};)/, (_, a, body, c) => a + body.replace(/\['[^']*',\s*\d+\]/g, "['none', 0]") + c);

test('page du 01/11 : code GEMS -30 %, fin le 31/10 23:59 heure de New York, les 12 prix', () => {
  const r = parseTradeify(PAGE, RECORDED);
  assert.deepEqual(r.promo, { label: '30% off with code GEMS', code: 'GEMS', ends: '2026-10-31T23:59:00-04:00' });
  assert.equal(r.code, 'GEMS');
  assert.deepEqual(table(r.plans), GEMS_TABLE);
  assert.deepEqual(r.notices, []); // le 300K Select est caché chez eux (is300visible = false)
});

test('la même page en guillemets doubles (leur page depuis novembre) donne le même résultat', () => {
  const doubled = PAGE.replace(/(const (?:couponDetails|GrowthData|SelectData|LightningData)\s*=[\s\S]*?<\/script>)/g, (b) => b.replace(/'([^'\n]*)'/g, '"$1"'));
  assert.notEqual(doubled, PAGE);
  assert.deepEqual(parseTradeify(doubled, RECORDED), parseTradeify(PAGE, RECORDED));
});

test('le Select 300K : relu quand ils le vendent, firme stale quand il disparaît de leur page', async () => {
  const visible = PAGE.replace('is300visible = false', 'is300visible = true');
  assert.notEqual(visible, PAGE);
  const r = parseTradeify(visible, RECORDED);
  const p = r.plans.find((x) => x.programName === 'Select' && x.size === 300000);
  assert.ok(p);
  assert.deepEqual(r.notices, []);
  const withIt = structuredClone(DATA);
  assert.equal((await runTradeify(withIt, { read: async () => visible, now: RECORDED, log: quiet })).ok, true);
  const hidden = structuredClone(DATA);
  assert.equal((await runTradeify(hidden, { read: async () => PAGE, now: RECORDED, log: quiet })).ok, false);
  assert.equal(hidden.firms.find((f) => f.id === 'tradeify').stale, true);
});

test('leur arrondi : ,5 vers le haut', () => {
  assert.equal(formatPriceValue((145 * 70) / 100, false), 102);
  assert.equal(formatPriceValue((345 * 70) / 100, false), 242);
  assert.equal(formatPriceValue((369 * 70) / 100, false), 258);
});

test('relecture appliquée au JSON : 12 prix, code, lastChecked, pas stale', async () => {
  const data = freshData();
  const { ok } = await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.deepEqual(firmTable(firm), GEMS_TABLE);
  assert.equal(firm.code, 'GEMS');
  assert.equal(firm.promo.code, 'GEMS');
  assert.equal(firm.lastChecked, '2026-11-01');
  assert.equal(firm.stale, false);
  // Lucid n'est jamais touché (403 Cloudflare, relu à la main).
  assert.deepEqual(data.firms.find((f) => f.id === 'lucid-trading'), DATA.firms.find((f) => f.id === 'lucid-trading'));
});

test('« rien n\'a changé » se dit autrement que « pas pu lire »', async () => {
  const data = freshData();
  await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: quiet });
  const lines = [];
  const again = await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: (l) => lines.push(l) });
  assert.deepEqual(again, { ok: true, changes: [] });
  assert.match(lines.join('\n'), /OK — 12 prix relus, rien n'a changé \(code GEMS/);
  assert.doesNotMatch(lines.join('\n'), /ÉCHEC/);
});

test('sans code affiché : promo null, code null, prix = prix catalogue', async () => {
  const r = parseTradeify(NO_CODE, RECORDED);
  assert.equal(r.promo, null);
  assert.equal(r.code, null);
  assert.equal(r.plans.length, 12);
  assert.ok(r.plans.every((p) => p.price === p.originalPrice));
  assert.deepEqual(r.plans.map((p) => p.originalPrice), GEMS_TABLE.map((row) => row[3]));

  const data = freshData();
  const lines = [];
  const { ok } = await runTradeify(data, { read: async () => NO_CODE, now: RECORDED, log: (l) => lines.push(l) });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.equal(firm.promo, null);
  assert.equal(firm.code, null);
  assert.ok(firm.programs.every((pr) => pr.plans.every((pl) => pl.price === pl.originalPrice)));
  assert.match(lines.join('\n'), /aucun code affiché/);
});

// Le code de novembre 2026 tel que leur page l'écrit : une remise par programme.
const withCoupons = (lines) => PAGE.replace(/(const couponDetails = \{)[\s\S]*?(\};)/, `$1 ${lines} $2`);
const NOV_PAGE = withCoupons("default_code: ['NOV', 30], growth: ['NOV', 40], select: ['NOV', 30], lightning: ['NOV', 30], none: ['none', 0],");

test('même code, remise différente par programme : chaque prix porte la sienne', async () => {
  const r = parseTradeify(NOV_PAGE, RECORDED);
  assert.equal(r.code, 'NOV');
  assert.equal(r.promo.label, '30-40% off with code NOV');
  const growth = r.plans.filter((p) => p.programName === 'Growth').map((p) => [p.size, p.price, p.originalPrice]);
  assert.deepEqual(growth, [[25000, 59, 99], [50000, 87, 145], [100000, 153, 255], [150000, 221, 369]]);
  const select25 = r.plans.find((p) => p.programName === 'Select' && p.size === 25000);
  assert.deepEqual([select25.price, select25.originalPrice], [76, 109]);

  const data = freshData();
  const { ok } = await runTradeify(data, { read: async () => NOV_PAGE, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.equal(firm.code, 'NOV');
  assert.equal(firm.stale, false);
  assert.equal(firm.programs[0].plans[0].price, 59);
});

test('un code par programme : chaque programme garde le sien, pas de code de firme', async () => {
  const twoCodes = withCoupons("default_code: ['NOV', 30], growth: ['GROW', 40], select: ['NOV', 30], lightning: ['NOV', 30],");
  const data = freshData();
  const { ok } = await runTradeify(data, { read: async () => twoCodes, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  const program = (name) => firm.programs.find((p) => p.name === name);
  assert.equal(firm.code, null);
  assert.equal(firm.stale, false);
  assert.equal(program('Growth').promoCode, 'GROW');
  assert.equal(program('Growth').promoLabel, '40% off with code GROW');
  assert.equal(program('Growth').plans[0].price, 59);
  assert.equal(program('Select').promoCode, 'NOV');
  assert.equal(program('Select').plans[0].price, 76);

  // Le mois suivant, un seul code : les codes par programme disparaissent.
  await runTradeify(data, { read: async () => NOV_PAGE, now: RECORDED, log: quiet });
  assert.equal(firm.code, 'NOV');
  assert.equal(program('Growth').promoCode, undefined);
  assert.equal(program('Growth').promoLabel, undefined);
});

test('un code sur certains programmes seulement : les autres au prix catalogue', () => {
  const r = parseTradeify(withCoupons("default_code: ['none', 0], growth: ['GROW', 40], select: ['none', 0], lightning: ['none', 0],"), RECORDED);
  assert.deepEqual(r.offers, { Growth: { code: 'GROW', label: '40% off with code GROW' } });
  assert.equal(r.code, null);
  const select = r.plans.find((p) => p.programName === 'Select' && p.size === 25000);
  assert.equal(select.price, select.originalPrice);
});

test('date de fin déjà passée sur leur page (pas mise à jour) : le code reste, la date est ignorée', () => {
  const r = parseTradeify(PAGE, Date.parse('2026-11-02T12:00:00Z'));
  assert.deepEqual(r.promo, { label: '30% off with code GEMS', code: 'GEMS' });
  assert.match(r.notices.join('\n'), /déjà passée/);
});

test('plusieurs codes dans un même programme : données gardées, stale, échec', async () => {
  const start = PAGE.indexOf('const GrowthData');
  const end = PAGE.indexOf('</script>', start);
  const growth = PAGE.slice(start, end).replace(/(name: '25K'[\s\S]*?couponCode: ')growth/g, '$1select');
  const mixed = PAGE.slice(0, start) + growth + PAGE.slice(end);
  const page = mixed.replace(/(const couponDetails = \{)[\s\S]*?(\};)/, "$1 default_code: ['NOV', 30], growth: ['GROW', 40], select: ['NOV', 30], lightning: ['NOV', 30], $2");
  await assertBroken(async () => page, /Growth : plusieurs codes dans le même programme/);
});

async function assertBroken(read, reason) {
  const data = freshData();
  const before = structuredClone(data.firms.find((f) => f.id === 'tradeify'));
  const lines = [];
  const res = await runTradeify(data, { read, now: RECORDED, log: (l) => lines.push(l) });
  assert.deepEqual(res, { ok: false, changes: [] });
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.equal(firm.stale, true);
  assert.deepEqual({ ...firm, stale: before.stale }, before); // rien d'autre ne bouge
  assert.match(lines.join('\n'), /ÉCHEC — pas pu lire la page/);
  assert.match(lines.join('\n'), reason);
  assert.doesNotMatch(lines.join('\n'), /OK —/);
}

test('page cassée (challenge Cloudflare) : données gardées, stale, échec', async () => {
  const challenge = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>${'x'.repeat(2000)}</body></html>`;
  await assertBroken(async () => challenge, /couponDetails introuvable/);
});

test('moins de 12 prix : données gardées, stale, échec', async () => {
  const start = PAGE.indexOf('const LightningData');
  const end = PAGE.indexOf('</script>', start);
  const eleven = PAGE.slice(0, start) + PAGE.slice(start, end).replaceAll("name: '150K'", "name: '150X'") + PAGE.slice(end);
  await assertBroken(async () => eleven, /11\/12 prix trouvés \(manquent : Lightning \$150K\)/);
});

test('site injoignable (HTTP 403) : données gardées, stale, échec', async () => {
  await assertBroken(async () => {
    throw new Error('HTTP 403 sur https://tradeify.co/');
  }, /HTTP 403/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { formatPriceValue, parseTradeify, runTradeify } from './scrape-tradeify.mjs';
import { parseCodes } from '../lib/firm-codes.mjs';
import { firmAt } from '../lib/promo-ends.mjs';

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
// La page enregistrée le 01/11 n'avait pas encore Inter Miami (ajouté chez eux depuis) : le JSON sans lui.
const withoutMiami = (data) => {
  const firm = data.firms.find((f) => f.id === 'tradeify');
  firm.programs = firm.programs.filter((p) => p.name !== 'Inter Miami');
  return data;
};
// Elle cachait aussi le Select 300K (is300visible = false) : le JSON sans lui.
const without300K = (data) => {
  const select = data.firms.find((f) => f.id === 'tradeify').programs.find((p) => p.name === 'Select');
  select.plans = select.plans.filter((p) => p.size !== 300000);
  return withoutMiami(data);
};
const freshData = () => without300K(structuredClone(DATA));
// La même firme non affiliée (Tradeify avant le 19/11/2026) : son code public est écrit tel quel.
const publicData = () => {
  const data = freshData();
  data.firms.find((f) => f.id === 'tradeify').affiliate = false;
  return data;
};
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
  // Caché, il était aussi sans code chez eux ; en vente, il porte le code du programme (page du 04/11).
  const visible = PAGE.replace('is300visible = false', 'is300visible = true').replace(/(name: '300K',[\s\S]*?couponCode: ')[^']*'/g, "$1select'");
  assert.notEqual(visible, PAGE);
  const r = parseTradeify(visible, RECORDED);
  const p = r.plans.find((x) => x.programName === 'Select' && x.size === 300000);
  assert.ok(p);
  assert.deepEqual(r.notices, []);
  const withIt = withoutMiami(structuredClone(DATA));
  assert.equal((await runTradeify(withIt, { read: async () => visible, now: RECORDED, log: quiet })).ok, true);
  const hidden = withoutMiami(structuredClone(DATA));
  assert.equal((await runTradeify(hidden, { read: async () => PAGE, now: RECORDED, log: quiet })).ok, false);
  assert.equal(hidden.firms.find((f) => f.id === 'tradeify').stale, true);
});

test('leur arrondi : ,5 vers le haut', () => {
  assert.equal(formatPriceValue((145 * 70) / 100, false), 102);
  assert.equal(formatPriceValue((345 * 70) / 100, false), 242);
  assert.equal(formatPriceValue((369 * 70) / 100, false), 258);
});

test('relecture appliquée au JSON : 12 prix, code, lastChecked, pas stale', async () => {
  const data = publicData();
  const { ok } = await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.deepEqual(firmTable(firm), GEMS_TABLE);
  assert.equal(firm.code, 'GEMS');
  assert.equal(firm.promo.code, 'GEMS');
  assert.equal(firm.lastChecked, '2026-11-01');
  assert.equal(firm.stale, false);
  // Lucid n'est jamais touché par ce script (il a le sien : scrape-lucid.mjs).
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

  const data = publicData();
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

  const data = publicData();
  const { ok } = await runTradeify(data, { read: async () => NOV_PAGE, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.equal(firm.code, 'NOV');
  assert.equal(firm.stale, false);
  assert.equal(firm.programs[0].plans[0].price, 59);
});

test('un code par programme : chaque programme garde le sien, pas de code de firme', async () => {
  const twoCodes = withCoupons("default_code: ['NOV', 30], growth: ['GROW', 40], select: ['NOV', 30], lightning: ['NOV', 30],");
  const data = publicData();
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

// Tradeify affiliée depuis le 19/11/2026, code JackTNQ (Angelo : « c officielle j'ai le code
// JackTNQ sur tradeify. donc mtn go changer dans mon site »).
const PUBLIC_CODES = /\b(GEMS|NOV|GROW)\b/;

test('codes.md et le JSON impriment le même code pour Tradeify : JackTNQ, lien vers leur site', () => {
  const codes = parseCodes(fs.readFileSync(new URL('../content/prop-firms/codes.md', import.meta.url), 'utf8'));
  const firm = DATA.firms.find((f) => f.id === 'tradeify');
  assert.equal(codes.tradeify, 'JackTNQ');
  assert.equal(firm.code, codes.tradeify);
  assert.equal(firm.affiliate, true);
  assert.equal(firm.url, 'https://tradeify.co/#pricing');
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);
  // Lucid reste non affiliée, son code public tel quel.
  const lucid = DATA.firms.find((f) => f.id === 'lucid-trading');
  assert.equal(lucid.affiliate, false);
  assert.equal(codes['lucid-trading'], undefined);
});

test('firme affiliée : prix et date de fin relus, le code imprimé reste JackTNQ', async () => {
  const data = freshData();
  const lines = [];
  const { ok } = await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: (l) => lines.push(l) });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.deepEqual(firmTable(firm), GEMS_TABLE);
  assert.equal(firm.code, 'JackTNQ');
  assert.deepEqual(firm.promo, { label: '30% off with code JackTNQ', code: 'JackTNQ', ends: '2026-10-31T23:59:00-04:00' });
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);
  assert.match(lines.join('\n'), /code imprimé JackTNQ/);
});

test('firme affiliée : jamais de code public dans le JSON, un code ou un code par programme', async () => {
  const data = freshData();
  const firm = data.firms.find((f) => f.id === 'tradeify');
  const program = (name) => firm.programs.find((p) => p.name === name);

  await runTradeify(data, { read: async () => NOV_PAGE, now: RECORDED, log: quiet });
  assert.equal(firm.code, 'JackTNQ');
  assert.equal(firm.promo.label, '30-40% off with code JackTNQ');
  assert.equal(firm.programs[0].plans[0].price, 59);
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);

  const twoCodes = withCoupons("default_code: ['NOV', 30], growth: ['GROW', 40], select: ['NOV', 30], lightning: ['NOV', 30],");
  await runTradeify(data, { read: async () => twoCodes, now: RECORDED, log: quiet });
  assert.equal(firm.code, 'JackTNQ');
  assert.equal(program('Growth').promoCode, 'JackTNQ');
  assert.equal(program('Growth').promoLabel, '40% off with code JackTNQ');
  assert.equal(program('Growth').plans[0].price, 59);
  assert.equal(program('Select').plans[0].price, 76);
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);
});

test('firme affiliée, page sans code : prix catalogue, promo null, le code imprimé reste', async () => {
  const data = freshData();
  const { ok } = await runTradeify(data, { read: async () => NO_CODE, now: RECORDED, log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.equal(firm.promo, null);
  assert.equal(firm.code, 'JackTNQ');
  assert.ok(firm.programs.every((pr) => pr.plans.every((pl) => pl.price === pl.originalPrice)));
});

// Une affiliée garde son code imprimé après la fin de la promo, comme les autres partenaires : le
// code est celui d'Angelo (codes.md), et le disclaimer dit qu'une firme sans code JTNQ ou JackTNQ
// n'est pas affiliée. Seuls les prix remisés disparaissent.
test('firme affiliée, date de fin passée : firmAt garde JackTNQ, retire les prix remisés', async () => {
  const data = freshData();
  await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: quiet });
  const firm = data.firms.find((f) => f.id === 'tradeify');
  const ends = Date.parse(firm.promo.ends);
  assert.equal(firmAt(firm, ends - 1).code, 'JackTNQ');
  const after = firmAt(firm, ends);
  assert.equal(after.code, 'JackTNQ');
  assert.equal(after.promo, null);
  assert.ok(after.programs.every((pr) => pr.plans.every((pl) => pl.originalPrice === null)));
  assert.deepEqual(after.programs.flatMap((pr) => pr.plans.map((pl) => pl.price)), GEMS_TABLE.map((row) => row[3]));
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

test('firme affiliée, date de fin déjà passée sur leur page : prix remisés gardés (ils les appliquent encore), pas de date, JackTNQ', async () => {
  const data = freshData();
  const { ok } = await runTradeify(data, { read: async () => PAGE, now: Date.parse('2026-11-02T12:00:00Z'), log: quiet });
  assert.equal(ok, true);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.deepEqual(firm.promo, { label: '30% off with code JackTNQ', code: 'JackTNQ' });
  assert.equal(firm.code, 'JackTNQ');
  assert.deepEqual(firmTable(firm), GEMS_TABLE);
  // Sans date de fin, firmAt la rend telle quelle : le code et les prix qu'ils affichent.
  assert.equal(firmAt(firm, Date.parse('2026-12-01T12:00:00Z')), firm);
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

// tradeify.co enregistrée le 2026-11-19 vers 12:05 UTC (curl, User-Agent navigateur) : code NOV,
// -45 % sur les 25K (« excluding Miami »), -30 % ailleurs, Select 300K en vente, et le 4e programme
// Inter Miami (« Limited Edition », 10K / 25K / 50K, onglet Tradovate ; WealthCharts et Tradesea
// en commentaire dans leur JS).
const PAGE_1119 = fs.readFileSync(new URL('./__fixtures__/tradeify-2026-11-19.html', import.meta.url), 'utf8');
const RECORDED_1119 = Date.parse('2026-11-19T12:05:00Z');
const NOV_TABLE = [
  ['Growth', 25000, 54, 99],
  ['Growth', 50000, 102, 145],
  ['Growth', 100000, 179, 255],
  ['Growth', 150000, 258, 369],
  ['Select', 25000, 60, 109],
  ['Select', 50000, 116, 165],
  ['Select', 100000, 186, 265],
  ['Select', 150000, 258, 369],
  ['Select', 300000, 368, 525],
  ['Lightning', 25000, 190, 345],
  ['Lightning', 50000, 344, 492],
  ['Lightning', 100000, 462, 660],
  ['Lightning', 150000, 557, 796],
  ['Inter Miami', 10000, 79, 113],
  ['Inter Miami', 25000, 153, 219],
  ['Inter Miami', 50000, 263, 376],
];

test('page du 19/11 : 16 prix, Inter Miami compris (le 25K Miami à -30 %, pas -45 %), fin le 30/11', () => {
  assert.match(PAGE_1119, /\/\/\s*broker_name: "WealthCharts"/); // le piège : des plateformes en commentaire
  const r = parseTradeify(PAGE_1119, RECORDED_1119);
  assert.deepEqual(table(r.plans), NOV_TABLE);
  assert.deepEqual(r.promo, { label: '30-45% off with code NOV', code: 'NOV', ends: '2026-11-30T23:59:00-05:00' });
  assert.deepEqual(r.notices, []);
});

// Les prix du JSON changent chaque jour (le bot) : seuls ses comptes comptent ici, les 16 relus.
test('le JSON livré, relu sur la page du 19/11 : ses 16 comptes relus, code imprimé JackTNQ', async () => {
  const data = structuredClone(DATA);
  const lines = [];
  const res = await runTradeify(data, { read: async () => PAGE_1119, now: RECORDED_1119, log: (l) => lines.push(l) });
  assert.equal(res.ok, true);
  assert.match(lines.join('\n'), /OK — 16 prix relus.*code NOV jusqu'au 2026-11-30T23:59:00-05:00 ; code imprimé JackTNQ/);
  const firm = data.firms.find((f) => f.id === 'tradeify');
  assert.deepEqual(firmTable(firm), NOV_TABLE);
  assert.equal(firm.promo.label, '30-45% off with code JackTNQ');
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);
});

test('Inter Miami caché chez eux (isMiamivisible = false) : 12 + 1 prix lus, le JSON qui l\'a encore = stale, échec', async () => {
  const hidden = PAGE_1119.replace('const isMiamivisible = true', 'const isMiamivisible = false');
  assert.notEqual(hidden, PAGE_1119);
  const r = parseTradeify(hidden, RECORDED_1119);
  assert.deepEqual(table(r.plans), NOV_TABLE.filter((row) => row[0] !== 'Inter Miami'));
  const data = structuredClone(DATA);
  const lines = [];
  const res = await runTradeify(data, { read: async () => hidden, now: RECORDED_1119, log: (l) => lines.push(l) });
  assert.deepEqual(res, { ok: false, changes: [] });
  assert.equal(data.firms.find((f) => f.id === 'tradeify').stale, true);
  assert.match(lines.join('\n'), /ÉCHEC — pas pu lire la page : Inter Miami \$10K du JSON pas trouvé sur leur page/);
});

test('Inter Miami dans le JSON : mêmes chiffres que leur carte Tradovate du 19/11', () => {
  const miami = DATA.firms.find((f) => f.id === 'tradeify').programs.find((p) => p.name === 'Inter Miami');
  assert.deepEqual(
    miami.plans.map((p) => [p.size, p.profitTarget, p.maxDrawdown, p.ddType, p.dailyLoss, p.dailyLossSoft, p.contracts, p.minDays, p.consistency]),
    [
      [10000, 1000, 500, 'Static', 300, true, '10 micros', 0, 'None'],
      [25000, 2000, 1000, 'Static', 600, true, '20 micros', 0, 'None'],
      [50000, 3500, 1500, 'Static', 900, true, '30 micros', 0, 'None'],
    ],
  );
  // Chaque compte vendu aussi sans daily loss (leur bouton DLL Type « None », dllData) : filtre With et Without.
  assert.ok(miami.plans.every((p) => p.alsoWithoutDailyLoss === true));
  assert.equal(miami.payoutFrequency, 'Daily');
  assert.equal(miami.minPayout, '$200 / $400 / $600 gross (10K / 25K / 50K)');
  // Pas publiés pour Inter Miami : ni max payout (leur « Daily Profit Cap » est en commentaire), ni
  // activation fee, ni consistency une fois funded.
  for (const k of ['maxPayout', 'fundedConsistency']) assert.ok(!(k in miami), k);
  assert.ok(miami.plans.every((p) => !('activationFee' in p)));
});

test('firme affiliée sans code imprimé : rien écrit (le code public ne passe pas), stale, échec', async () => {
  const data = freshData();
  const firm = data.firms.find((f) => f.id === 'tradeify');
  delete firm.code;
  const lines = [];
  const res = await runTradeify(data, { read: async () => PAGE, now: RECORDED, log: (l) => lines.push(l) });
  assert.deepEqual(res, { ok: false, changes: [] });
  assert.equal(firm.stale, true);
  assert.equal(firm.code, undefined);
  assert.doesNotMatch(JSON.stringify(firm), PUBLIC_CODES);
  assert.match(lines.join('\n'), /firme affiliée sans code imprimé/);
});

test('Lucid: chaque plan dont la note dit « Daily Loss Limit OFF » est vendu aussi sans daily loss (filtre With et Without)', () => {
  const lucid = DATA.firms.find((f) => f.id === 'lucid-trading');
  const offs = lucid.programs.flatMap((p) => p.plans.filter((pl) => /Daily Loss Limit OFF/.test(pl.note ?? '')));
  assert.equal(offs.length, 12); // Pro, Flex et Daily (EOD) × 4 tailles ; Daily (Intraday) et Direct ne le disent pas
  assert.ok(offs.every((pl) => pl.dailyLoss > 0 && pl.alsoWithoutDailyLoss === true));
  const autres = lucid.programs.flatMap((p) => p.plans.filter((pl) => !/Daily Loss Limit OFF/.test(pl.note ?? '')));
  assert.ok(autres.every((pl) => pl.alsoWithoutDailyLoss !== true)); // jamais deviné
});

// tradeify.co enregistrée le 2026-11-22 vers 20:40 UTC (curl, User-Agent navigateur). Select 50K :
// « price: 165 » sur le compte, mais le mode de consistency coché (40 %, « isSelected: true ») dit
// 174 et la carte affiche 174 (Chrome, 22/11/2026 : 174 -> 122). Le bot lisait 165 : le site
// affichait 116 au lieu de 122.
const PAGE_1122 = fs.readFileSync(new URL('./__fixtures__/tradeify-2026-11-22.html', import.meta.url), 'utf8');
const RECORDED_1122 = Date.parse('2026-11-22T20:40:00Z');

test('page du 22/11 : le prix lu est celui du mode de consistency coché (Select 50K 174, pas 165)', () => {
  assert.match(PAGE_1122, /name:\s*"50K",\s*isSelected:\s*true,\s*isVisible:\s*true,\s*price:\s*165,/);
  const r = parseTradeify(PAGE_1122, RECORDED_1122);
  const expected = NOV_TABLE.map((row) => (row[0] === 'Select' && row[1] === 50000 ? ['Select', 50000, 122, 174] : row));
  assert.deepEqual(table(r.plans), expected);
  assert.deepEqual(r.notices, []);
});

test('un compte sans mode coché garde le price du compte', () => {
  const noModes = PAGE_1122.replace(/discount:\s*\d+,\s*isSelected:\s*true,\s*price:/g, 'discount: 40, isSelected: false, price:');
  assert.notEqual(noModes, PAGE_1122);
  const r = parseTradeify(noModes, RECORDED_1122);
  const select50 = r.plans.find((p) => p.programName === 'Select' && p.size === 50000);
  assert.equal(select50.originalPrice, 165);
});

// Les options de consistency (30 % / 40 % / 50 %) de Select, lues sur leur page du 22/11 : le 30 %
// est apparu chez eux entre le 19/11 (mode 50 % seul) et le 22/11 ; le bot ne lisait pas ces options.
const modesOf = (r, program, size) => r.plans.find((p) => p.programName === program && p.size === size).modes;

test('page du 22/11 : Select 50K a 3 options de consistency, prix au rabais du compte (30 % : 145 -> 102)', () => {
  const r = parseTradeify(PAGE_1122, RECORDED_1122);
  assert.deepEqual(modesOf(r, 'Select', 50000), [
    { consistency: 30, selected: false, list: 145, price: 102, reset: 105 },
    { consistency: 40, selected: true, list: 174, price: 122, reset: 119 },
    { consistency: 50, selected: false, list: 216, price: 151, reset: 152 },
  ]);
  // Le 25K a -45 % : les options aussi (99 -> 54, 135 -> 74), comme sur la carte.
  assert.deepEqual(modesOf(r, 'Select', 25000).map((m) => [m.consistency, m.list, m.price, m.reset]), [[30, 99, 54, 69], [40, 109, 60, 75], [50, 135, 74, 90]]);
  assert.deepEqual(modesOf(r, 'Select', 300000), []); // pas d'option sur le 300K
  assert.deepEqual(modesOf(r, 'Growth', 50000), []);
});

test('la note de Select 50K reprend le 30 %, le 50 % et le reset fee de leur page, le reste de la note ne bouge pas', async () => {
  const data = structuredClone(DATA);
  const select = data.firms.find((f) => f.id === 'tradeify').programs.find((p) => p.name === 'Select');
  const tail = ' Funded path chosen after passing: Daily (daily loss $1,000, max drawdown $2,000, buffer $2,100) or Flex (no daily loss limit, max drawdown $2,000).';
  select.plans.find((p) => p.size === 50000).note = '50% consistency add-on: $144 (list $205, reset $135). Reset fee $109.' + tail;
  const note300 = select.plans.find((p) => p.size === 300000).note;
  const lines = [];
  const res = await runTradeify(data, { read: async () => PAGE_1122, now: RECORDED_1122, log: (l) => lines.push(l) });
  assert.equal(res.ok, true);
  assert.equal(
    select.plans.find((p) => p.size === 50000).note,
    '30% consistency option: $102 (list $145, reset $105). 50% consistency add-on: $151 (list $216, reset $152). Reset fee $119.' + tail,
  );
  assert.equal(select.plans.find((p) => p.size === 300000).note, note300);
  // Relue une 2e fois : plus rien à changer.
  const again = await runTradeify(data, { read: async () => PAGE_1122, now: RECORDED_1122, log: () => {} });
  assert.deepEqual(again.changes, []);
});

test('page du 19/11 (mode 50 % seul, aucun mode coché) : la note n\'est pas touchée', async () => {
  const data = structuredClone(DATA);
  const select = data.firms.find((f) => f.id === 'tradeify').programs.find((p) => p.name === 'Select');
  const before = select.plans.map((p) => p.note);
  await runTradeify(data, { read: async () => PAGE_1119, now: RECORDED_1119, log: () => {} });
  assert.deepEqual(select.plans.map((p) => p.note), before);
});

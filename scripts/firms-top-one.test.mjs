// Lecture de Top One Futures (toponefutures.com), sur la page enregistree le 2026-11-23 : ses deux
// scripts qui reecrivent Elite Access et ses quatre onglets de prix, tels quels. Pas de reseau, et
// jamais le JSON vivant que le bot reecrit chaque jour (CLAUDE.md) : le bloc du site est compare a
// sa copie figee du meme jour.
// Run: node --test scripts/firms-top-one.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { BROKEN, topOneRules } from './check-rule-drift.mjs';
import { readTopOne, topOneFirm, topOnePromo, topOneUpdates, topOnePageScript } from './lib/firms/topone.mjs';
import { apply, guard, scrapeTopOne } from './scrape-prop-firms.mjs';

const HTML = fs.readFileSync(new URL('./lib/firms/fixtures/topone-home-2026-11-23.html', import.meta.url), 'utf8');
const BLOCK = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/topone-firm-2026-11-23.json', import.meta.url), 'utf8'));
const URL_JTNQ = 'https://toponefutures.com/?linkId=lp_707970&sourceId=jtnq&tenantId=toponefutures';
const CARDS = readTopOne(HTML);

test('les 16 cartes du 2026-11-23 : prix du jour, prix barre, activation fee', () => {
  const table = CARDS.map((c) => [c.programName, c.size, c.price, c.originalPrice, c.activationFee]);
  assert.deepEqual(table, [
    ['Elite Daily', 25000, 80, 178, 0],
    ['Elite Daily', 50000, 98, 218, 0],
    ['Elite Daily', 100000, 179, 398, 0],
    ['Elite Daily', 150000, 247, 549, 0],
    ['Elite Access', 25000, 39, 139, 104],
    ['Elite Access', 50000, 39, 189, 142],
    ['Elite Access', 100000, 39, 259, 194],
    ['Elite Access', 150000, 39, 359, 269],
    ['Instant Sim Funded', 25000, 293, 419, null],
    ['Instant Sim Funded', 50000, 475, 679, null],
    ['Instant Sim Funded', 100000, 575, 821, null],
    ['Instant Sim Funded', 150000, 657, 939, null],
    ['Ignite', 25000, 87, 218, null],
    ['Ignite', 50000, 159, 398, null],
    ['Ignite', 100000, 225, 563, null],
    ['Ignite', 150000, 319, 799, null],
  ]);
});

test('Elite Access tel que le visiteur le voit : le script de la page applique', () => {
  assert.deepEqual(topOnePageScript(HTML), {
    pane: 'Elite Access', activationDiscount: 0.25, roundActivation: true, ddOld: 'EOD', ddStatic: 'Static',
    targets: {
      tab: 'Elite Access',
      bySize: {
        25000: { old: '$1,500', now: '$1,000' },
        50000: { old: '$3,000', now: '$2,000' },
        100000: { old: '$6,000', now: '$4,000' },
        150000: { old: '$9,000', now: '$6,000' },
      },
    },
  });
  const ea = CARDS.find((c) => c.programName === 'Elite Access' && c.size === 25000);
  assert.equal(ea.activationFeeOld, 139);
  assert.deepEqual(ea.faces.Eval['drawdown mode'], { label: 'Drawdown Mode', value: 'Static', old: 'EOD' });
  assert.equal(ea.faces.Funded['drawdown mode'].value, 'EOD'); // le HTML dit « Intraday » : l'autre position
  assert.deepEqual(ea.faces.Eval['profit target'], { label: 'Profit Target', value: '$1,000', old: '$1,500' });
  assert.deepEqual(ea.faces.Eval['max accounts'], { label: 'Max Accounts', value: '20', old: '10' });
  assert.equal(ea.faces.Funded.consistency.value, '40%');
  assert.equal(ea.faces.Eval['consistency on eval'].value, 'None!');
});

test('une valeur barree garde la nouvelle, l’ancienne reste lue', () => {
  const isf = CARDS.find((c) => c.programName === 'Instant Sim Funded' && c.size === 100000);
  assert.deepEqual(isf.faces.Funded['trailing max drawdown'], { label: 'Trailing max drawdown', value: '$4,000', old: '$3,000' });
  const daily = CARDS.find((c) => c.programName === 'Elite Daily' && c.size === 100000);
  assert.equal(daily.faces.Eval['max drawdown (eod)'].value, '$3,000');
  assert.equal(daily.faces.Funded['max drawdown (eod)'].value, '$2,500'); // funded plus serre que l'eval
});

test('sans le script de prix, la firme s’arrete au lieu de publier le HTML brut', () => {
  const noScript = HTML.replace(/var ACTIVATION_DISCOUNT\s*=\s*[^;]+;/, '');
  assert.throws(() => readTopOne(noScript), /script de prix/);
});

test('une page refusee par Cloudflare (sans onglets) arrete la firme', () => {
  const refused = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>' +
    HTML.slice(HTML.indexOf('<script'), HTML.indexOf('</script>') + 9) + '</body></html>';
  assert.throws(() => readTopOne(refused), /onglet de prix introuvable/);
});

test('une carte de moins arrete la firme', () => {
  const at = HTML.indexOf('v3-pricing-title">$150K Account');
  const cut = HTML.slice(0, HTML.lastIndexOf('<div', HTML.lastIndexOf('class="v3-pricing-slide"', at))) + HTML.slice(at);
  assert.throws(() => readTopOne(cut));
});

test('la promo est au code JTNQ, lue dans les pastilles de chaque onglet', () => {
  assert.deepEqual(topOnePromo(CARDS), {
    label: '55% off Elite Daily, Elite Access at $39, 30% off Instant Sim Funded, 60% off Ignite',
    code: 'JTNQ',
  });
});

test('le code public de la firme ne sort jamais du lecteur', () => {
  const out = JSON.stringify({ updates: topOneUpdates(CARDS), promo: topOnePromo(CARDS), firm: BLOCK, rules: topOneRules(CARDS) });
  assert.ok(HTML.includes('BLACKFRIDAY')); // les cartes le portent bien (« 55% OFF w. Code: »)
  assert.doesNotMatch(out, /BLACKFRIDAY|BOGO/i);
  assert.doesNotMatch(out, /"code":"(?!JTNQ")/);
  assert.doesNotMatch(out, /"promoCode"/);
});

test('le bloc du site est celui que le lecteur tire de la page', () => {
  assert.deepEqual(topOneFirm(HTML, { url: URL_JTNQ, checkedOn: '2026-11-23' }), BLOCK);
});

test('chaque compte du bloc est relu, et ses prix, activation fees et notes sont ceux du jour', async () => {
  const firm = structuredClone(BLOCK);
  const res = await scrapeTopOne(async () => CARDS);
  guard(firm, res);
  const changes = [];
  apply(firm, res, changes);
  assert.deepEqual(changes, []);
});

test('une activation fee qui revient au prix plein est ecrite, la note suit', async () => {
  const firm = structuredClone(BLOCK);
  const html = HTML.replace(/var ACTIVATION_DISCOUNT\s*=\s*0\.25;/, 'var ACTIVATION_DISCOUNT = 0;');
  const res = await scrapeTopOne(async () => readTopOne(html));
  const changes = [];
  apply(firm, res, changes);
  const ea = firm.programs.find((p) => p.name === 'Elite Access').plans[0];
  assert.equal(ea.activationFee, 139);
  assert.equal(ea.note, 'Reset fee $35. Profit Target $1,000 (was $1,500). Max 20 accounts (was 10).');
  assert.equal(changes.length, 8);
});

test('les regles relues par le controle de derive : aucune derive sur le bloc du jour', () => {
  const rules = topOneRules(CARDS);
  assert.equal(rules.length, 16);
  for (const { programName, size, rules: r } of rules) {
    const plan = BLOCK.programs.find((p) => p.name === programName).plans.find((p) => p.size === size);
    for (const [field, v] of Object.entries(r)) {
      assert.notEqual(v, BROKEN, `${programName} ${size} ${field}`);
      if (field === 'contracts') assert.deepEqual(v, { minis: parseInt(plan.contracts, 10), micros: Number(plan.contracts.match(/\((\d+)/)[1]) });
      else if (field === 'consistency') assert.equal(v, plan.consistency === 'None' ? null : plan.consistency);
      else assert.equal(v, plan[field], `${programName} ${size} ${field}`);
    }
  }
  const ea = rules.find((r) => r.programName === 'Elite Access').rules;
  assert.equal('maxDrawdown' in ea, false); // la carte montre le mode, pas le montant
  assert.equal('profitTarget' in rules.find((r) => r.programName === 'Ignite').rules, false);
});

test('une ligne de regle disparue est un lecteur casse, pas une regle absente', () => {
  const lost = HTML.replace('<div class="v3-table-row-info"><div>Consistency on Eval</div>', '<div class="v3-table-row-info"><div>Something else</div>');
  const r = topOneRules(readTopOne(lost)).find((x) => x.programName === 'Elite Daily' && x.size === 25000);
  assert.equal(r.rules.consistency, BROKEN);
});

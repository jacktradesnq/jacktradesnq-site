// Lecture de Top One Futures (toponefutures.com), sur la page enregistree le 2026-11-23 : ses deux
// scripts qui reecrivent Elite Access et ses quatre onglets de prix, tels quels. Pas de reseau, et
// jamais le JSON vivant que le bot reecrit chaque jour (CLAUDE.md) : le bloc du site est compare a
// sa copie figee du meme jour. Les onglets, tailles et lignes que la firme ajouterait ou retirerait
// sont faits sur une copie de cette page, en memoire.
// Run: node --test scripts/firms-top-one.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { BROKEN, topOneRules } from './check-rule-drift.mjs';
import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';
import {
  readTopOne, topOneCards, topOnePane, topOnePageScript, topOnePrograms, topOnePromo, topOneTabLabel,
} from './lib/firms/topone.mjs';
import { scrapeTopOne } from './scrape-prop-firms.mjs';

const HTML = fs.readFileSync(new URL('./lib/firms/fixtures/topone-home-2026-11-23.html', import.meta.url), 'utf8');
const BLOCK = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/topone-firm-2026-11-23.json', import.meta.url), 'utf8'));
const CARDS = readTopOne(HTML);

/** Le bloc du site apres la synchro quotidienne sur cette page : { firm, changes }. */
async function sync(html, firm = structuredClone(BLOCK)) {
  const res = await scrapeTopOne(async () => readTopOne(html));
  guardCatalog(firm, res.programs);
  const changes = [];
  syncCatalog(firm, res.programs, changes);
  return { firm, changes, res };
}
const planOf = (firm, name, size) => firm.programs.find((p) => p.name === name)?.plans.find((p) => p.size === size);
const card = (html, tab, i) => topOneCards(topOnePane(html, tab))[i].html;
/** Remplace un morceau qui doit etre unique dans la page. */
function swap(html, from, to) {
  assert.equal(html.split(from).length - 1, 1, `morceau non unique : ${from.slice(0, 80)}`);
  return html.replace(from, () => to);
}

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
  assert.deepEqual([...new Set(CARDS.map((c) => `${c.programName} ${c.type} ${c.priceType}`))], [
    'Elite Daily eval one-time', 'Elite Access eval one-time', 'Instant Sim Funded instant one-time', 'Ignite instant one-time',
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
  assert.throws(() => readTopOne(refused), /aucun onglet de prix/);
});

test('une carte dont l’ouverture n’est plus reconnue arrete la firme, au lieu de retirer sa taille', () => {
  const at = HTML.indexOf('v3-pricing-title">$150K Account');
  const cut = HTML.slice(0, HTML.lastIndexOf('<div', HTML.lastIndexOf('class="v3-pricing-slide"', at))) + HTML.slice(at);
  assert.throws(() => readTopOne(cut), /2 titres/);
});

test('la promo est au code JTNQ, lue dans les pastilles de chaque onglet', () => {
  assert.deepEqual(topOnePromo(CARDS), {
    label: '55% off Elite Daily, Elite Access at $39, 30% off Instant Sim Funded, 60% off Ignite',
    code: 'JTNQ',
  });
});

test('le code public de la firme ne sort jamais du lecteur', () => {
  const out = JSON.stringify({ programs: topOnePrograms(CARDS), promo: topOnePromo(CARDS), firm: BLOCK, rules: topOneRules(CARDS) });
  assert.ok(HTML.includes('BLACKFRIDAY')); // les cartes le portent bien (« 55% OFF w. Code: »)
  assert.doesNotMatch(out, /BLACKFRIDAY|BOGO/i);
  assert.doesNotMatch(out, /"code":"(?!JTNQ")/);
  assert.doesNotMatch(out, /"promoCode"/);
});

/* ---------------- le catalogue (chemin `programs`) ---------------- */

test('relu sur la page du jour, le bloc du site ne bouge pas, drawdown d’Elite Access compris', async () => {
  const { firm, changes, res } = await sync(HTML);
  assert.deepEqual(changes, []);
  assert.deepEqual(firm.programs, BLOCK.programs);
  assert.deepEqual(res.firmPromo, BLOCK.promo);
  // La carte Elite Access montre le mode de drawdown de l'evaluation, pas son montant : le lecteur ne
  // porte pas la cle, le montant de l'article d'aide reste celui du JSON.
  const ea = res.programs.find((p) => p.name === 'Elite Access');
  assert.ok(ea.plans.every((p) => !('maxDrawdown' in p)));
  assert.deepEqual(ea.plans.map((p) => planOf(firm, 'Elite Access', p.size).maxDrawdown), [1000, 2000, 3000, 4000]);
});

test('une activation fee qui revient au prix plein est ecrite, la note suit', async () => {
  const html = HTML.replace(/var ACTIVATION_DISCOUNT\s*=\s*0\.25;/, 'var ACTIVATION_DISCOUNT = 0;');
  const { firm, changes } = await sync(html);
  const ea = planOf(firm, 'Elite Access', 25000);
  assert.equal(ea.activationFee, 139);
  assert.equal(ea.note, 'Reset fee $35. Profit Target $1,000 (was $1,500). Max 20 accounts (was 10).');
  assert.equal(changes.length, 8);
});

test('un onglet que la firme ajoute devient un programme, ses regles lues sur ses cartes', async () => {
  // Le panneau Elite Daily recopie sous un autre onglet, et son bouton tel que la page les ecrit.
  const elite = topOnePane(HTML, 'Elite');
  const pane = elite.replace('data-w-tab="Elite" class="acc__content__pane v3-pricing-swiper w-tab-pane w--tab-active"',
    'data-w-tab="Elite Pro" class="acc__content__pane v3-pricing-swiper w-tab-pane"');
  const button = '<a data-w-tab="Elite Pro" class="v3-tab-btn w-inline-block w-tab-link"><div class="icon-embed u-xs-d-none w-embed">' +
    '<svg width="18" height="18"><path d="M1 1"/></svg></div><div>ELITE Pro</div><div class="absolute__tagg_wrapper-2">' +
    '<div class="v2-green-tag-2 lime"><div>55% OFF</div></div></div></a>';
  const html = swap(HTML, elite, button + elite + pane);
  assert.equal(topOneTabLabel(html, 'Elite Pro'), 'ELITE Pro');

  const { firm, changes } = await sync(html);
  assert.ok(changes.includes('Top One Futures: programme « ELITE Pro » ajoute (4 tailles)'), changes.join('\n'));
  const pro = firm.programs.find((p) => p.name === 'ELITE Pro');
  assert.equal(pro.type, 'eval');
  assert.equal(pro.priceType, 'one-time');
  assert.deepEqual(pro.plans[0], {
    size: 25000,
    price: 80,
    originalPrice: 178,
    profitTarget: 1500,
    maxDrawdown: 1000,
    ddType: 'EOD Trailing',
    dailyLoss: 500,
    consistency: '40%',
    contracts: '1 mini (10 micros)',
    activationFee: 0,
    note: 'Reset fee $75. Max 5 accounts (was 3).',
  });
  assert.equal(topOnePromo(readTopOne(html)).label, '55% off Elite Daily, 55% off ELITE Pro, Elite Access at $39, 30% off Instant Sim Funded, 60% off Ignite');
  // Les programmes deja publies n'ont pas bouge.
  for (const p of BLOCK.programs) assert.deepEqual(firm.programs.find((x) => x.name === p.name), p);
});

test('un onglet nouveau dont les cartes ne disent ni Evaluation ni Account arrete la firme', () => {
  const elite = topOnePane(HTML, 'Elite');
  const pane = elite.replace('data-w-tab="Elite"', 'data-w-tab="Mystery"').replaceAll('K Evaluation', 'K Challenge');
  assert.throws(() => readTopOne(swap(HTML, elite, elite + pane)), /Mystery: type de compte illisible/);
});

test('un compte instantane ajoute n’a pas de profit target, ses regles viennent de sa face Funded', async () => {
  const ignite = topOnePane(HTML, 'Ignite Instant Funding');
  const pane = ignite.replace('data-w-tab="Ignite Instant Funding"', 'data-w-tab="Ignite Max"');
  const { firm, changes } = await sync(swap(HTML, ignite, ignite + pane));
  assert.ok(changes.includes('Top One Futures: programme « Ignite Max » ajoute (4 tailles)')); // sans bouton : le data-w-tab
  const plan = planOf(firm, 'Ignite Max', 150000);
  assert.equal(firm.programs.find((p) => p.name === 'Ignite Max').type, 'instant');
  assert.deepEqual(plan, {
    size: 150000,
    price: 319,
    originalPrice: 799,
    profitTarget: null,
    maxDrawdown: 6000,
    ddType: 'EOD Trailing',
    dailyLoss: 3000,
    consistency: '15%',
    contracts: '7 minis (70 micros)',
    note: 'Trailing max drawdown $6,000 (was $4,500). Max 10 accounts (was 6). Copy Trade 10 Accounts.',
  });
});

test('une taille que la firme ajoute apparait ; une regle que sa carte n’ecrit pas reste absente', async () => {
  // Une carte $10K avant la $25K, dans Elite Daily et dans Elite Access.
  let html = HTML;
  for (const tab of ['Elite', 'Elite Access']) {
    const first = card(html, tab, 0);
    const extra = first.replace('v3-pricing-title">$25K Evaluation', 'v3-pricing-title">$10K Evaluation')
      .replace(/<div class="v3-price-current">[^<]*</, '<div class="v3-price-current">$29<');
    html = swap(html, first, extra + first);
  }
  const { firm, changes } = await sync(html);
  assert.ok(changes.includes('Top One Futures / Elite Daily $10K: plan ajoute'));
  assert.ok(changes.includes('Top One Futures / Elite Access $10K: plan ajoute'));
  assert.deepEqual(firm.programs.find((p) => p.name === 'Elite Daily').plans.map((p) => p.size), [10000, 25000, 50000, 100000, 150000]);
  assert.equal(planOf(firm, 'Elite Daily', 10000).maxDrawdown, 1000);
  const ea = planOf(firm, 'Elite Access', 10000);
  assert.equal(ea.price, 29);
  assert.equal(ea.ddType, 'Static');
  assert.equal('maxDrawdown' in ea, false); // la carte ne montre que le mode : jamais de montant devine
  assert.equal(ea.profitTarget, 1000); // le script ne reecrit que les tailles qu'il liste : ici la valeur du HTML
});

test('un onglet que la firme ne vend plus disparait du site', async () => {
  const at = HTML.indexOf('<div data-w-tab="Ignite Instant Funding"');
  const { firm, changes } = await sync(HTML.slice(0, at));
  assert.deepEqual(changes, ['Top One Futures / Ignite: programme retire']);
  assert.deepEqual(firm.programs.map((p) => p.name), ['Elite Daily', 'Elite Access', 'Instant Sim Funded']);
});

test('une taille que la firme ne vend plus disparait du site', async () => {
  const { firm, changes } = await sync(swap(HTML, card(HTML, 'Elite', 1), ''));
  assert.deepEqual(changes, ['Top One Futures / Elite Daily $50K: plan retire']);
  assert.deepEqual(firm.programs.find((p) => p.name === 'Elite Daily').plans.map((p) => p.size), [25000, 100000, 150000]);
});

test('une regle que la carte ne sait plus dire garde la valeur du JSON, jamais un null invente', async () => {
  const first = card(HTML, 'Elite', 0);
  const row = '<div class="v3-table-row-info"><div>Daily loss limit</div></div><div class="v3-table-row-value"><div>$500</div></div>';
  const html = swap(HTML, first, first.replace(row, row.replace('$500', 'Ask support')));
  const { firm, changes, res } = await sync(html);
  assert.equal('dailyLoss' in res.programs[0].plans[0], false);
  assert.equal(planOf(firm, 'Elite Daily', 25000).dailyLoss, 500);
  assert.deepEqual(changes, []);
});

test('un prix barre que la firme retire disparait ; une regle qui change est ecrite', async () => {
  const first = card(HTML, 'Ignite Instant Funding', 0);
  let html = swap(HTML, first, first.replace('<div class="v3-price-old">$218</div>', ''));
  const daily = card(html, 'Elite', 0);
  const row = '<div class="v3-table-row-info"><div>Daily loss limit</div></div><div class="v3-table-row-value"><div>$500</div></div>';
  html = swap(html, daily, daily.replace(row, row.replace('$500', '$600')));
  const { firm, changes } = await sync(html);
  assert.deepEqual(changes, [
    'Top One Futures / Elite Daily $25K: dailyLoss 500 -> 600',
    'Top One Futures / Ignite $25K: originalPrice 218 -> aucun',
  ]);
  assert.equal('originalPrice' in planOf(firm, 'Ignite', 25000), false);
});

test('une evaluation dont la carte n’a plus de ligne Activation Fee perd l’ancien montant', async () => {
  const first = card(HTML, 'Elite Access', 0);
  const row = '<div class="v3-table-row-info"><div>Activation Fee</div></div><div class="v3-table-row-value"><div>$139</div></div>';
  const { firm, changes } = await sync(swap(HTML, first, first.replace(row, '')));
  assert.deepEqual(changes, [
    'Top One Futures / Elite Access $25K: activationFee 104 -> null',
    'Top One Futures / Elite Access $25K: note "Reset fee $35. Activation fee $104 (was $139). Profit Target $1,000 (was $1,500). Max 20 accounts (was 10)." -> "Reset fee $35. Profit Target $1,000 (was $1,500). Max 20 accounts (was 10)."',
  ]);
  assert.equal(planOf(firm, 'Elite Access', 25000).activationFee, null);
  // Les comptes sans evaluation n'ont jamais eu la ligne : pas de cle ajoutee.
  assert.equal('activationFee' in planOf(firm, 'Ignite', 25000), false);
});

/* ---------------- le controle de derive ---------------- */

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

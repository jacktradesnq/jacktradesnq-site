import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  MFP_PERPS_SOURCE,
  mfpDiscounted,
  mfpJtnqPromo,
  mfpPageData,
  mfpPerpsFromPage,
  mfpPerpsFromSnapshot,
  readMfpPerps,
} from './lib/firms/perps-mfp.mjs';

// Leur page d'accueil lue le 28/11/2026 à 00:28 (Paris), pendant le Black Friday (fin
// 2026-11-28T08:59:59.999Z). Copie figée : ce test ne lit pas public/data/perps-firms.json.
const HTML = fs.readFileSync(new URL('./lib/firms/fixtures/perps-mfp-2026-11-28.html', import.meta.url), 'utf8');
const SNAP = { url: MFP_PERPS_SOURCE, fetchedAt: '2026-11-27T23:28:46.636Z', html: HTML };
const DAY = '2026-11-28';
const BF_END = Date.parse('2026-11-28T08:59:59.999Z');
const page = () => structuredClone(mfpPageData(HTML));
const tiersOf = (p) => p.queries['challengeTiers:listPublic'];

// Les notes du JSON du 12/10/2026 (pas sur leur page : reprises par previous).
const NOTE_DAILY = 'Daily payouts · 90% split option · the loss limit locks at your starting balance on the 1st payout';
const NOTE_ELITE =
  'Payouts on demand · boosted leverage, 40x on indices · the loss limit stays at -5% after the 1st payout · 3% DLL version: same rules plus a 3% daily loss limit, cheaper';
const PREVIOUS = {
  programs: [
    { name: 'Select', note: NOTE_DAILY },
    { name: 'Prime', note: NOTE_DAILY },
    { name: 'Signature', note: NOTE_DAILY },
    { name: 'Elite / Elite 3% DLL', note: NOTE_ELITE },
  ],
};

const EXPECTED = [
  {
    name: 'Select',
    steps: '1 step',
    split: '80%',
    profitTarget: '9%',
    maxDrawdown: '3%',
    ddType: 'Static',
    dailyLoss: '3%',
    note: NOTE_DAILY,
    plans: [
      { size: 10000, price: 40, promoPrice: 24 },
      { size: 25000, price: 100, promoPrice: 60 },
      { size: 50000, price: 190, promoPrice: 114 },
      { size: 100000, price: 360, promoPrice: 216 },
    ],
  },
  {
    name: 'Signature',
    steps: '1 step',
    split: '80%',
    profitTarget: '10%',
    maxDrawdown: '6%',
    ddType: 'Static',
    dailyLoss: '3%',
    note: NOTE_DAILY,
    plans: [
      { size: 10000, price: 87, promoPrice: 52 },
      { size: 25000, price: 209, promoPrice: 125 },
      { size: 50000, price: 419, promoPrice: 251 },
      { size: 100000, price: 839, promoPrice: 503 },
    ],
  },
  {
    name: 'Elite / Elite 3% DLL',
    steps: '1 step',
    split: '80%',
    profitTarget: '10%',
    maxDrawdown: '5%',
    ddType: 'Static',
    dailyLoss: 'None / 3%',
    note: NOTE_ELITE,
    plans: [
      { size: 5000, price: 99, promoPrice: 59, altPrice: 49, altPromoPrice: 29 },
      { size: 10000, price: 194, promoPrice: 116, altPrice: 95, altPromoPrice: 57 },
      { size: 25000, price: 482, promoPrice: 289, altPrice: 249, altPromoPrice: 149 },
      { size: 50000, price: 959, promoPrice: 575, altPrice: 495, altPromoPrice: 297 },
    ],
  },
];
const BF_PROMO = { code: 'JTNQ', discountPct: 40, endsAt: '2026-11-28T08:59:59.999Z', firstPurchase: true, lastChecked: DAY, thenPct: 35 };

test('la page du 28/11 : Select, Signature, Elite (deux versions), toutes les tailles, prix et règles ; Prime n\'y est plus', () => {
  const { programs, promo } = mfpPerpsFromSnapshot(SNAP, { checkedOn: DAY, previous: PREVIOUS });
  assert.deepEqual(programs, EXPECTED);
  assert.deepEqual(promo, BF_PROMO);
  assert.equal(programs.find((p) => p.name === 'Prime'), undefined); // salesEnded sur leur site
  assert.equal(programs.find((p) => p.name === 'Beta'), undefined); // listé, rien en vente
});

test('la page porte ses données et ses cartes rendues (Elite 3 % DLL, -40 %, « Save $N » vers la version sans DLL)', () => {
  const p = mfpPageData(HTML);
  assert.equal(p.steps, '1 step');
  assert.equal(new Date(p.renderedAt).toISOString(), '2026-11-27T23:28:46.525Z');
  assert.equal(tiersOf(p).length, 16);
  assert.deepEqual(p.cards, [
    { list: 49, price: 29, save: 30 },
    { list: 95, price: 57, save: 59 },
    { list: 249, price: 149, save: 140 },
    { list: 495, price: 297, save: 278 }, // 959 -40 % = 575, 575 - 297 = 278 (965 donnerait 282)
  ]);
});

test('sans previous : ni note ni rulesKey inventés ; avec previous, rulesKey repris par nom', () => {
  const bare = mfpPerpsFromSnapshot(SNAP, { checkedOn: DAY });
  for (const p of bare.programs) {
    assert.equal('note' in p, false, p.name);
    assert.equal('rulesKey' in p, false, p.name);
  }
  const withKey = mfpPerpsFromSnapshot(SNAP, { checkedOn: DAY, previous: [{ name: 'Select', rulesKey: 'Select', note: 'x' }] });
  assert.equal(withKey.programs[0].rulesKey, 'Select');
  assert.equal(withKey.programs[0].note, 'x');
  assert.deepEqual(Object.keys(withKey.programs[0]), ['name', 'rulesKey', 'steps', 'split', 'profitTarget', 'maxDrawdown', 'ddType', 'dailyLoss', 'note', 'plans']);
});

test('arrondi : centimes arrondis, puis dollar inférieur sur un prix catalogue rond (leur fonction)', () => {
  assert.equal(mfpDiscounted(190, 35), 123); // 123,50
  assert.equal(mfpDiscounted(595, 35), 386); // 386,75 (prix du JSON relus au checkout le 12/10)
  assert.equal(mfpDiscounted(89, 35), 57); // 57,85
  assert.equal(mfpDiscounted(87, 40), 52); // 52,20 (visuel du 27/11)
  assert.equal(mfpDiscounted(959, 40), 575);
  assert.equal(mfpDiscounted(40, 0), 40);
});

test('après la fin du Black Friday : JTNQ = le taux affilié publié (25 %), sans date de fin', () => {
  const p = page();
  assert.deepEqual(mfpJtnqPromo(p.queries, BF_END - 1, DAY), BF_PROMO);
  assert.deepEqual(mfpJtnqPromo(p.queries, BF_END, DAY), { code: 'JTNQ', discountPct: 25, endsAt: null, lastChecked: DAY });
});

test('taux affilié 30 % et 1er achat 35 % ailleurs sur le site : « 35% off your first purchase — 30% off every purchase after » (12/10)', () => {
  const p = page();
  p.queries['affiliateConfig:getPublicCustomerDiscountPercent'] = 30;
  p.queries['discountCodesRead:getStandingDiscountPromotion'].firstPurchaseDiscountPercent = 35;
  assert.deepEqual(mfpJtnqPromo(p.queries, BF_END, DAY), { code: 'JTNQ', discountPct: 35, endsAt: null, firstPurchase: true, lastChecked: DAY, thenPct: 30 });
});

test('aucune remise nulle part : promo null, promoPrice null', () => {
  const p = page();
  p.renderedAt = BF_END;
  p.queries['affiliateConfig:getPublicCustomerDiscountPercent'] = 0;
  p.queries['discountCodesRead:getStandingDiscountPromotion'] = { code: 'X', discountPercent: 0, endsAt: null, firstPurchaseDiscountPercent: null };
  p.queries['discountCodesRead:getHomepageDiscountOffer'] = null;
  p.cards = [{ list: null, price: 49, save: 50 }];
  const { programs, promo } = mfpPerpsFromPage(p, { checkedOn: DAY });
  assert.equal(promo, null);
  assert.deepEqual(programs[0].plans[0], { size: 10000, price: 40, promoPrice: null });
});

test('un programme qui entre (une version) apparaît sous leur nom, un programme retiré disparaît', () => {
  const p = page();
  const tiers = tiersOf(p);
  tiers.push({ ...tiers[0], key: 'beta-25K', modelKey: 'beta', planKey: 'beta-one-step', sizeKey: '25K', startingBalance: 25000, feeCents: 31000, profitTargetPct: 8, maxDrawdownPct: 5 });
  p.queries['challengeTiers:listPublic'] = tiers.filter((t) => t.modelKey !== 'signature');
  const { programs } = mfpPerpsFromPage(p, { checkedOn: DAY });
  assert.deepEqual(programs.map((x) => x.name), ['Select', 'Elite / Elite 3% DLL', 'Beta']);
  assert.deepEqual(programs[2], {
    name: 'Beta',
    steps: '1 step',
    split: '80%',
    profitTarget: '8%',
    maxDrawdown: '5%',
    ddType: 'Static',
    dailyLoss: '3%',
    plans: [{ size: 25000, price: 310, promoPrice: 186 }],
  });
});

test('readMfpPerps lit leur accueil et rend le HTML brut', async () => {
  const asked = [];
  const snap = await readMfpPerps({ fetchText: async (url) => (asked.push(url), HTML) });
  assert.deepEqual(asked, [MFP_PERPS_SOURCE]);
  assert.equal(snap.url, MFP_PERPS_SOURCE);
  assert.equal(snap.html, HTML);
  assert.deepEqual(mfpPerpsFromSnapshot(snap, { checkedOn: DAY, previous: PREVIOUS }).programs, EXPECTED);
});

const throwsIll = (fn, why) => assert.throws(fn, (e) => e instanceof Error && e.message.startsWith('MyFundedPerps illisible : ') && why.test(e.message));

test('page vide, blocage Cloudflare, données absentes : illisible', () => {
  throwsIll(() => mfpPerpsFromSnapshot({ html: '' }), /page vide/);
  throwsIll(() => mfpPerpsFromSnapshot(undefined), /page vide/);
  throwsIll(() => mfpPerpsFromSnapshot({ html: '<html><head><title>Attention Required! | Cloudflare</title></head></html>' }), /Cloudflare/);
  throwsIll(() => mfpPerpsFromSnapshot({ html: HTML.replaceAll('dehydratedData:', 'autreChose:') }), /dehydratedData/);
  throwsIll(() => mfpPerpsFromSnapshot({ html: HTML.replace('feeCents:4000,key:"select-10K"', 'feeCents:new Date(0),key:"select-10K"') }), /non lisibles/);
});

test('aucun plan, prix manquant, prix aberrant, compte sans taille : illisible', () => {
  let p = page();
  p.queries['challengeTiers:listPublic'] = [];
  throwsIll(() => mfpPerpsFromPage(p), /aucun plan/);
  p = page();
  delete p.queries['challengeTiers:listPublic'];
  throwsIll(() => mfpPerpsFromPage(p), /listPublic/);
  p = page();
  delete tiersOf(p)[0].feeCents;
  throwsIll(() => mfpPerpsFromPage(p), /select-10K sans prix/);
  p = page();
  tiersOf(p)[1].feeCents = 9_999_900;
  throwsIll(() => mfpPerpsFromPage(p), /select-25K : prix aberrant/);
  p = page();
  delete tiersOf(p)[2].startingBalance;
  throwsIll(() => mfpPerpsFromPage(p), /select-50K sans taille/);
  p = page();
  p.steps = null;
  throwsIll(() => mfpPerpsFromPage(p), /Step Challenges/);
});

test('les cartes rendues ne retombent plus sur les données : illisible (Elite 50K à 965, prix remisé changé, aucune carte)', () => {
  throwsIll(() => mfpPerpsFromSnapshot({ html: HTML.replace('feeCents:95900,key:"elite-50K"', 'feeCents:96500,key:"elite-50K"') }), /cartes rendues/);
  throwsIll(() => mfpPerpsFromSnapshot({ html: HTML.replace('Sale Price: $29 USD', 'Sale Price: $30 USD') }), /cartes rendues/);
  const p = page();
  p.cards = [];
  throwsIll(() => mfpPerpsFromPage(p), /aucune carte/);
});

test('ce que le JSON ne sait pas porter arrête la lecture : offre par programme, pastille active, variante inconnue, version manquante', () => {
  let p = page();
  const now = p.renderedAt;
  Object.assign(p.queries['discountCodesRead:getFlashSaleOffer'], { startsAt: now - 1000, expiresAt: now + 1000 });
  throwsIll(() => mfpPerpsFromPage(p), /getFlashSaleOffer active sans taux lisible/);
  p = page();
  p.queries['promotionsRead:getActivePromoSurfaces'].badges[1].expiresAt = now + 1000;
  throwsIll(() => mfpPerpsFromPage(p), /pastille de promo active \(elite-dll-flash/);
  p = page();
  tiersOf(p).filter((t) => t.key.startsWith('select-')).forEach((t, i) => i % 2 && (t.planKey = 'select-90'));
  throwsIll(() => mfpPerpsFromPage(p), /Select vendu en 2 versions.*à trancher/);
  p = page();
  p.queries['challengeTiers:listPublic'] = tiersOf(p).filter((t) => t.key !== 'elite-dll-25K');
  throwsIll(() => mfpPerpsFromPage(p), /Elite \$25K : une seule des deux versions/);
  p = page();
  tiersOf(p)[3].profitTargetPct = 8;
  throwsIll(() => mfpPerpsFromPage(p), /Select : règles différentes selon la taille \(select-100K\)/);
});

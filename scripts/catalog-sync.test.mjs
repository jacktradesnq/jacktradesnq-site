// Ce que syncCatalog() a le droit d'ecrire dans public/data/prop-firms.json,
// et ce que guardCatalog() refuse de laisser passer.
// Run: node --test scripts/catalog-sync.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';

/** Une firme publiee minimale : un programme, une taille, des regles curatees. */
const firmeJSON = () => ({
  name: 'FundedSeat',
  programs: [
    {
      name: 'Instant Funding',
      type: 'instant',
      priceType: 'one-time',
      plans: [
        {
          size: 50000,
          price: 300,
          originalPrice: 600,
          profitTarget: null,
          maxDrawdown: 2000,
          ddType: 'EOD Trailing',
          dailyLoss: 1500,
          dailyLossSoft: true,
          consistency: '15% biggest trade',
          contracts: '4 minis / 40 micros',
        },
      ],
    },
  ],
});

const plan = (firm, programName, size) =>
  firm.programs.find((p) => p.name === programName)?.plans.find((pl) => pl.size === size);

/* ---------------- creation ---------------- */

test('un programme que la firme vend et que le JSON ignore est cree', () => {
  const firm = firmeJSON();
  const changes = [];
  syncCatalog(
    firm,
    [
      { name: 'Instant Funding', type: 'instant', priceType: 'one-time', plans: [{ size: 50000, price: 300 }] },
      {
        name: 'Daily Ultra (35%)',
        type: 'eval',
        priceType: 'one-time',
        plans: [
          { size: 25000, price: 104.5, originalPrice: 190 },
          { size: 50000, price: 197.5, originalPrice: 360 },
        ],
      },
    ],
    changes,
  );

  const cree = firm.programs.find((p) => p.name === 'Daily Ultra (35%)');
  assert.equal(cree.type, 'eval');
  assert.equal(cree.priceType, 'one-time');
  assert.deepEqual(cree.plans.map((p) => p.size), [25000, 50000]);
  assert.equal(changes.some((c) => c === 'FundedSeat: programme « Daily Ultra (35%) » ajoute (2 tailles)'), true);
});

test('une taille nouvelle dans un programme deja publie est creee, et dite', () => {
  const firm = firmeJSON();
  const changes = [];
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [
          { size: 25000, price: 219.95, originalPrice: 400, maxDrawdown: 1000 },
          { size: 50000, price: 300 },
        ],
      },
    ],
    changes,
  );

  assert.equal(plan(firm, 'Instant Funding', 25000).price, 219.95);
  assert.equal(changes.includes('FundedSeat / Instant Funding $25K: plan ajoute'), true);
});

test('un plan cree ne porte que ce que le lecteur a dit, dans l ordre du dataset', () => {
  const firm = firmeJSON();
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [
          { size: 50000, price: 300 },
          { size: 100000, price: 494.95, originalPrice: 900, maxDrawdown: 3000, consistency: '20%' },
        ],
      },
    ],
    [],
  );

  assert.deepEqual(Object.keys(plan(firm, 'Instant Funding', 100000)), [
    'size',
    'price',
    'originalPrice',
    'maxDrawdown',
    'consistency',
  ]);
});

/* ---------------- regles curatees ---------------- */

test('une regle que le lecteur ne connait pas garde la valeur curatee a la main', () => {
  const firm = firmeJSON();
  const changes = [];
  // Leur API n'encode ni le profit target ni la consistency de l'Instant Funding.
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 329.95, originalPrice: 600, maxDrawdown: 2000, dailyLoss: 1500 }],
      },
    ],
    changes,
  );

  const p = plan(firm, 'Instant Funding', 50000);
  assert.equal(p.consistency, '15% biggest trade');
  assert.equal(p.dailyLossSoft, true);
  assert.equal(p.contracts, '4 minis / 40 micros');
  assert.equal(p.profitTarget, null);
  assert.equal(changes.some((c) => c.includes('consistency')), false);
});

test('le lecteur qui PORTE la cle gagne, meme pour dire null', () => {
  const firm = firmeJSON();
  const changes = [];
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 300, originalPrice: 600, consistency: '20%', dailyLoss: null }],
      },
    ],
    changes,
  );

  const p = plan(firm, 'Instant Funding', 50000);
  assert.equal(p.consistency, '20%');
  assert.equal(p.dailyLoss, null);
  assert.equal(changes.includes('FundedSeat / Instant Funding $50K: consistency "15% biggest trade" -> "20%"'), true);
  assert.equal(changes.includes('FundedSeat / Instant Funding $50K: dailyLoss 1500 -> null'), true);
});

test('prix et prix barre viennent toujours du lecteur, un barre disparu efface la cle', () => {
  const firm = firmeJSON();
  const changes = [];
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 329.95 }],
      },
    ],
    changes,
  );

  const p = plan(firm, 'Instant Funding', 50000);
  assert.equal(p.price, 329.95);
  assert.equal('originalPrice' in p, false);
  assert.equal(changes.includes('FundedSeat / Instant Funding $50K: price 300 -> 329.95'), true);
  assert.equal(changes.includes('FundedSeat / Instant Funding $50K: originalPrice 600 -> aucun'), true);
});

test('un meme nom actif a plusieurs prix garde ses variantes dans le JSON', () => {
  const firm = firmeJSON();
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [
          {
            size: 50000,
            price: 300,
            originalPrice: 600,
            priceAmbiguous: true,
            variants: [{ price: 300, originalPrice: 600, id: 1 }, { price: 450, originalPrice: 900, id: 2 }],
          },
        ],
      },
    ],
    [],
  );

  const p = plan(firm, 'Instant Funding', 50000);
  assert.equal(p.priceAmbiguous, true);
  assert.equal(p.variants.length, 2);
});

/* ---------------- suppression ---------------- */

test('un programme que la firme ne vend plus est retire, et dit', () => {
  const firm = firmeJSON();
  firm.programs.push({
    name: 'Flex',
    type: 'eval',
    priceType: 'one-time',
    plans: [{ size: 50000, price: 100, originalPrice: 200 }],
  });
  const changes = [];
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 300, originalPrice: 600 }],
      },
    ],
    changes,
  );

  assert.deepEqual(firm.programs.map((p) => p.name), ['Instant Funding']);
  assert.equal(changes.includes('FundedSeat / Flex: programme retire'), true);
});

test('une taille que la firme ne vend plus est retiree, et dite', () => {
  const firm = firmeJSON();
  firm.programs[0].plans.push({ size: 150000, price: 700, originalPrice: 1400 });
  const changes = [];
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 300, originalPrice: 600 }],
      },
    ],
    changes,
  );

  assert.deepEqual(firm.programs[0].plans.map((p) => p.size), [50000]);
  assert.equal(changes.includes('FundedSeat / Instant Funding $150K: plan retire'), true);
});

test('les champs de programme que le lecteur ne touche pas survivent', () => {
  const firm = firmeJSON();
  firm.programs[0].promoCode = 'SEP50';
  firm.programs[0].promoLabel = '50% OFF';
  syncCatalog(
    firm,
    [
      {
        name: 'Instant Funding',
        type: 'instant',
        priceType: 'one-time',
        plans: [{ size: 50000, price: 300, originalPrice: 600 }],
      },
    ],
    [],
  );

  assert.equal(firm.programs[0].promoCode, 'SEP50');
  assert.equal(firm.programs[0].promoLabel, '50% OFF');
});

/* ---------------- garde-fous ---------------- */

test('un lecteur muet ne vide pas le catalogue', () => {
  assert.throws(() => guardCatalog(firmeJSON(), []), /aucun programme/);
  assert.throws(() => guardCatalog(firmeJSON(), null), /aucun programme/);
});

test('une page partielle ne passe pas pour un catalogue qui a fondu', () => {
  const firm = firmeJSON();
  firm.programs[0].plans.push(
    { size: 25000, price: 200, originalPrice: 400 },
    { size: 100000, price: 450, originalPrice: 900 },
    { size: 150000, price: 700, originalPrice: 1400 },
  );
  const unSeul = [
    { name: 'Instant Funding', type: 'instant', priceType: 'one-time', plans: [{ size: 50000, price: 300 }] },
  ];
  assert.throws(() => guardCatalog(firm, unSeul), /page partielle/);

  // La moitie pile passe : c'est sous la moitie qui est refuse.
  const deux = [
    {
      name: 'Instant Funding',
      type: 'instant',
      priceType: 'one-time',
      plans: [{ size: 50000, price: 300 }, { size: 25000, price: 200 }],
    },
  ];
  assert.doesNotThrow(() => guardCatalog(firm, deux));
});

test('les garde-fous numeriques sont ceux du chemin historique', () => {
  const firm = firmeJSON();
  const avec = (plan) => [{ name: 'Instant Funding', type: 'instant', priceType: 'one-time', plans: [plan] }];

  assert.throws(() => guardCatalog(firm, avec({ size: 50000, price: 'gratuit' })), /non-numeric price/);
  assert.throws(() => guardCatalog(firm, avec({ size: 50000, price: 4 })), /out of range/);
  assert.throws(() => guardCatalog(firm, avec({ size: 50000, price: 9000 })), /out of range/);
  assert.throws(
    () => guardCatalog(firm, avec({ size: 50000, price: 300, originalPrice: 200 })),
    /price 300 > originalPrice 200/,
  );
  assert.throws(() => guardCatalog(firm, avec({ size: null, price: 300 })), /sans taille lisible/);
  assert.throws(
    () => guardCatalog(firm, [{ name: 'Instant Funding', type: 'instant', priceType: 'one-time', plans: [] }]),
    /aucun plan lu/,
  );
  assert.doesNotThrow(() => guardCatalog(firm, avec({ size: 50000, price: 300, originalPrice: 600 })));
});

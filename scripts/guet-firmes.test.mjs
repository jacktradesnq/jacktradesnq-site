import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  blocsOffres,
  blocsPages,
  differences,
  messages,
  pagesARelire,
  pagesDeLaNote,
  perteMax,
  rapport,
  reglesDuPlan,
  suivrePage,
  texteDePage,
  titreDePage,
  urlCanonique,
} from './lib/guet-firmes.mjs';

/* Données figées (formes des JSON du site au 26/11/2026), jamais public/data. */
const futures = (firms) => ({ 'public/data/compare-extra-firms.json': { firms } });
const lucid = (prixFlex25, promo = { label: '30% off with code VAULT', code: 'VAULT' }, extra = []) => ({
  id: 'lucid-trading',
  name: 'Lucid Trading',
  promo,
  code: 'VAULT',
  lastChecked: '2026-11-25',
  programs: [
    {
      name: 'LucidFlex',
      plans: [
        { size: 25000, price: prixFlex25, originalPrice: 76, maxDrawdown: 1000 },
        { size: 50000, price: 88.9, originalPrice: 127, maxDrawdown: 2000 },
        ...extra,
      ],
    },
  ],
});
const vest2Step = {
  'public/data/perps-firms.json': {
    firms: [
      {
        id: 'vest-markets',
        name: 'Vest Markets',
        promo: { code: 'JTNQ', discountPct: 5, endsAt: null, lastChecked: '2026-10-21' },
        programs: [
          { name: '2-Step', maxDrawdown: '6%', plans: [{ size: 5000, price: 15, promoPrice: 14.25, lines: [{ label: 'Max drawdown', value: '$300' }] }] },
        ],
      },
    ],
  },
};

test('rien de changé (seule la date de relecture bouge) = aucune alerte', () => {
  const avant = futures([lucid(53.2)]);
  const apres = futures([{ ...lucid(53.2), lastChecked: '2026-11-26' }]);
  assert.deepEqual(blocsOffres(differences(avant, apres)), []);
});

test('prix changé : avant → après, rapport perte max / prix payé', () => {
  const blocs = blocsOffres(differences(futures([lucid(53.2)]), futures([lucid(45.6)])));
  assert.equal(blocs.length, 1);
  assert.match(blocs[0], /^Lucid Trading\n- prix changé · LucidFlex 25K : prix 53,20 \$ → 45,60 \$ · perte max 1 000 \$ \/ prix 45,60 \$ = 21,9x$/);
});

test('nouveau plan, plan retiré, promo changée', () => {
  const avant = futures([lucid(53.2)]);
  const nouveau = { size: 100000, price: 150.5, originalPrice: 215, maxDrawdown: 3000 };
  const apres = futures([lucid(53.2, { label: '40% off with code VAULT', code: 'VAULT' }, [nouveau])]);
  apres['public/data/compare-extra-firms.json'].firms[0].programs[0].plans.splice(1, 1); // 50K retiré
  const [bloc] = blocsOffres(differences(avant, apres));
  assert.match(bloc, /- promo : « 30% off with code VAULT » → « 40% off with code VAULT »/);
  assert.match(bloc, /- nouveau plan · LucidFlex 100K : perte max 3 000 \$ \/ prix 150,50 \$ = 19,9x/);
  assert.match(bloc, /- plan retiré · LucidFlex 50K \(était à 88,90 \$\)/);
});

test('perps : perte max lue dans la ligne « Max drawdown », le « 20x » de Lil Fish (300 $ pour 14,25 $)', () => {
  const [bloc] = blocsOffres(differences({}, vest2Step));
  assert.match(bloc, /^Vest Markets \(perps\)/);
  assert.match(bloc, /- promo : aucune → -5 % avec le code JTNQ/);
  assert.match(bloc, /- nouveau plan · 2-Step 5K : perte max 300 \$ \/ prix 14,25 \$ = 21,1x/);
});

test('perte max perps : ligne en dollars, sinon % du programme x taille, sinon non calculable', () => {
  assert.equal(perteMax({ size: 500, lines: [{ label: 'Max drawdown', value: '$10 (2%)' }] }, {}, 'perps'), 10);
  assert.equal(perteMax({ size: 10000, lines: [{ label: 'Max drawdown', value: '$1,000' }] }, {}, 'perps'), 1000);
  assert.equal(perteMax({ size: 10000 }, { maxDrawdown: '6%' }, 'perps'), 600);
  assert.equal(perteMax({ size: 10000 }, { maxDrawdown: '2–4%' }, 'perps'), null);
  assert.equal(rapport({ perteMax: null, paye: 10 }), 'perte max absente des données : rapport non calculable');
});

test('firmes en ordre alphabétique, jamais rangées par rapport ni par prix', () => {
  const firme = (id, name, prix) => ({ id, name, promo: null, programs: [{ name: 'X', plans: [{ size: 25000, price: prix, maxDrawdown: 1000 }] }] });
  const avant = futures([firme('z', 'Zeta', 100), firme('a', 'alpha', 100), firme('m', 'Mu', 100)]);
  const apres = futures([firme('z', 'Zeta', 10), firme('a', 'alpha', 90), firme('m', 'Mu', 50)]);
  assert.deepEqual(blocsOffres(differences(avant, apres)).map((b) => b.split('\n')[0]), ['alpha', 'Mu', 'Zeta']);
});

test('fichiers de règles propsim du plan : même firme, même programme, même taille ; mention sans modification', () => {
  const regles = [
    { dossier: 'lucid', fichier: 'lucid_flex_25k_dll-on_40.json', nom: 'Lucid Flex 25K · DLL on · consistency 40 %', prix: 53.2 },
    { dossier: 'lucid', fichier: 'lucid_flex_50k_dll-on_40.json', nom: 'Lucid Flex 50K · DLL on · consistency 40 %', prix: 88.2 },
    { dossier: 'lucid', fichier: 'lucid_pro_25k_dll-on.json', nom: 'Lucid Pro 25K · DLL on', prix: 81.2 },
    { dossier: 'tradeify', fichier: 'tradeify_select_25k_cons-40_flex.json', nom: 'Tradeify Select 25K · éval 40 % · funded Flex', prix: 60 },
  ];
  const plan = { firmeId: 'lucid-trading', programme: 'LucidFlex', taille: 25000 };
  assert.deepEqual(reglesDuPlan(plan, regles).map((r) => r.fichier), ['lucid_flex_25k_dll-on_40.json']);
  assert.deepEqual(reglesDuPlan({ firmeId: 'tradeify', programme: 'Select', taille: 25000 }, regles).map((r) => r.fichier), ['tradeify_select_25k_cons-40_flex.json']);
  assert.deepEqual(reglesDuPlan({ firmeId: 'tradeify', programme: 'Select', taille: 125000 }, regles), []);
  assert.deepEqual(reglesDuPlan({ firmeId: 'top-one-futures', programme: 'Select', taille: 25000 }, regles), []);
  const [bloc] = blocsOffres(differences(futures([lucid(53.2)]), futures([lucid(45.6)])), regles);
  assert.match(bloc, /fichiers de règles propsim peut-être périmés \(non modifiés\) : lucid\/lucid_flex_25k_dll-on_40\.json \(prix du fichier 53,20 \$\)/);
});

/* Notes recopiées des fichiers de règles (26/11/2026), raccourcies. */
const NOTE_LUCID =
  'Règles lues le 20/11/2026 sur le support Lucid (https://support.lucidtrading.com/en/articles/12890029 éval, 12890069 funded, 12890136 drawdown) ; prix avec coupon lus sur dash.lucidtrading.com le 20/11/2026. Taille 25 100 $.';
const NOTE_FN =
  "règles lues le 26/11/2026 sur le centre d'aide officiel helpfutures.fundednext.com (articles 18568699 Rapid Pro, 17228899 prix ; textes sauvegardés). Automatisation : permise (article 14298560, vérifié le 26/11).";
const NOTE_APEX =
  "lues le 26/11/2026 sur le centre d'aide officiel apextraderfunding.com : evaluation-accounts-ea/intraday-trailing-drawdown-evaluations, intraday-trailing-drawdown-accounts/{intraday-trailing-drawdown-explained, intraday-trailing-drawdown-payouts}, additional-helpful-items/{50-consistency-requirement}";
const NOTE_VEST =
  "HYPOTHÈSE de travail : règles les plus récentes de docs.vestmarkets.com lues le 24/11/2026 (account-tiers « Updated November 23, 2026 », loss-limits, overview, claiming-profit). Éval 1-Step : 10 000 $ (loss-limits).";
const CAT_APEX = [
  'https://apextraderfunding.com/help-center/',
  'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/',
  'https://apextraderfunding.com/help-center/additional-helpful-items/50-consistency-requirement/',
  'https://apextraderfunding.com/help-center/evaluation-accounts-ea/intraday-trailing-drawdown-evaluations/',
  'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-explained/',
  'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-payouts/',
  'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-performance-accounts-pa/',
];

test('URL des pages tirées des notes des fichiers de règles, format de chaque firme', () => {
  assert.deepEqual(pagesDeLaNote('Lucid', NOTE_LUCID), [
    'https://support.lucidtrading.com/en/articles/12890029',
    'https://support.lucidtrading.com/en/articles/12890069',
    'https://support.lucidtrading.com/en/articles/12890136',
  ]);
  assert.deepEqual(pagesDeLaNote('FundedNext', NOTE_FN, { catalogueFundedNext: { 18568699: 'https://helpfutures.fundednext.com/en/articles/18568699-rapid-pro' } }), [
    'https://helpfutures.fundednext.com/en/articles/18568699',
    'https://helpfutures.fundednext.com/en/articles/17228899',
    'https://helpfutures.fundednext.com/en/articles/14298560',
  ]);
  assert.deepEqual(pagesDeLaNote('Apex', NOTE_APEX, { catalogueApex: CAT_APEX }).sort(), [
    'https://apextraderfunding.com/help-center/additional-helpful-items/50-consistency-requirement/',
    'https://apextraderfunding.com/help-center/evaluation-accounts-ea/intraday-trailing-drawdown-evaluations/',
    'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-explained/',
    'https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-payouts/',
  ]);
  assert.deepEqual(pagesDeLaNote('Vest', NOTE_VEST, { baseVest: 'https://docs.vestmarkets.com/vest-capital/' }), [
    'https://docs.vestmarkets.com/vest-capital/account-tiers',
    'https://docs.vestmarkets.com/vest-capital/loss-limits',
    'https://docs.vestmarkets.com/vest-capital/overview',
    'https://docs.vestmarkets.com/vest-capital/claiming-profit',
  ]);
  assert.equal(
    urlCanonique('https://help.tradeify.co/en/articles/12853966-select-flex-and-select-daily-payout-policies'),
    'https://help.tradeify.co/en/articles/12853966',
  );
});

test('une page citée par plusieurs fichiers : une seule lecture, tous les fichiers listés', () => {
  const regles = [
    { dossier: 'tradeify', fichier: 'a.json', note: 'voir https://help.tradeify.co/en/articles/10468320 et https://tradeify.co/' },
    { dossier: 'tradeify-paliers', fichier: 'b.json', note: 'voir https://help.tradeify.co/en/articles/10468320-consistency' },
    { dossier: 'racine-inconnue', fichier: 'TEMPLATE.json', note: 'https://example.com/' },
  ];
  const pages = pagesARelire(regles);
  assert.deepEqual([...pages.keys()].sort(), ['https://help.tradeify.co/en/articles/10468320', 'https://tradeify.co/']);
  assert.deepEqual([...pages.get('https://help.tradeify.co/en/articles/10468320').fichiers], ['tradeify/a.json', 'tradeify-paliers/b.json']);
});

test("texte d'une page : l'article, sans scripts ni dates relatives ; une date écrite reste", () => {
  const html = `<html><head><title>Loss Limits | Vest Markets</title><script>var x=1</script></head><body><nav>menu</nav><!--script>document.x()</script-->
    <article><h1>Loss Limits</h1><p>Max&nbsp;drawdown 6&#37; &amp; more</p><p>Updated November 23, 2026</p></article>
    <footer>Last updated 2 days ago</footer></body></html>`;
  assert.equal(texteDePage(html), 'Loss Limits Max drawdown 6% & more Updated November 23, 2026');
  assert.equal(titreDePage(html), 'Loss Limits');
  assert.equal(titreDePage('<title>50% Consistency Requirement - Apex Trader Funding</title><h1>Help Center</h1>'), '50% Consistency Requirement');
  assert.equal(titreDePage('<h1>Rules</h1>'), 'Rules');
  const gitbook = '<main><p>Rule A</p><p>Last updated 2 days ago</p> Updated over a week ago</main>';
  assert.equal(texteDePage(gitbook), 'Rule A');
  assert.equal(texteDePage('<main><p>Rule A</p><p>Last updated 3 hours ago</p></main>'), texteDePage(gitbook));
});

test('suivi d\'une page : départ silencieux, texte changé, échec sans alerte, disparue, revenue', () => {
  const q = '2026-11-27T08:00:00Z';
  let r = suivrePage(null, { statut: 200, texte: 'a', titre: 'P' }, 'h1', q);
  assert.equal(r.evenement, null);
  assert.equal(r.etat.empreinte, 'h1');
  const depart = r.etat;
  assert.equal(suivrePage(depart, { statut: 200, texte: 'a' }, 'h1', q).evenement, null);
  assert.equal(suivrePage(depart, { statut: 200, texte: 'b' }, 'h2', q).evenement, 'texte');
  r = suivrePage(depart, { statut: 403 }, null, q);
  assert.equal(r.evenement, null);
  assert.equal(r.etat.empreinte, 'h1');
  assert.equal(r.etat.echecs, 1);
  assert.equal(suivrePage(r.etat, { statut: 200, texte: 'a' }, 'h1', q).evenement, null);
  const partie = suivrePage(depart, { statut: 404 }, null, q);
  assert.equal(partie.evenement, 'disparue');
  assert.equal(suivrePage(partie.etat, { statut: 404 }, null, q).evenement, null);
  assert.equal(suivrePage(partie.etat, { statut: 200, texte: 'a' }, 'h1', q).evenement, 'revenue');
});

test('alerte des pages : firmes en ordre alphabétique, fichiers de règles mentionnés', () => {
  const blocs = blocsPages([
    { url: 'https://help.tradeify.co/en/articles/1', firme: 'Tradeify', evenement: 'texte', titre: 'Rules', fichiers: new Set(['tradeify/a.json']) },
    { url: 'https://support.lucidtrading.com/en/articles/2', firme: 'Lucid', evenement: 'disparue', statut: 404, titre: 'Payouts', fichiers: ['lucid/b.json'] },
  ]);
  assert.deepEqual(blocs, [
    'Lucid\n- page disparue (HTTP 404) · Payouts · https://support.lucidtrading.com/en/articles/2\n  fichiers de règles propsim peut-être périmés (non modifiés) : lucid/b.json',
    'Tradeify\n- texte changé · Rules · https://help.tradeify.co/en/articles/1\n  fichiers de règles propsim peut-être périmés (non modifiés) : tradeify/a.json',
  ]);
});

test('messages Discord : en-tête en tête, aucun message au-dessus de la limite', () => {
  const blocs = Array.from({ length: 12 }, (_, i) => `Firme ${i}\n` + '- ligne assez longue pour remplir\n'.repeat(8));
  const out = messages('Guet des firmes · 27/11/2026', blocs, 500);
  assert.ok(out.length > 1);
  assert.ok(out[0].startsWith('Guet des firmes · 27/11/2026\n\nFirme 0'));
  assert.ok(out.every((m) => m.length <= 500));
  assert.equal(out.join('\n').match(/^Firme \d+$/gm).length, 12);
  assert.deepEqual(messages('En-tête', []), []);
});

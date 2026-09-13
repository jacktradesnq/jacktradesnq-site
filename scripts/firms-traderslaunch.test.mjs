import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRADERSLAUNCH_URL,
  fetchTradersLaunchPrograms,
  programsFromHtml,
} from './lib/firms/traderslaunch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** La page d'accueil telle que telechargee le 2026-09-13 (175 394 octets, 6 cartes). */
const HTML = fs.readFileSync(
  path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-home-2026-09-13.html'),
  'utf8',
);
/** Le texte que le parseur voit vraiment, une fois les `<!-- -->` de React retires. */
const PAGE = HTML.replace(/<!-- -->/g, '');

const programs = programsFromHtml(HTML);
const programme = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => programme(name)?.plans.find((p) => p.size === size);

test('programsFromHtml : les DEUX programmes de la page, dans l ordre affiche', () => {
  assert.deepEqual(
    programs.map((p) => p.name),
    ['1-Step', 'Legacy NYC'],
    'le dataset du site ne connait que le 1-Step',
  );
});

test('programsFromHtml : trois tailles par programme, triees', () => {
  for (const p of programs) {
    assert.deepEqual(p.plans.map((x) => x.size), [100000, 200000, 300000], p.name);
  }
});

test('programsFromHtml : les prix exacts du 1-Step', () => {
  assert.equal(plan('1-Step', 100000).price, 159);
  assert.equal(plan('1-Step', 200000).price, 299);
  assert.equal(plan('1-Step', 300000).price, 599);
});

test('programsFromHtml : les prix exacts des Legacy NYC, que la tournee ne voyait pas', () => {
  assert.equal(plan('Legacy NYC', 100000).price, 99);
  assert.equal(plan('Legacy NYC', 200000).price, 149);
  assert.equal(plan('Legacy NYC', 300000).price, 279);
});

test('programsFromHtml : le JSON-LD de la page n est PAS la source des prix', () => {
  // Leur ItemList annonce encore 79 / 149 / 299 pour les 100K / 200K / 300K.
  // C'est une fiche SEO perimee : publier ces prix serait faux de 80 $ sur le
  // premier compte. Le test echoue si quelqu'un « simplifie » en lisant le JSON.
  assert.ok(PAGE.includes('"price":"79"'), 'la fiche SEO perimee doit toujours etre dans la fixture');
  assert.notEqual(plan('1-Step', 100000).price, 79);
  assert.notEqual(plan('1-Step', 300000).price, 299);
});

test('programsFromHtml : les regles lues sur les cartes', () => {
  const p = plan('1-Step', 200000);
  assert.equal(p.profitTarget, 4000);
  assert.equal(p.maxDrawdown, 2000);
  assert.equal(p.ddType, 'EOD - Locks at Starting Balance');
  assert.equal(p.contracts, '4 Mini or 40 Micros');

  // Les Legacy ne sont pas un 1-Step moins cher : leurs objectifs et leurs
  // tailles de depart sont differents.
  const l = plan('Legacy NYC', 200000);
  assert.equal(l.profitTarget, 3000);
  assert.equal(l.maxDrawdown, 1000);
  assert.equal(l.contracts, '1 Mini or 10 Micros');
  assert.equal(plan('Legacy NYC', 100000).contracts, '5 Micros');
});

test('programsFromHtml : Legacy NYC porte les horaires NYC dans sa note', () => {
  for (const p of programme('Legacy NYC').plans) {
    // Cette note s'affiche telle quelle sur le site, donc en anglais, et en
    // entier : c'est elle qui dit pourquoi ce compte est deux fois moins cher.
    assert.equal(
      p.note,
      'NYC trading hours: 9:30am–4:00pm ET. Legacy pricing and rules apply. ' +
        'Price shown for the 80% split.',
      JSON.stringify(p),
    );
  }
  // Le 1-Step n'a pas d'horaire restreint : on ne lui en colle pas un.
  for (const p of programme('1-Step').plans) {
    assert.doesNotMatch(p.note ?? '', /NYC trading hours/);
  }
});

test('programsFromHtml : le split qui qualifie le prix est dit, pas devine', () => {
  // Les deux sections ont un selecteur 55 % / 80 %. Les six liens portent
  // split=80 : un prix publie sans son split serait a moitie vrai.
  for (const p of programs) {
    for (const x of p.plans) assert.match(x.note, /Price shown for the 80% split\./, `${p.name} ${x.size}`);
  }
});

test('programsFromHtml : aucune regle inventee, aucune valeur nulle', () => {
  for (const p of programs) {
    for (const x of p.plans) {
      // La page ne parle jamais de perte journaliere : la cle est ABSENTE, elle
      // n'est pas a null. Un null explicite voudrait dire « pas de regle ».
      assert.ok(!('dailyLoss' in x), `dailyLoss invente sur ${p.name} ${x.size}`);
      assert.ok(!('dailyLossSoft' in x), `dailyLossSoft invente sur ${p.name} ${x.size}`);
      // « No Consistency Rules » est suivi de « Trade your way once funded » :
      // ca parle du compte finance, pas de l'evaluation (40 % au help center).
      assert.ok(!('consistency' in x), `consistency invente sur ${p.name} ${x.size}`);
      assert.ok(!('activationFee' in x), `activationFee invente sur ${p.name} ${x.size}`);
      // Aucun prix barre n'est affiche sur cette page.
      assert.ok(!('originalPrice' in x), `originalPrice invente sur ${p.name} ${x.size}`);

      for (const [k, v] of Object.entries(x)) {
        assert.notEqual(v, null, `${p.name} ${x.size} : ${k} est null`);
      }
    }
  }
  assert.ok(PAGE.includes('No Consistency Rules'), 'la banniere doit rester dans la fixture');
});

test('programsFromHtml : chaque texte publie se retrouve mot pour mot dans la page', () => {
  for (const p of programs) {
    for (const x of p.plans) {
      assert.ok(PAGE.includes(x.ddType), `ddType absent de la page : ${x.ddType}`);
      assert.ok(PAGE.includes(x.contracts), `contracts absent de la page : ${x.contracts}`);
    }
  }
});

test('programsFromHtml : la forme attendue par le reste de l outil', () => {
  for (const p of programs) {
    assert.equal(p.type, 'eval');
    assert.equal(p.priceType, 'one-time');
    assert.ok(Array.isArray(p.plans));
  }
});

test('programsFromHtml : une page sans prix se plaint au lieu d inventer', () => {
  const sansLibelle = HTML.replaceAll('One-time fee', 'Tarif');
  assert.throws(() => programsFromHtml(sansLibelle), /aucun prix/);

  const sansLien = HTML.replaceAll('purchasing-signup?', 'purchasing-signup#');
  assert.throws(() => programsFromHtml(sansLien), /aucune carte de prix futures/);

  assert.throws(() => programsFromHtml(''), /page vide/);
  assert.throws(() => programsFromHtml(null), /page vide/);
});

test('programsFromHtml : un titre qui contredit son lien arrete tout', () => {
  const faux = HTML.replace('Futures <!-- -->100K', 'Futures <!-- -->250K');
  assert.throws(() => programsFromHtml(faux), /ne parlent pas du meme compte/);
});

test('programsFromHtml : un capital affiche qui contredit son lien arrete tout', () => {
  const cible = '$100,000</p><p class="text-gray-400">Starting Capital';
  assert.ok(HTML.includes(cible), 'le gabarit de la carte a change');
  const faux = HTML.replace(cible, '$250,000</p><p class="text-gray-400">Starting Capital');
  assert.throws(() => programsFromHtml(faux), /ne parlent pas du meme compte/);
});

test('programsFromHtml : un split qui contredit la carte arrete tout', () => {
  const faux = HTML.replace('&amp;split=80', '&amp;split=55');
  assert.throws(() => programsFromHtml(faux), /le lien annonce un split de 55 %/);
});

test('programsFromHtml : un badge Legacy sans horaires restreintes arrete tout', () => {
  const faux = HTML.replace('&amp;hours=1', '&amp;hours=2');
  assert.throws(() => programsFromHtml(faux), /se contredisent sur le produit vendu/);
});

test('programsFromHtml : le compte crypto ne rentre pas dans la tournee futures', () => {
  for (const p of programs) {
    for (const x of p.plans) assert.ok(x.size >= 100000, `taille crypto publiee : ${x.size}`);
  }
});

test('fetchTradersLaunchPrograms : lit la page et rend les programmes', async () => {
  let vu = null;
  let entetes = null;
  const fetchImpl = async (url, opts) => {
    vu = url;
    entetes = opts?.headers;
    return { ok: true, text: async () => HTML };
  };
  const progs = await fetchTradersLaunchPrograms({ fetchImpl });
  assert.equal(vu, TRADERSLAUNCH_URL);
  assert.match(entetes['user-agent'], /Mozilla/);
  assert.equal(progs.length, 2);
  assert.equal(progs[1].plans[0].price, 99);
});

test('fetchTradersLaunchPrograms : une panne se dit clairement, elle ne se devine pas', async () => {
  await assert.rejects(
    fetchTradersLaunchPrograms({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    fetchTradersLaunchPrograms({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    }),
    /injoignable/,
  );
  await assert.rejects(
    fetchTradersLaunchPrograms({ fetchImpl: async () => ({ ok: true, text: async () => '<html></html>' }) }),
    /aucune carte de prix futures/,
  );
});

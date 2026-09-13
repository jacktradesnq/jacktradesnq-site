/**
 * Traders Launch, lu sur sa page d'accueil (Next.js rendu cote serveur).
 *
 * Pourquoi la page et pas le dataset du site : le dataset ne connait qu'UN
 * produit chez eux (« 1-Step », 3 tailles) alors que la page en vend deux. Les
 * comptes « Legacy NYC », deux fois moins chers et aux horaires restreints,
 * n'arrivaient jamais dans la tournee du matin (audit du 2026-09-13).
 *
 * Pourquoi PAS le JSON-LD de la page, qui serait pourtant plus simple a lire :
 * il ment. Son `ItemList` annonce $79 / $149 / $299 pour les comptes 100K /
 * 200K / 300K la ou les cartes affichees disent $159 / $299 / $599. C'est une
 * fiche SEO qui n'a pas suivi les prix, et publier $79 parce que c'etait du
 * JSON bien range aurait ete une erreur silencieuse. On lit donc ce que le
 * client voit : les cartes de prix rendues dans le HTML.
 *
 * L'ancre du parsing est le lien « Get Funded » de chaque carte :
 *
 *     /auth/purchasing-signup?type=futures&size=100000&split=80&hours=2
 *
 * C'est la seule partie machine de cette page, elle porte la taille, le split
 * et les horaires, et chaque carte en a exactement un, qui la clot. Le prix et
 * les regles se lisent dans la carte qui precede ce lien, et chaque fait lu est
 * RECOUPE avec lui : une carte dont le titre, le capital affiche et le lien ne
 * s'accordent pas sur la taille arrete tout, plutot que d'annoncer un prix de
 * 100K sur un compte 200K.
 *
 * Les deux programmes se distinguent dans ce meme lien : `hours=2` et aucun
 * badge = le 1-Step standard ; `hours=1` et le badge « Legacy NYC » = les
 * comptes NYC, 9:30-16:00 ET. Les deux temoins doivent dire la meme chose.
 *
 * Ce que la page NE dit PAS, et qu'on n'invente donc pas :
 *
 *  - LA PERTE JOURNALIERE. Aucune carte n'en parle. La cle est OMISE, elle
 *    n'est pas mise a `null` : ici `null` voudrait dire « pas de regle », et la
 *    page ne dit pas ca non plus. Une cle absente n'affirme rien.
 *
 *  - LA CONSISTENCY. La banniere « No Consistency Rules » est suivie, en toutes
 *    lettres, de « Trade your way once funded » : elle parle du compte FINANCE,
 *    pas de l'evaluation. Le help center, lui, annonce 40 % pendant l'eval et
 *    rien une fois finance — c'est knowledge/traders-launch.json qui le porte.
 *    Lire cette banniere comme « consistency : None » contredirait la vraie
 *    regle de l'evaluation, celle qui fait echouer un compte.
 *
 *  - LES FRAIS D'ACTIVATION. « No Additional Fees Once Funded » parle de
 *    l'apres-financement, pas d'un frais d'activation. Le knowledge le couvre.
 *
 * Reste le split, qui qualifie le PRIX et ne peut donc pas etre passe sous
 * silence : les deux sections ont un selecteur 55 % / 80 %, seul celui des
 * Legacy est rendu cote serveur (`aria-pressed="true"` sur 80 %), et les six
 * liens portent `split=80`. Les prix lus sont ceux du split 80 %, chaque plan
 * le dit dans son `note`, et le prix du split 55 % n'existe nulle part dans le
 * HTML : il n'est donc pas publie.
 */

export const TRADERSLAUNCH_URL = 'https://traderslaunch.com/';

/** La source citee dans l'en-tete Discord quand la tournee lit cette page. */
export const TRADERSLAUNCH_SOURCE = 'page traderslaunch.com';

/**
 * Le nom du produit principal. La page l'appelle « Futures 100K » sur la carte
 * et « one-step evaluation » dans sa description ; le dataset du site et
 * knowledge/traders-launch.json l'appellent « 1-Step ». On garde « 1-Step »
 * pour que `knowledgeFor()` continue de s'apparier — c'est lui qui apporte la
 * consistency de 40 % et le mode de drawdown que la page ne detaille pas.
 *
 * Le programme Legacy, lui, prend le nom AFFICHE sur ses cartes (« Legacy
 * NYC »), et surtout pas « 1-Step Legacy NYC » : ce nom-la s'apparierait
 * faussement a l'entree « 1-Step » du knowledge et lui collerait des regles
 * d'evaluation qui ne sont pas les siennes.
 */
const MAIN_PROGRAM = '1-Step';

/**
 * Un navigateur, par prudence. Node repond 200 sans (mesure le 2026-09-13,
 * meme page a l'octet pres), mais un front qui se met a filtrer les clients
 * sans en-tete couterait une tournee, et cet en-tete ne coute rien.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Le lien « Get Funded », avec ses parametres. Les liens nus (menu, CTA) n'ont pas de « ? ». */
const CARD_LINK = /purchasing-signup\?([^"'<>\s]+)/g;

/** Les seules entites que cette page met dans ses attributs et ses libelles. */
const decode = (s) =>
  String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');

/** « $1,000 » -> 1000. Toute autre forme -> null, jamais NaN. */
function money(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * La DERNIERE occurrence, pas la premiere.
 *
 * Une tranche de carte va de la fin du lien precedent a la fin du sien, donc
 * elle traine devant elle tout ce qui separe les deux cartes — et, pour la
 * premiere, tout le haut de la page. Ce qui appartient a la carte est toujours
 * ce qui touche son lien, c'est-a-dire la fin de la tranche. Prendre la
 * premiere occurrence faisait lire a la carte 100K un `<h3>` du haut de page,
 * et le recoupement des tailles ne verifiait plus rien (mesure le 2026-09-13).
 */
function lastMatch(text, re) {
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let last = null;
  for (const m of text.matchAll(rx)) last = m;
  return last;
}

/** Le premier groupe capture de la derniere occurrence, nettoye, ou null. */
function grab(text, re) {
  const m = lastMatch(text, re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

/** « Futures 100K » -> 100000. Le « K » est le seul multiplicateur de cette page. */
function sizeFromHeading(heading) {
  const m = String(heading ?? '').match(/([\d.]+)\s*K\b/i);
  return m ? Math.round(Number(m[1]) * 1000) : null;
}

/**
 * Une carte de prix : le texte qui precede son lien « Get Funded », plus les
 * parametres de ce lien.
 *
 * Les trois temoins de la taille (le titre, le capital affiche, le lien)
 * doivent s'accorder. Ils sont rendus par trois bouts de code differents chez
 * eux ; le jour ou ils divergent, leur page est cassee ou leur gabarit a
 * change, et dans les deux cas se taire vaut mieux qu'un prix mal attribue.
 */
function parseCard(slice, params) {
  const size = money(params.get('size'));
  const heading = grab(slice, /<h3[^>]*>([^<]+)<\/h3>/);
  const capital = money(grab(slice, /\$([\d,.]+)\s*<\/p>\s*<p[^>]*>\s*Starting Capital/));
  const price = money(grab(slice, /\$([\d,.]+)\s*<\/p>\s*<p[^>]*>\s*One-time fee/));

  if (size == null || size <= 0) {
    throw new Error(`un lien « Get Funded » sans taille lisible (size=${params.get('size')})`);
  }
  if (price == null) {
    throw new Error(
      `compte ${size} : aucun prix « One-time fee » dans sa carte, la mise en page a change`,
    );
  }

  const duTitre = sizeFromHeading(heading);
  for (const [quoi, vu] of [['son titre', duTitre], ['son capital affiche', capital]]) {
    if (vu != null && vu !== size) {
      throw new Error(
        `le lien du compte ${size} et ${quoi} (${vu}) ne parlent pas du meme compte : ` +
          'leur gabarit a change, le mapping doit etre relu avant de publier un prix',
      );
    }
  }

  // Le split vient du lien ; le libelle de la carte est le second temoin.
  const split = money(params.get('split'));
  const splitAffiche = money(grab(slice, />\s*([\d.]+)\s*%\s*Profit Split/));
  if (split != null && splitAffiche != null && split !== splitAffiche) {
    throw new Error(
      `compte ${size} : le lien annonce un split de ${split} % et la carte ${splitAffiche} %`,
    );
  }

  // Le badge est le nom affiche du produit Legacy ; `hours=1` dit la meme chose
  // cote machine. Un seul des deux = on ne sait plus quel produit on regarde.
  const badge = grab(slice, />\s*(Legacy NYC)\s*</i);
  const heuresRestreintes = params.get('hours') === '1';
  if (Boolean(badge) !== heuresRestreintes) {
    throw new Error(
      `compte ${size} : badge ${badge ? `« ${badge} »` : 'absent'} et hours=${params.get('hours')} ` +
        'se contredisent sur le produit vendu',
    );
  }

  const drawdown = lastMatch(slice, /Max Drawdown:\s*\$([\d,.]+)([^<]*)/);

  return {
    programme: badge || MAIN_PROGRAM,
    legacy: Boolean(badge),
    split,
    plan: {
      size,
      price,
      profitTarget: money(grab(slice, /Profit Target:\s*\$([\d,.]+)/)),
      maxDrawdown: drawdown ? money(drawdown[1]) : null,
      // La page ecrit « EOD - Locks at Starting Balance ». On garde SA
      // formulation : elle dit ou le plancher se bloque, ce que « EOD Trailing »
      // ne dit pas.
      ddType: drawdown ? drawdown[2].replace(/^[\s-]+/, '').replace(/\s+/g, ' ').trim() || null : null,
      contracts: grab(slice, /Starting Size:\s*([^<]+)/),
    },
  };
}

/**
 * Les programmes vendus sur la page, dans la forme du dataset.
 *
 * @param {string} html  le corps de https://traderslaunch.com/
 * @returns {Array<{name: string, type: 'eval', priceType: 'one-time', plans: object[]}>}
 * @throws  quand plus aucune carte de prix n'est lisible, ou quand deux
 *          lectures d'un meme fait se contredisent.
 */
export function programsFromHtml(html) {
  // React seme des `<!-- -->` au milieu de ses textes : « 80<!-- -->% Profit
  // Split », « Max Drawdown: <!-- -->$1,000<!-- --> EOD ». Les retirer une fois
  // ici evite de les porter dans chaque expression.
  const page = String(html ?? '').replace(/<!-- -->/g, '');
  if (!page.trim()) throw new Error('traderslaunch.com : page vide');

  const cartes = [];
  let debut = 0;
  for (const m of page.matchAll(CARD_LINK)) {
    const fin = m.index + m[0].length;
    const slice = page.slice(debut, fin);
    debut = fin;
    const params = new URLSearchParams(decode(m[1]));
    // Le compte crypto se vend sur /crypto, avec ses propres regles : il n'a
    // rien a faire dans la tournee futures.
    if (params.get('type') !== 'futures') continue;
    cartes.push(parseCard(slice, params));
  }

  if (!cartes.length) {
    throw new Error(
      'traderslaunch.com : aucune carte de prix futures sur la page ' +
        '(leur mise en page a change, on repart sur le dataset)',
    );
  }

  // Les horaires NYC sont ecrits une seule fois, dans l'encart Legacy, pas sur
  // chaque carte. On cite leur phrase telle quelle plutot que de la reecrire.
  const horaires = grab(page, />\s*(NYC trading hours:[^<]*)</);

  const programmes = new Map();
  for (const carte of cartes) {
    const p =
      programmes.get(carte.programme) ??
      { name: carte.programme, type: 'eval', priceType: 'one-time', plans: [] };

    // Une cle n'existe que si la page porte le fait.
    const plan = {};
    for (const [k, v] of Object.entries(carte.plan)) {
      if (v != null) plan[k] = v;
    }

    const note = [];
    if (carte.legacy && horaires) note.push(horaires);
    if (carte.split != null) note.push(`Prix du split ${carte.split} %.`);
    if (note.length) plan.note = note.join(' ');

    p.plans.push(plan);
    programmes.set(carte.programme, p);
  }

  return [...programmes.values()].map((p) => ({
    ...p,
    plans: p.plans.sort((a, b) => a.size - b.size),
  }));
}

/**
 * Telecharge et parse. Toute erreur est parlante : l'appelant (bin/matin.mjs)
 * la journalise et retombe sur le dataset du site, il ne l'avale pas.
 */
export async function fetchTradersLaunchPrograms({ fetchImpl = fetch, url = TRADERSLAUNCH_URL } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { 'user-agent': BROWSER_UA } });
  } catch (err) {
    throw new Error(`${url} injoignable : ${err.message}`);
  }
  if (!res?.ok) throw new Error(`${url} : HTTP ${res?.status ?? '?'}`);

  let html;
  try {
    html = await res.text();
  } catch (err) {
    throw new Error(`${url} : reponse illisible (${err.message})`);
  }

  return programsFromHtml(html);
}

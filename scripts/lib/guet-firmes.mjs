/**
 * Guet des firmes (point 18 de la liste d'Angelo, 26/11/2026 : « tout ce qu'il a et qu'on n'a pas faut les faire » ;
 * Lil Fish avait repéré l'offre Vest two-step à 14 $ pour 300 $ de perte max, « 20x drawdown », avant qu'elle
 * disparaisse en 3 jours). Fonctions pures, sans réseau ni disque : scripts/guet-firmes.mjs les appelle.
 *
 * Deux guets :
 *  1. Offres : deux versions des JSON que le site écrit (public/data/*.json, l'historique git = le relevé jour par
 *     jour) -> nouveau plan, plan retiré, prix changé, perte max changée, promo changée ; pour chaque plan nouveau,
 *     au prix changé ou à la perte max changée, le rapport perte max / prix payé, et les fichiers de règles propsim
 *     du même plan (peut-être périmés).
 *  2. Pages de règles : les URL citées par les fichiers de règles que le runner simule (Apex, FundedNext, Lucid,
 *     Tradeify, Vest) -> texte changé (extrait de la première zone), page disparue, page illisible 3 jours de suite.
 *     L'accueil tradeify.co n'est pas suivi. Le guet ne modifie JAMAIS un fichier de règles.
 *
 * L'alerte liste les changements firme par firme, ordre alphabétique, sans classement ni mise en avant (contrats
 * partenaires, Angelo 01/11/2026 et 11/10/2026).
 */

/* ------------------------------------------------------------------ */
/* Offres : à plat                                                     */
/* ------------------------------------------------------------------ */

/** Fichiers du site lus par le guet des offres. perps = prix « price » barré, « promoPrice » payé. */
export const FICHIERS_OFFRES = [
  { chemin: 'public/data/prop-firms.json', marche: 'futures' },
  { chemin: 'public/data/compare-extra-firms.json', marche: 'futures' },
  { chemin: 'public/data/perps-firms.json', marche: 'perps' },
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Premier montant en dollars d'un texte : « $1,000 » -> 1000, « $10 (2%) » -> 10. */
export function dollars(texte) {
  const m = String(texte ?? '').match(/\$\s*([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** Perte max d'un plan, en dollars, depuis les seules données du site (jamais devinée). */
export function perteMax(plan, programme, marche) {
  if (marche === 'futures') return num(plan.maxDrawdown);
  const ligne = (plan.lines || []).find((l) => /max(imum)?\.?\s*drawdown|max loss/i.test(l.label || ''));
  if (ligne) {
    const d = dollars(ligne.value);
    if (d != null) return d;
  }
  // « 6% » du programme x taille ; « 2–4% » ou « None » = non calculable
  const m = String(programme.maxDrawdown ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m && num(plan.size) ? (Number(m[1]) / 100) * plan.size : null;
}

/**
 * Tous les champs de prix d'un plan, à plat : { price: 53.2, 'splitPrices.60': 69.3, 'more[4% DLL].promoPrice': 57,
 * 'grid[10% / 6% / 80%].price': 90 }.
 */
export function champsPrix(plan) {
  const out = {};
  const visite = (obj, prefixe) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (k === 'more' && Array.isArray(v)) {
        v.forEach((x, i) => visite(x, `${prefixe}more[${x?.label ?? i}].`));
      } else if (k === 'altPrices' && Array.isArray(v)) {
        v.forEach((x, i) => visite(x, `${prefixe}altPrices[${i}].`));
      } else if (k === 'grid' && Array.isArray(v)) {
        // Plan à curseurs (Vest 1-Step depuis le 28/11/2026) : chaque combinaison, nommée par ses valeurs.
        for (const g of v) {
          const nom = Object.entries(g || {}).filter(([c]) => !/price/i.test(c)).map(([, x]) => `${x}%`).join(' / ');
          visite(Object.fromEntries(Object.entries(g || {}).filter(([c]) => /price/i.test(c))), `${prefixe}grid[${nom}].`);
        }
      } else if (k === 'splitPrices' && v && typeof v === 'object') {
        for (const [s, p] of Object.entries(v)) if (num(p) != null) out[`${prefixe}splitPrices.${s}`] = p;
      } else if (/price/i.test(k) && num(v) != null) {
        out[prefixe + k] = v;
      }
    }
  };
  visite(plan, '');
  return out;
}

/** Prix payé (avec le code) : futures « price », perps « promoPrice » à défaut « price ». */
export function prixPaye(plan, marche) {
  if (marche === 'perps') return num(plan.promoPrice) ?? num(plan.price);
  return num(plan.price);
}

/** Promo d'une firme, comparable : sans les dates de relecture. */
export function promoFirme(firme) {
  const p = firme.promo && typeof firme.promo === 'object' ? { ...firme.promo } : firme.promo ?? null;
  if (p && typeof p === 'object') delete p.lastChecked;
  const out = { promo: p };
  if (firme.code !== undefined) out.code = firme.code;
  if (firme.codeDiscountPct !== undefined) out.codeDiscountPct = firme.codeDiscountPct;
  return out;
}

/**
 * { firmes: Map<cléFirme, {nom, marche, promo}>, plans: Map<clé, plan à plat> } depuis { chemin: json }.
 * Clé firme = marché + id (E8 Markets existe en futures et en perps).
 */
export function aPlat(donneesParFichier) {
  const firmes = new Map();
  const plans = new Map();
  for (const { chemin, marche } of FICHIERS_OFFRES) {
    const d = donneesParFichier[chemin];
    if (!d || !Array.isArray(d.firms)) continue;
    for (const f of d.firms) {
      const cf = `${marche}|${f.id}`;
      firmes.set(cf, { id: f.id, nom: f.name, marche, promo: promoFirme(f) });
      for (const prog of f.programs || []) {
        for (const plan of prog.plans || []) {
          let cle = `${cf}|${prog.name}|${plan.size}`;
          for (let i = 2; plans.has(cle); i++) cle = `${cf}|${prog.name}|${plan.size}#${i}`;
          plans.set(cle, {
            cleFirme: cf,
            firmeId: f.id,
            programme: prog.name,
            taille: plan.size,
            marche,
            prix: champsPrix(plan),
            paye: prixPaye(plan, marche),
            perteMax: perteMax(plan, prog, marche),
          });
        }
      }
    }
  }
  return { firmes, plans };
}

/* ------------------------------------------------------------------ */
/* Offres : différences                                                */
/* ------------------------------------------------------------------ */

const memeJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Changements entre deux versions, par firme :
 * Map<cléFirme, { nom, marche, firmeId, promo?: {avant, apres}, nouveaux: [], retires: [], prix: [], pertes: [] }>.
 */
export function differences(avant, apres) {
  const A = aPlat(avant);
  const B = aPlat(apres);
  const parFirme = new Map();
  const firme = (cf) => {
    if (!parFirme.has(cf)) {
      const f = B.firmes.get(cf) || A.firmes.get(cf);
      parFirme.set(cf, { nom: f.nom, marche: f.marche, firmeId: f.id, promo: null, nouveaux: [], retires: [], prix: [], pertes: [] });
    }
    return parFirme.get(cf);
  };
  for (const [cf, fb] of B.firmes) {
    const fa = A.firmes.get(cf);
    if (fa && !memeJson(fa.promo, fb.promo)) firme(cf).promo = { avant: fa.promo, apres: fb.promo };
    if (!fa && fb.promo?.promo) firme(cf).promo = { avant: null, apres: fb.promo };
  }
  for (const [cle, pb] of B.plans) {
    const pa = A.plans.get(cle);
    if (!pa) firme(pb.cleFirme).nouveaux.push(pb);
    else {
      if (!memeJson(pa.prix, pb.prix)) firme(pb.cleFirme).prix.push({ avant: pa, apres: pb });
      if (pa.perteMax !== pb.perteMax) firme(pb.cleFirme).pertes.push({ avant: pa, apres: pb });
    }
  }
  for (const [cle, pa] of A.plans) if (!B.plans.has(cle)) firme(pa.cleFirme).retires.push(pa);
  return parFirme;
}

/* ------------------------------------------------------------------ */
/* Fichiers de règles propsim d'un plan                                */
/* ------------------------------------------------------------------ */

/** Mots d'un nom : « LucidFlex 25K · DLL on » -> lucid, flex, 25k, dll, on. */
export function mots(texte) {
  return String(texte ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Dossiers de règles propsim par firme du site (même firme, mêmes plans). */
export const REGLES_PAR_FIRME = {
  'lucid-trading': ['lucid'],
  tradeify: ['tradeify', 'tradeify-paliers'],
  'vest-markets': ['vest'],
};

/**
 * Fichiers de règles du même plan : même firme, tous les mots du programme et la taille (« 25k ») dans le « name »
 * du fichier. regles = [{ dossier, fichier, nom, prix }].
 */
export function reglesDuPlan(plan, regles) {
  const dossiers = REGLES_PAR_FIRME[plan.firmeId];
  if (!dossiers || !num(plan.taille)) return [];
  const motsProg = mots(plan.programme);
  const taille = plan.taille % 1000 === 0 ? `${plan.taille / 1000}k` : String(plan.taille);
  return regles.filter((r) => {
    if (!dossiers.includes(r.dossier)) return false;
    const m = new Set(mots(r.nom));
    return m.has(taille) && motsProg.every((w) => m.has(w));
  });
}

/* ------------------------------------------------------------------ */
/* Pages de règles : URL tirées des fichiers de règles                 */
/* ------------------------------------------------------------------ */

/** Article Intercom sans son slug : /en/articles/12853966-select-flex… -> /en/articles/12853966. */
export function urlCanonique(url) {
  const u = String(url).replace(/[.,;:»)]+$/, '');
  const m = u.match(/^https?:\/\/([^/]+)\/(?:[a-z]{2}\/)?articles\/(\d+)/i);
  if (m) return `https://${m[1].toLowerCase()}/en/articles/${m[2]}`;
  return u;
}

/** URL complètes d'un texte (http/https), canoniques. */
export function urlsCompletes(texte) {
  return [...new Set((String(texte).match(/https?:\/\/[^\s"'(),;«»]+/g) || []).map(urlCanonique))];
}

/**
 * Articles Intercom d'un centre d'aide cité par la note : chaque nombre de 8 chiffres qui suit la mention de l'hôte
 * (« https://support.lucidtrading.com/en/articles/12890029 éval, 12890069 funded » ; « helpfutures.fundednext.com
 * (articles 18568699 Rapid Pro, 17228899 prix »). catalogue = { id: url complète } quand on l'a (FundedNext).
 */
export function articlesIntercom(texte, hote, catalogue = {}) {
  const t = String(texte);
  const i = t.indexOf(hote);
  if (i < 0) return [];
  const ids = [...new Set(t.slice(i).match(/\b\d{8}\b/g) || [])];
  return ids.map((id) => catalogue[id] || `https://${hote}/en/articles/${id}`);
}

/**
 * Pages d'un catalogue d'URL (Apex : help_urls.txt) dont le dernier segment est cité tel quel par la note, sans
 * « / » derrière (« intraday-trailing-drawdown-accounts/{…} » est une rubrique, pas une page lue).
 */
export function pagesDuCatalogue(texte, urls) {
  const t = String(texte);
  const out = [];
  for (const u of urls) {
    const seg = u.replace(/\/+$/, '').split('/').pop();
    if (!seg || seg.length < 8) continue;
    const re = new RegExp(`(^|[^a-z0-9-])${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9-]|\\s*/)`, 'i');
    if (re.test(t)) out.push(u);
  }
  return [...new Set(out)];
}

/**
 * Pages GitBook citées par nom (Vest : « docs.vestmarkets.com lues le 24/11/2026 (account-tiers « Updated … »,
 * loss-limits, overview, claiming-profit) ») : la parenthèse qui suit l'hôte, un nom par virgule, ajouté à la base
 * tirée du plan (« docs.vestmarkets.com/vest-capital/overview » -> https://docs.vestmarkets.com/vest-capital/).
 */
export function pagesParNom(texte, hote, base) {
  const t = String(texte);
  const i = t.indexOf(hote);
  if (i < 0 || !base) return [];
  const ouv = t.indexOf('(', i);
  if (ouv < 0) return [];
  let prof = 0;
  let fin = -1;
  for (let j = ouv; j < t.length; j++) {
    if (t[j] === '(') prof++;
    else if (t[j] === ')' && --prof === 0) {
      fin = j;
      break;
    }
  }
  if (fin < 0) return [];
  const noms = t
    .slice(ouv + 1, fin)
    .split(',')
    .map((x) => (x.trim().match(/^[a-z][a-z0-9-]*/) || [null])[0])
    .filter(Boolean);
  return [...new Set(noms)].map((n) => base + n);
}

/** Base des pages Vest Capital tirée d'un texte (le PLAN du banc BTC) : « docs.vestmarkets.com/vest-capital/… ». */
export function baseVest(texte) {
  const m = String(texte).match(/(?:https?:\/\/)?(docs\.vestmarkets\.com\/vest-capital\/)/);
  return m ? `https://${m[1]}` : null;
}

/**
 * Comment chaque firme cite ses pages dans les notes de ses fichiers de règles (formats relevés le 26/11/2026).
 * sources = { catalogueFundedNext: {id: url}, catalogueApex: [url], baseVest: url }
 */
export function pagesDeLaNote(firme, note, sources = {}) {
  switch (firme) {
    case 'Apex':
      return pagesDuCatalogue(note, sources.catalogueApex || []);
    case 'FundedNext':
      return articlesIntercom(note, 'helpfutures.fundednext.com', sources.catalogueFundedNext || {}).map(urlCanonique);
    case 'Lucid':
      return [...new Set([...urlsCompletes(note), ...articlesIntercom(note, 'support.lucidtrading.com')].map(urlCanonique))];
    case 'Tradeify':
      return [...new Set([...urlsCompletes(note), ...articlesIntercom(note, 'help.tradeify.co')].map(urlCanonique))];
    case 'Vest':
      return pagesParNom(note, 'docs.vestmarkets.com', sources.baseVest);
    default:
      return urlsCompletes(note);
  }
}

/** Firme d'un dossier de règles propsim. */
export const FIRME_DU_DOSSIER = {
  apex: 'Apex',
  fundednext: 'FundedNext',
  lucid: 'Lucid',
  tradeify: 'Tradeify',
  'tradeify-paliers': 'Tradeify',
  vest: 'Vest',
};

/**
 * Accueil https://tradeify.co, avec ou sans www et avec ou sans / final : la page bouge avec les bannières de promo,
 * ce n'est pas une page de règles (27/11/2026). Les articles help.tradeify.co restent.
 */
function estAccueilTradeify(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const hote = u.hostname.toLowerCase();
  if (hote !== 'tradeify.co' && hote !== 'www.tradeify.co') return false;
  return u.pathname.replace(/\/+$/, '') === '';
}

/**
 * Map<url, { firme, fichiers: Set<"dossier/fichier"> }> depuis regles = [{ dossier, fichier, note }].
 * Seules les firmes de FIRME_DU_DOSSIER comptent (les modèles TEMPLATE / EXEMPLE sont à la racine, sans dossier).
 */
export function pagesARelire(regles, sources = {}) {
  const pages = new Map();
  for (const r of regles) {
    const firme = FIRME_DU_DOSSIER[r.dossier];
    if (!firme) continue;
    for (const url of pagesDeLaNote(firme, r.note || '', sources)) {
      if (estAccueilTradeify(url)) continue;
      if (!pages.has(url)) pages.set(url, { firme, fichiers: new Set() });
      pages.get(url).fichiers.add(`${r.dossier}/${r.fichier}`);
    }
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* Pages de règles : texte comparable                                  */
/* ------------------------------------------------------------------ */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };

/** Intérieur de la première balise <tag>…</tag> (jusqu'à la dernière fermeture : une seule par page). null si absente. */
function blocBalise(html, tag) {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}\\s*>`, 'i'));
  return m ? m[1] : null;
}

/** Élément équilibré dont la balise ouvrante commence à index. */
function elementEquilibre(html, index) {
  const m = /^<([a-zA-Z][\w:-]*)\b[^>]*>/.exec(html.slice(index));
  if (!m) return null;
  const tag = m[1];
  const ouverture = m[0].length;
  if (/\/>$/.test(m[0])) return { inner: '', end: index + ouverture };
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi');
  re.lastIndex = index + ouverture;
  let profondeur = 1;
  let mm;
  while ((mm = re.exec(html))) {
    if (mm[0][1] === '/') {
      profondeur--;
      if (profondeur === 0) return { inner: html.slice(index + ouverture, mm.index), end: mm.index + mm[0].length };
    } else profondeur++;
  }
  return { inner: html.slice(index + ouverture), end: html.length };
}

/** Retire chaque élément dont la balise ouvrante satisfait le prédicat (enfants compris). */
function retirerOuverts(html, predicat) {
  let out = '';
  let i = 0;
  const re = /<([a-zA-Z][\w:-]*)\b[^>]*>/g;
  while (i < html.length) {
    re.lastIndex = i;
    const m = re.exec(html);
    if (!m) {
      out += html.slice(i);
      break;
    }
    if (!predicat(m[1], m[0])) {
      out += html.slice(i, m.index + m[0].length);
      i = m.index + m[0].length;
      continue;
    }
    out += html.slice(i, m.index);
    const el = elementEquilibre(html, m.index);
    i = el ? el.end : m.index + m[0].length;
  }
  return out;
}

/** gitbook (docs.vestmarkets.com), intercom (centres d'aide), ou le reste. */
function typeDePage(html) {
  const h = String(html);
  if (/id=["']gitbook-main-content["']|gb-icon|powered by gitbook/i.test(h)) return 'gitbook';
  if (/intercom-force-break|intercom-interblocks|related_articles|intercom-reaction/i.test(h)) return 'intercom';
  return 'autre';
}

/** Conteneur Intercom `<div class="article …">` quand la balise <article> est vide ou absente. */
function conteneurArticle(html) {
  const m = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\barticle\b[^"']*["'][^>]*>/i.exec(html);
  if (!m) return null;
  return elementEquilibre(html, m.index)?.inner ?? null;
}

function texteNu(fragment) {
  return String(fragment).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Intercom : sans Related articles, fil d'Ariane, en-tête, pied. */
function nettoyerIntercom(html) {
  const h = retirerOuverts(html, (tag, open) => {
    const t = tag.toLowerCase();
    if (t === 'header' || t === 'footer') return true;
    if (t === 'nav' && /breadcrumb/i.test(open)) return true;
    if (/\bbreadcrumb\b/i.test(open) || /related[_-]articles/i.test(open)) return true;
    return false;
  });
  return h.replace(/<(section|div|aside|h[1-6])\b[^>]*>\s*Related\s+Articles\s*<\/\1>[\s\S]*$/i, ' ');
}

/** GitBook : le <main>, sans les boutons (Copy) ni la navigation (On this page, menu). */
function nettoyerGitbook(html) {
  return retirerOuverts(html, (tag, open) => {
    const t = tag.toLowerCase();
    if (t === 'button' || t === 'nav') return true;
    if (/aria-label\s*=\s*["']On this page["']/i.test(open)) return true;
    if (/\btable-of-contents\b|\btoclink\b/i.test(open)) return true;
    return false;
  });
}

/**
 * Texte lisible d'une page : seulement le corps de l'article.
 *  - Intercom : la balise <article>, ou le conteneur `div.article` s'il est vide, sans « Related articles »,
 *    fil d'Ariane, en-tête ni pied.
 *  - GitBook : le <main>, sans la navigation « On this page », le menu, ni les boutons.
 *  - Autres sites : <article> s'il est présent, sinon <main>, sinon <body>.
 * Scripts, styles et dates relatives (« Last updated 2 days ago ») sont retirés. Une date écrite
 * (« Updated November 23, 2026 ») reste.
 */
export function texteDePage(html) {
  const brut = String(html);
  const type = typeDePage(brut);
  let h = brut
    .replace(/<!--[\s\S]*?-->/g, ' ') // commentaires (tradeify.co y range un vieux <script>)
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  let partie;
  if (type === 'gitbook') {
    partie = nettoyerGitbook(blocBalise(h, 'main') ?? blocBalise(h, 'body') ?? h);
  } else if (type === 'intercom') {
    const article = blocBalise(h, 'article');
    const region = article != null && texteNu(article) ? article : (conteneurArticle(h) ?? blocBalise(h, 'main') ?? blocBalise(h, 'body') ?? h);
    partie = nettoyerIntercom(region);
  } else {
    partie = blocBalise(h, 'article') ?? blocBalise(h, 'main') ?? blocBalise(h, 'body') ?? h;
  }
  return partie
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tout, e) => {
      if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : tout;
      }
      return ENTITES[e.toLowerCase()] ?? tout;
    })
    .replace(/\b(?:Last\s+)?updated\s+(?:over\s+|about\s+|almost\s+|more\s+than\s+)?(?:an?|\d+|a\s+few)\s+(?:second|minute|hour|day|week|month|year)s?\s+ago\b/gi, ' ')
    .replace(/\b(?:Last\s+)?updated\s+(?:today|yesterday|just\s+now)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Titre d'une page pour l'alerte : <title> sans le nom du site (« LucidPro Payouts | Lucid Trading Help Center »,
 *  « 50% Consistency Requirement - Apex Trader Funding »), à défaut le 1er <h1> (celui d'Apex dit « Help Center »). */
export function titreDePage(html) {
  const h = String(html);
  const sans = (s) => texteDePage(`<body>${s}</body>`);
  const t = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titre = t && sans(t[1]).replace(/\s+[|–-]\s+[^|–-]+$/, '').trim();
  if (titre) return titre;
  const h1 = h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return (h1 && sans(h1[1])) || null;
}

const ECHECS_PAGE_ILLISIBLE = 3;

/** Part de la référence en dessous de laquelle la page est illisible (lecture tronquée), pas un vrai changement. */
const PART_MIN_TEXTE = 0.4;

/**
 * Lecture assez bonne pour remplacer la référence. Un texte vide ou un échec (echecs > 0) ne l'écrase pas.
 * lu = { statut, texte? } ; etat = ce que suivrePage vient de rendre.
 */
export function texteRetenu(lu, etat) {
  return Boolean(
    etat && etat.echecs === 0 && lu && lu.statut >= 200 && lu.statut < 300
      && typeof lu.texte === 'string' && lu.texte.trim() !== '',
  );
}

/**
 * Ligne du journal du tour quand guet-envoi.py échoue. stderr = sa sortie d'erreur, toujours présente
 * dans la ligne (le message de Node ne la contient pas toujours).
 */
export function journalEchecEnvoi(stderr, err) {
  const brut = String(stderr ?? '').trim();
  const base = err?.message ? `envoi Discord raté : ${err.message}` : 'envoi Discord raté';
  if (brut && !base.includes(brut)) return `${base}\n${brut}`;
  return brut && !err ? `envoi Discord raté\n${brut}` : base;
}

/**
 * Nouvel état d'une page + ce qui change. lu = { statut, texte?, titre?, erreur? } ; ancien = état enregistré ou null.
 * evenement : null (rien, ou 1re lecture = état de départ), 'texte' (texte changé), 'disparue' (404/410 après une
 * lecture réussie), 'revenue' (relue après une disparition), 'illisible' (3e échec de suite : 403, réseau, 5xx,
 * texte vide, ou texte plus court que 40 % de la référence ; une seule fois, le compteur repart à zéro quand la
 * page redevient lisible). Une lecture ratée ne change pas l'empreinte.
 * opts.rebase : enregistre le nouveau texte sans aucun événement. Un texte vide ou trop court ne l'écrase pas.
 */
export function suivrePage(ancien, lu, empreinte, quand, opts = {}) {
  const httpOk = lu.statut >= 200 && lu.statut < 300 && typeof lu.texte === 'string';
  const vide = httpOk && lu.texte.trim() === '';
  const ref = typeof ancien?.longueur === 'number' ? ancien.longueur : 0;
  const tropCourt = httpOk && !vide && ref > 0 && lu.texte.length < ref * PART_MIN_TEXTE;
  const illisible = vide || tropCourt;
  const ok = httpOk && !illisible;
  const absente = lu.statut === 404 || lu.statut === 410;
  if (opts.rebase) {
    if (!ok) return { etat: ancien ? { ...ancien } : { statut: null, empreinte: null, echecs: 0 }, evenement: null };
    return {
      etat: {
        statut: lu.statut,
        empreinte,
        longueur: lu.texte.length,
        titre: lu.titre || ancien?.titre || null,
        luLe: quand,
        echecs: 0,
      },
      evenement: null,
    };
  }
  if (!ok && !absente) {
    const etat = ancien ? { ...ancien } : { statut: null, empreinte: null };
    etat.echecs = (ancien?.echecs || 0) + 1;
    etat.derniereErreur = lu.erreur || (illisible ? 'page illisible' : `HTTP ${lu.statut}`);
    etat.tenteLe = quand;
    return { etat, evenement: etat.echecs === ECHECS_PAGE_ILLISIBLE ? 'illisible' : null };
  }
  const etat = {
    statut: lu.statut,
    empreinte: ok ? empreinte : ancien?.empreinte ?? null,
    longueur: ok ? lu.texte.length : ancien?.longueur ?? null,
    titre: (ok && lu.titre) || ancien?.titre || null,
    luLe: quand,
    echecs: 0,
  };
  if (!ancien || ancien.statut == null) return { etat, evenement: null };
  if (absente) return { etat, evenement: ancien.statut === 404 || ancien.statut === 410 ? null : 'disparue' };
  if (ancien.statut === 404 || ancien.statut === 410) return { etat, evenement: 'revenue' };
  return { etat, evenement: ancien.empreinte && ancien.empreinte !== empreinte ? 'texte' : null };
}

/* ------------------------------------------------------------------ */
/* Alerte                                                              */
/* ------------------------------------------------------------------ */

/** 53.2 -> « 53,20 $ », 1000 -> « 1 000 $ », 14.25 -> « 14,25 $ ». */
export function usd(x) {
  if (num(x) == null) return '?';
  const entier = Number.isInteger(x);
  const s = x.toLocaleString('fr-FR', { minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ');
  return `${s} $`;
}

/** 25000 -> « 25K », 3500 -> « 3,5K », 500 -> « 500 ». */
export function taille(n) {
  if (num(n) == null) return String(n ?? '?');
  if (n >= 1000) return `${String(n / 1000).replace('.', ',')}K`;
  return String(n);
}

/** « perte max 300 $ / prix 14,25 $ = 21,1x » (le « 20x drawdown » de Lil Fish). */
export function rapport(plan) {
  if (num(plan.perteMax) == null) return 'perte max absente des données : rapport non calculable';
  if (!num(plan.paye)) return 'prix absent des données : rapport non calculable';
  const r = plan.perteMax / plan.paye;
  return `perte max ${usd(plan.perteMax)} / prix ${usd(plan.paye)} = ${r.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}x`;
}

const LIBELLES_PRIX = {
  futures: { price: 'prix', originalPrice: 'prix barré' },
  perps: { price: 'prix barré', promoPrice: 'prix', altPrice: 'variante, prix barré', altPromoPrice: 'variante, prix' },
};

/** Libellé lisible d'un champ de prix à plat. */
export function libellePrix(champ, marche) {
  const base = LIBELLES_PRIX[marche] || {};
  if (base[champ]) return base[champ];
  let m = champ.match(/^splitPrices\.(.+)$/);
  if (m) return `prix au split ${m[1]} %`;
  m = champ.match(/^more\[(.+?)\]\.(.+)$/);
  if (m) return `${m[1]}, ${libellePrix(m[2], marche)}`;
  m = champ.match(/^altPrices\[(\d+)\]\.(.+)$/);
  if (m) return `variante ${Number(m[1]) + 2}, ${libellePrix(m[2], marche)}`;
  m = champ.match(/^grid\[(.+?)\]\.(.+)$/);
  if (m) return `${m[1]}, ${libellePrix(m[2], marche)}`;
  return champ;
}

function lignePrix({ avant, apres }) {
  const champs = [...new Set([...Object.keys(avant.prix), ...Object.keys(apres.prix)])];
  const bouts = [];
  for (const c of champs) {
    const a = avant.prix[c];
    const b = apres.prix[c];
    if (a === b) continue;
    const lib = libellePrix(c, apres.marche);
    if (a == null) bouts.push(`${lib} ${usd(b)} (nouveau)`);
    else if (b == null) bouts.push(`${lib} ${usd(a)} (retiré)`);
    else bouts.push(`${lib} ${usd(a)} → ${usd(b)}`);
  }
  return bouts.join(', ');
}

/** Texte d'une promo : son libellé, à défaut ses chiffres. */
export function textePromo(p) {
  if (!p) return 'aucune';
  const q = p.promo;
  const bouts = [];
  if (q && typeof q === 'object') {
    if (q.label) bouts.push(`« ${q.label} »`);
    else if (num(q.discountPct) != null) bouts.push(`-${q.discountPct} %${q.code ? ` avec le code ${q.code}` : ''}`);
    else if (q.code) bouts.push(`code ${q.code}`);
    if (q.firstPurchase && num(q.thenPct) != null) bouts.push(`1er achat, puis -${q.thenPct} %`);
    const fin = q.ends || q.endsAt;
    if (fin) bouts.push(`jusqu'au ${String(fin).slice(0, 10)}`);
  } else if (typeof q === 'string' && q) {
    bouts.push(`« ${q} »`);
  }
  if (num(p.codeDiscountPct) != null) bouts.push(`-${p.codeDiscountPct} % avec le code`);
  if (p.code && !(q && q.code === p.code) && !bouts.some((b) => b.includes(p.code))) bouts.push(`code ${p.code}`);
  return bouts.length ? bouts.join(', ') : 'aucune';
}

const nomPlan = (p) => `${p.programme} ${taille(p.taille)}`;

function ligneRegles(plan, regles) {
  const r = reglesDuPlan(plan, regles);
  if (!r.length) return [];
  const liste = r
    .slice()
    .sort((a, b) => `${a.dossier}/${a.fichier}`.localeCompare(`${b.dossier}/${b.fichier}`))
    .map((x) => `${x.dossier}/${x.fichier}${num(x.prix) != null ? ` (prix du fichier ${usd(x.prix)})` : ''}`);
  return [`  fichiers de règles propsim peut-être périmés (non modifiés) : ${liste.join(', ')}`];
}

/** Nom affiché d'une firme : « E8 Markets (perps) » pour l'onglet perps. */
const nomFirme = (f) => (f.marche === 'perps' ? `${f.nom} (perps)` : f.nom);
const parNom = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' });
const parPlan = (a, b) => parNom(a.programme, b.programme) || (a.taille ?? 0) - (b.taille ?? 0);

/**
 * Blocs de l'alerte des offres, un par firme, ordre alphabétique (aucun classement). [] = rien n'a changé.
 * regles = fichiers de règles propsim [{ dossier, fichier, nom, prix }].
 */
export function blocsOffres(diff, regles = []) {
  const blocs = [];
  const firmes = [...diff.values()].filter((f) => f.promo || f.nouveaux.length || f.retires.length || f.prix.length || f.pertes.length);
  for (const f of firmes.sort((a, b) => parNom(nomFirme(a), nomFirme(b)))) {
    const l = [nomFirme(f)];
    if (f.promo) l.push(`- promo : ${textePromo(f.promo.avant)} → ${textePromo(f.promo.apres)}`);
    for (const p of f.nouveaux.slice().sort(parPlan)) {
      l.push(`- nouveau plan · ${nomPlan(p)} : ${rapport(p)}`);
      l.push(...ligneRegles(p, regles));
    }
    for (const c of f.prix.slice().sort((a, b) => parPlan(a.apres, b.apres))) {
      l.push(`- prix changé · ${nomPlan(c.apres)} : ${lignePrix(c)} · ${rapport(c.apres)}`);
      l.push(...ligneRegles(c.apres, regles));
    }
    for (const c of f.pertes.slice().sort((a, b) => parPlan(a.apres, b.apres))) {
      l.push(`- perte max changée · ${nomPlan(c.apres)} : perte max ${usd(c.avant.perteMax)} → ${usd(c.apres.perteMax)} · ${rapport(c.apres)}`);
      l.push(...ligneRegles(c.apres, regles));
    }
    for (const p of f.retires.slice().sort(parPlan)) {
      l.push(`- plan retiré · ${nomPlan(p)}${num(p.paye) != null ? ` (était à ${usd(p.paye)})` : ''}`);
    }
    blocs.push(l.join('\n'));
  }
  return blocs;
}

const MOTS_EVENEMENT = {
  texte: 'texte changé',
  disparue: 'page disparue',
  revenue: 'page revenue',
};

/**
 * Première zone différente entre deux textes : le milieu entre le préfixe commun et le suffixe commun,
 * 300 caractères au plus de chaque côté. null si les textes sont identiques.
 */
export function extraitChangement(avant, apres, max = 300) {
  const a = String(avant);
  const b = String(apres);
  if (a === b) return null;
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  let finA = a.length;
  let finB = b.length;
  while (finA > i && finB > i && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
  }
  const coupe = (s) => s.slice(0, max).replace(/\r?\n/g, ' ');
  return `avant : ${coupe(a.slice(i, finA))}\naprès : ${coupe(b.slice(i, finB))}`;
}

/**
 * Blocs de l'alerte des pages, un par firme, ordre alphabétique. changements = [{ url, firme, evenement, titre, statut,
 * fichiers: Set|[], texteAvant?, texteApres? }].
 */
export function blocsPages(changements) {
  const parFirme = new Map();
  for (const c of changements) {
    if (!parFirme.has(c.firme)) parFirme.set(c.firme, []);
    parFirme.get(c.firme).push(c);
  }
  const blocs = [];
  for (const firme of [...parFirme.keys()].sort(parNom)) {
    const l = [firme];
    for (const c of parFirme.get(firme).sort((a, b) => a.url.localeCompare(b.url))) {
      if (c.evenement === 'illisible') {
        l.push(`- page illisible depuis ${ECHECS_PAGE_ILLISIBLE} jours : ${c.titre ? `${c.titre} ` : ''}${c.url}`);
        continue;
      }
      const statut = c.evenement === 'disparue' ? ` (HTTP ${c.statut})` : '';
      l.push(`- ${MOTS_EVENEMENT[c.evenement] || c.evenement}${statut} · ${c.titre ? `${c.titre} · ` : ''}${c.url}`);
      if (c.evenement === 'texte' && typeof c.texteAvant === 'string' && typeof c.texteApres === 'string') {
        const ex = extraitChangement(c.texteAvant, c.texteApres);
        if (ex) for (const ligne of ex.split('\n')) l.push(`  ${ligne}`);
      }
      const fichiers = [...(c.fichiers || [])].sort();
      if (fichiers.length) l.push(`  fichiers de règles propsim peut-être périmés (non modifiés) : ${fichiers.join(', ')}`);
    }
    blocs.push(l.join('\n'));
  }
  return blocs;
}

/** Découpe en messages Discord (2 000 caractères au plus, marge gardée) : en-tête puis blocs entiers, ligne à ligne
 *  seulement si un bloc seul dépasse. */
export function messages(entete, blocs, max = 1900) {
  const out = [];
  let cur = entete;
  const pousser = (morceau) => {
    const ajout = cur ? `${cur}\n\n${morceau}` : morceau;
    if (ajout.length <= max) {
      cur = ajout;
      return;
    }
    if (cur) out.push(cur);
    cur = '';
    if (morceau.length <= max) {
      cur = morceau;
      return;
    }
    for (const ligne of morceau.split('\n')) {
      const a = cur ? `${cur}\n${ligne}` : ligne;
      if (a.length <= max) cur = a;
      else {
        if (cur) out.push(cur);
        cur = ligne.length <= max ? ligne : ligne.slice(0, max - 1) + '…';
      }
    }
  };
  for (const b of blocs) pousser(b);
  if (cur && cur !== entete) out.push(cur);
  return out;
}

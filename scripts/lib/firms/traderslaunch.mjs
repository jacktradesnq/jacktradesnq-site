/**
 * Traders Launch, lu sur sa page d'accueil (https://traderslaunch.com), section #pricing.
 *
 * Depuis le 19/10/2026 la page n'a plus de cartes rendues cote serveur pour tout
 * ce qu'elle vend : un selecteur « Account » (Premium / Static / Early Access)
 * et un selecteur « Profit Split » (60 / 80 %, et 90 % sur Static) changent les
 * cartes dans le navigateur. Le HTML brut ne montre que l'etat par defaut
 * (Premium 80 % + Legacy NYC) : un fetch simple ne verrait jamais Static, et la
 * synchro du catalogue le retirerait du site. La lecture passe donc par
 * Playwright (installe dans le workflow), qui clique chaque onglet et relit les
 * cartes rendues (`readTradersLaunchPage`). Le parsing, lui, est une fonction
 * pure sur ce releve (`programsFromSnapshot`), testee sur une fixture.
 *
 * Ce qu'on lit, carte par carte (texte rendu, `innerText`) :
 *
 *     Static 25K                      <- titre : programme + taille
 *     80% Profit Split
 *     $25,000 starting capital        <- « · Legacy NYC » sur les Legacy
 *     $149                            <- le prix, juste avant « One-Time Fee »
 *     One-Time Fee
 *     EVALUATION ... SIMFUNDED ...    <- les regles de l'evaluation entre les deux
 *
 * plus le lien « Get Funded » de la carte
 * (`/auth/purchasing-signup?type=futures&size=25000&split=80&hours=2`).
 * Chaque fait est RECOUPE : la taille du titre, du capital et du lien, le split
 * du titre, du lien et de l'onglet choisi, le badge Legacy et `hours=1`. Un
 * desaccord arrete la firme (stale) plutot que de publier un prix mal attribue.
 *
 * Le prix publie est celui du split 80 % (le choix par defaut de la page, et la
 * convention du site depuis le 13/09) ; chaque plan le dit dans son `note`.
 * Les prix 60 % / 90 % ne sont pas dans ce JSON : futures.ts les porte (SPLIT_60).
 *
 * Ce que les cartes NE disent PAS, et qu'on n'invente donc pas : la perte
 * journaliere (cle omise). La FAQ Static ecrit « There is no separate daily loss
 * limit », mais la publier ajouterait une colonne au tableau de la firme :
 * decision d'affichage laissee a Angelo.
 *
 * L'onglet Early Access (des « drops » limites en quantite et en duree) n'est
 * PAS publie : decision d'affichage d'Angelo en attente. Il est releve quand
 * meme, pour que le journal dise s'il y a un drop en vente.
 */

export const TRADERSLAUNCH_URL = 'https://traderslaunch.com/';

/** La source citee dans l'alerte de synchro quand la tournee lit cette page. */
export const TRADERSLAUNCH_SOURCE = 'page traderslaunch.com';

/** Le split dont le prix est publie. */
export const PUBLISHED_SPLIT = 80;

/** Les onglets releves mais pas publies (voir l'en-tete). */
const NOT_PUBLISHED = new Set(['Early Access']);

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** « $1,000 », « $1 000 » (espace fine de leur formatage) -> 1000. Sinon null, jamais NaN. */
function money(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[$,\s  ]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** « Futures 100K » / « Static 25K » -> 100000 / 25000. */
function sizeFromHeading(heading) {
  const m = String(heading ?? '').match(/([\d.]+)\s*K\b/i);
  return m ? Math.round(Number(m[1]) * 1000) : null;
}

const lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** La ligne qui suit `label` dans `ls` (exact, insensible a la casse), ou null. */
function after(ls, label) {
  const i = ls.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  return i === -1 || i + 1 >= ls.length ? null : ls[i + 1];
}

/** Les libelles de la zone EVALUATION, pour savoir ou s'arrete une valeur. */
const EVAL_LABELS = ['Profit Target', 'Max Drawdown', 'Best Day', 'Days to Pass', 'Consistency Rule'];

/**
 * « $1 000 EODLocks at starting balance », « $1 000 EOD » + « Locks at starting
 * balance » (les Legacy le mettent sur deux lignes), « $500 staticDoes not trail ».
 * Rend le montant et une forme normalisee « EOD - Locks at starting balance ».
 */
function drawdown(ls) {
  const i = ls.findIndex((l) => l.toLowerCase() === 'max drawdown');
  if (i === -1 || i + 1 >= ls.length) return null;
  let raw = ls[i + 1];
  const next = ls[i + 2];
  if (next && !EVAL_LABELS.some((lb) => lb.toLowerCase() === next.toLowerCase()) && /^[A-Z][a-z]/.test(next)) {
    raw += ` ${next}`;
  }
  const m = raw.match(/^\$([\d,\s  ]+?)\s*(EOD|static)\s*(.*)$/i);
  if (!m) throw new Error(`drawdown illisible : « ${raw} »`);
  const kind = /^eod$/i.test(m[2]) ? 'EOD' : 'static';
  const qualifier = m[3].trim();
  return { amount: money(m[1]), type: qualifier ? `${kind} - ${qualifier}` : kind };
}

/**
 * Une carte : son texte rendu et son lien « Get Funded ».
 * @param {string} programme  l'onglet sous lequel la carte a ete lue (ou 'Legacy NYC')
 * @param {number} chosenSplit  le split selectionne dans l'onglet au moment de la lecture
 */
function parseCard(programme, chosenSplit, card) {
  const href = String(card?.href ?? '');
  const q = href.indexOf('?');
  const params = new URLSearchParams(q === -1 ? '' : href.slice(q + 1));
  const size = money(params.get('size'));
  if (size == null || size <= 0) throw new Error(`un lien « Get Funded » sans taille lisible (${href})`);
  const tag = `${programme} ${size / 1000}K`;

  const ls = lines(card.text);
  const heading = ls[0] ?? '';
  const capitalLine = ls.find((l) => /starting capital/i.test(l)) ?? null;
  const capital = capitalLine ? money(capitalLine.match(/^\$([\d,\s]+)/)?.[1]) : null;

  const feeAt = ls.findIndex((l) => /^one-time fee$/i.test(l));
  if (feeAt < 1) throw new Error(`${tag} : aucun prix « One-Time Fee » dans sa carte, la mise en page a change`);
  const price = money(ls[feeAt - 1]);
  if (price == null) throw new Error(`${tag} : prix illisible avant « One-Time Fee » (« ${ls[feeAt - 1]} »)`);

  for (const [quoi, vu] of [['son titre', sizeFromHeading(heading)], ['son capital affiche', capital]]) {
    if (vu == null) throw new Error(`${tag} : ${quoi} est illisible, le gabarit a change`);
    if (vu !== size) {
      throw new Error(
        `le lien du compte ${size} et ${quoi} (${vu}) ne parlent pas du meme compte : ` +
          'leur gabarit a change, le mapping doit etre relu avant de publier un prix',
      );
    }
  }

  const split = money(params.get('split'));
  const splitAffiche = money(ls.find((l) => /^\d+% Profit Split$/i.test(l))?.match(/^(\d+)/)?.[1]);
  if (split == null || splitAffiche == null || split !== splitAffiche || split !== chosenSplit) {
    throw new Error(
      `${tag} : split incoherent (lien ${split}, carte ${splitAffiche}, onglet choisi ${chosenSplit})`,
    );
  }

  const legacy = /Legacy NYC/i.test(capitalLine ?? '');
  if (legacy !== (params.get('hours') === '1') || legacy !== (programme === 'Legacy NYC')) {
    throw new Error(
      `${tag} : badge Legacy ${legacy ? 'present' : 'absent'} et hours=${params.get('hours')} ` +
        'se contredisent sur le produit vendu',
    );
  }

  // Les regles de l'evaluation, entre EVALUATION et SIMFUNDED.
  const evalAt = ls.findIndex((l) => /^evaluation$/i.test(l));
  const fundedAt = ls.findIndex((l) => /^simfunded$/i.test(l));
  if (evalAt === -1 || fundedAt <= evalAt) throw new Error(`${tag} : zones EVALUATION / SIMFUNDED introuvables`);
  const ev = ls.slice(evalAt + 1, fundedAt);

  const plan = { size, price };
  const target = money(after(ev, 'Profit Target'));
  if (target == null) throw new Error(`${tag} : profit target illisible`);
  plan.profitTarget = target;

  const dd = drawdown(ev);
  if (!dd || dd.amount == null) throw new Error(`${tag} : max drawdown illisible`);
  plan.maxDrawdown = dd.amount;
  plan.ddType = dd.type;

  // « Best Day — Under 40% of profit » (Premium, Legacy) ou « Consistency Rule — 50% » (Static).
  const bestDay = after(ev, 'Best Day');
  const consRule = after(ev, 'Consistency Rule');
  const cons = (bestDay ?? consRule ?? '').match(/(\d+)\s*%/);
  if (cons) plan.consistency = `${cons[1]}%`;
  else if (/^none$/i.test(consRule ?? '')) plan.consistency = 'None';

  const starts = ls.find((l) => /^Starts at /i.test(l));
  const contracts = starts?.match(/^Starts at (.+?)(?:, up to [^.]*)?\.(?:\s|$)/i)?.[1];
  if (contracts) plan.contracts = contracts;

  const note = [];
  if (legacy) {
    const hours = starts?.match(/(Trading hours: [^.]*?ET \(Legacy NYC\))/i)?.[1];
    if (hours) note.push(`${hours}.`);
  }
  note.push(`Price shown for the ${split}% split.`);
  plan.note = note.join(' ');

  return plan;
}

/**
 * Les programmes vendus, dans la forme du dataset.
 *
 * @param {{views: Array<{account: string, split: number|null, cards: Array<{href: string, text: string}>, text?: string}>,
 *          legacy: {split: number|null, cards: Array<{href: string, text: string}>}}} snap
 *        le releve de `readTradersLaunchPage`
 * @returns {Array<{name: string, type: 'eval', priceType: 'one-time', plans: object[]}>}
 * @throws  quand un onglet vendu n'a plus de carte lisible, ou quand deux lectures d'un fait se contredisent
 */
export function programsFromSnapshot(snap) {
  const views = snap?.views;
  if (!Array.isArray(views) || views.length === 0) {
    throw new Error('traderslaunch.com : aucun onglet « Account » dans #pricing, la mise en page a change');
  }

  const programmes = [];
  const add = (name, split, cards) => {
    const plans = cards.map((c) => parseCard(name, split, c));
    const sizes = plans.map((p) => p.size);
    if (new Set(sizes).size !== sizes.length) throw new Error(`${name} : deux cartes pour la meme taille`);
    programmes.push({ name, type: 'eval', priceType: 'one-time', plans: plans.sort((a, b) => a.size - b.size) });
  };

  for (const v of views) {
    if (NOT_PUBLISHED.has(v.account)) continue;
    if (!v.cards?.length) {
      throw new Error(`${v.account} : aucune carte de prix dans son onglet (la mise en page a change)`);
    }
    if (v.split !== PUBLISHED_SPLIT) {
      throw new Error(`${v.account} : le split ${PUBLISHED_SPLIT} % n'a pas pu etre choisi (onglet a ${v.split})`);
    }
    add(v.account, v.split, v.cards);
  }

  const legacy = snap.legacy;
  if (legacy?.cards?.length) add('Legacy NYC', legacy.split ?? PUBLISHED_SPLIT, legacy.cards);

  if (!programmes.length) throw new Error('traderslaunch.com : aucune carte de prix futures sur la page');
  return programmes;
}

/** Une phrase pour le journal sur l'onglet Early Access, ou null s'il n'existe plus. */
export function earlyAccessStatus(snap) {
  const v = snap?.views?.find((x) => x.account === 'Early Access');
  if (!v) return null;
  if (v.cards?.length) return `Early Access : ${v.cards.length} carte(s) en vente, NON publiees (decision d'Angelo)`;
  return 'Early Access : aucun drop en vente';
}

/* ------------------------------------------------------------------ */
/* Lecture dans le navigateur                                          */
/* ------------------------------------------------------------------ */

/**
 * Ouvre la page dans Chromium headless, clique chaque onglet « Account » de
 * #pricing, choisit le split publie, et releve les cartes. Rien n'est parse ici.
 *
 * @param {{chromium: object, url?: string, settleMs?: number}} opts  `chromium` de playwright
 */
export async function readTradersLaunchPage({ chromium, url = TRADERSLAUNCH_URL, settleMs = 8000 }) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    // En local le Chromium de Playwright n'est pas toujours telecharge : le Chrome installe suffit.
    try {
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    } catch {
      throw err;
    }
  }
  try {
    const ctx = await browser.newContext({ userAgent: BROWSER_UA, viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (res && !res.ok()) throw new Error(`${url} : HTTP ${res.status()}`);
    // networkidle n'arrive jamais sur cette page (flux de payouts en direct).
    await page.waitForTimeout(settleMs);

    const inPage = {
      accounts: () => {
        const sec = document.querySelector('#pricing');
        if (!sec) return null;
        const norm = (e) => e.innerText.trim().split('\n')[0].trim();
        // Les onglets « Account » : boutons a aria-pressed, au texte non vide et qui ne sont pas un split.
        return [...sec.querySelectorAll('button[aria-pressed]')]
          .filter((b) => b.innerText.trim() && !/^\d+%$/.test(b.innerText.trim()))
          .map(norm);
      },
      click: ([kind, label]) => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const btns = [...sec.querySelectorAll('button')].filter(vis);
        const b =
          kind === 'account'
            ? btns.find((x) => x.hasAttribute('aria-pressed') && x.innerText.trim().split('\n')[0].trim() === label)
            : kind === 'split'
              ? btns.find((x) => x.innerText.trim() === label)
              : btns.find((x) => new RegExp(label).test(x.innerText));
        if (!b) return false;
        if (kind !== 'legacy' && b.getAttribute('aria-pressed') === 'true') return true;
        b.click();
        return true;
      },
      state: (wantLegacy) => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const split = [...sec.querySelectorAll('button[aria-pressed="true"]')]
          .filter(vis)
          .map((b) => b.innerText.trim())
          .find((t) => /^\d+%$/.test(t));
        const links = [...sec.querySelectorAll('a[href*="purchasing-signup?"]')].filter((a) =>
          wantLegacy ? /[?&]hours=1\b/.test(a.href) : !/[?&]hours=1\b/.test(a.href),
        );
        const cards = links.filter(vis).map((a) => {
          // La carte = le plus haut ancetre qui ne contient que ce lien.
          let n = a;
          while (n.parentElement && n.parentElement.querySelectorAll('a[href*="purchasing-signup?"]').length === 1) {
            n = n.parentElement;
          }
          return { href: a.href, text: n.innerText };
        });
        return { split: split ? Number(split.replace('%', '')) : null, cards, text: sec.innerText };
      },
    };

    const accounts = await page.evaluate(inPage.accounts);
    if (!accounts?.length) throw new Error('traderslaunch.com : pas de section #pricing ou pas d onglet « Account »');

    const views = [];
    for (const account of [...new Set(accounts)]) {
      if (!(await page.evaluate(inPage.click, ['account', account]))) {
        throw new Error(`onglet « ${account} » introuvable`);
      }
      await page.waitForTimeout(1500);
      await page.evaluate(inPage.click, ['split', `${PUBLISHED_SPLIT}%`]);
      await page.waitForTimeout(1500);
      const st = await page.evaluate(inPage.state, false);
      views.push({ account, split: st.split, cards: st.cards, text: st.cards.length ? undefined : st.text });
    }

    await page.evaluate(inPage.click, ['legacy', 'View Legacy Accounts']);
    await page.waitForTimeout(2000);
    const leg = await page.evaluate(inPage.state, true);

    return { url, readAt: new Date().toISOString(), views, legacy: { split: PUBLISHED_SPLIT, cards: leg.cards } };
  } finally {
    await browser.close();
  }
}

/**
 * Lit et parse. Toute erreur est parlante : l'appelant la journalise et garde
 * les anciennes donnees (stale), il ne l'avale pas.
 *
 * @param {{read?: () => Promise<object>, log?: (s: string) => void}} [opts]  `read` injectable pour les tests
 */
export async function fetchTradersLaunchPrograms({ read, log = () => {} } = {}) {
  let snap;
  if (read) {
    snap = await read();
  } else {
    let pw;
    try {
      pw = await import('playwright');
    } catch {
      throw new Error('playwright absent : la page Traders Launch ne se lit plus sans navigateur');
    }
    snap = await readTradersLaunchPage({ chromium: pw.chromium });
  }
  const ea = earlyAccessStatus(snap);
  if (ea) log(ea);
  return programsFromSnapshot(snap);
}

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
 * Chaque split propose par un onglet est lu (Premium 60 / 80 %, Static 60 / 80 /
 * 90 %, Legacy NYC 55 / 80 % le 21/10/2026). Le prix principal du plan reste
 * celui du split 80 % (le choix par defaut de la page, et la convention du site
 * depuis le 13/09) ; les autres splits vont dans `splitPrices` ({"60": 119,
 * "90": 169}), que futures.ts affiche en lignes de prix. Angelo, 21/10/2026 :
 * « tant que y a sur leur site faut que ca sois sur nôtre site aussi », « si y a
 * une option 90% pk tu mettrais pas a 90% ».
 *
 * Aucune perte journaliere, sur tous les programmes (`dailyLoss: null`) : la page
 * traderslaunch.com/futures/rules n'en cite aucune, la FAQ Static ecrit « There
 * is no separate daily loss limit » (21/10/2026, voir programFrom).
 *
 * L'onglet Early Access (des « drops » limites en quantite et en duree) devient
 * un programme « Early Access » des qu'un drop y est en vente ; sans drop, il
 * n'ajoute rien. Un drop illisible est signale au journal sans arreter la firme.
 * Un drop vendu sur une seule plateforme (TL Drop #2, « Hyperprop only », 26/10/2026)
 * n'a aucune carte sur la plateforme par defaut : l'onglet dit seulement « Show
 * Hyperprop Accounts ». La lecture clique alors ce bouton dans un navigateur
 * neuf, pour ne pas changer la plateforme des autres onglets. Ses cartes
 * montrent les trois splits en meme temps (pas de selecteur), un prix barre
 * (« List price ») et une perte journaliere, lus ici.
 */

export const TRADERSLAUNCH_URL = 'https://traderslaunch.com/';

/** La source citee dans l'alerte de synchro quand la tournee lit cette page. */
export const TRADERSLAUNCH_SOURCE = 'page traderslaunch.com';

/** Le split dont le prix est le prix principal du plan. */
export const PUBLISHED_SPLIT = 80;

/** L'onglet des drops : publie seulement quand un drop est en vente. */
const EARLY_ACCESS = 'Early Access';

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
  // « EOD trailing Stops trailing at $25,000 » (drops) : le « trailing » colle au type.
  const qualifier = m[3].trim().replace(/^trailing\s+(?=\S)/i, '');
  return { amount: money(m[1]), type: qualifier ? `${kind} - ${qualifier}` : kind };
}

/**
 * Une carte : son texte rendu et son lien « Get Funded ».
 * @param {string} programme  l'onglet sous lequel la carte a ete lue (ou 'Legacy NYC')
 * @param {number} chosenSplit  le split selectionne dans l'onglet au moment de la lecture
 * @param {boolean} drop  une carte de drop Early Access : pas de ligne « starting capital »
 */
function parseCard(programme, chosenSplit, card, drop = false) {
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

  const checks = [['son titre', sizeFromHeading(heading)]];
  if (!drop || capitalLine) checks.push(['son capital affiche', capital]);
  for (const [quoi, vu] of checks) {
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
  // chosenSplit null : un onglet sans selecteur de split (un drop Early Access).
  if (split == null || splitAffiche == null || split !== splitAffiche || (chosenSplit != null && split !== chosenSplit)) {
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
  // « List price » / « $99 » / « 20% Off » sous le prix (drops) : le prix barre de la page.
  const listPrice = money(after(ls.slice(feeAt), 'List price'));
  if (listPrice != null) {
    if (listPrice < price) throw new Error(`${tag} : prix barre ${listPrice} sous le prix ${price}`);
    if (listPrice > price) plan.originalPrice = listPrice;
  }
  const target = money(after(ev, 'Profit Target'));
  if (target == null) throw new Error(`${tag} : profit target illisible`);
  plan.profitTarget = target;

  const dd = drawdown(ev);
  if (!dd || dd.amount == null) throw new Error(`${tag} : max drawdown illisible`);
  plan.maxDrawdown = dd.amount;
  plan.ddType = dd.type;

  // « Best Day — Under 40% of profit » (Premium, Legacy) ou « Consistency Rule — 50% » (Static).
  const days = after(ev, 'Days to Pass');
  if (days != null) {
    const d = days.match(/^(\d+)\s+minimum$/i);
    if (!d) throw new Error(`${tag} : « Days to Pass » illisible (« ${days} »)`);
    plan.minDays = Number(d[1]);
  }

  const bestDay = after(ev, 'Best Day');
  const consRule = after(ev, 'Consistency Rule');
  const cons = (bestDay ?? consRule ?? '').match(/(\d+)\s*%/);
  if (cons) plan.consistency = `${cons[1]}%`;
  else if (/^none$/i.test(consRule ?? '')) plan.consistency = 'None';

  const note = [];
  // « Daily Loss Limit » / « $600 » / « Lifted on days that start at or above $25,600 » (drops).
  const dll = after(ev, 'Daily Loss Limit');
  if (dll != null) {
    const v = money(dll);
    if (v == null) throw new Error(`${tag} : « Daily Loss Limit » illisible (« ${dll} »)`);
    plan.dailyLoss = v;
    const why = ev[ev.findIndex((l) => /^daily loss limit$/i.test(l)) + 2];
    if (why && /^Lifted /.test(why)) note.push(`Daily loss limit ${why[0].toLowerCase()}${why.slice(1)}.`);
  }

  const starts = ls.find((l) => /^Starts at /i.test(l));
  const contracts = starts?.match(/^Starts at (.+?)(?:, up to [^.]*)?\.(?:\s|$)/i)?.[1] ?? after(ev, 'Starting Size');
  if (contracts) plan.contracts = contracts;

  // « Trading hours: 6:00pm – 4:00pm ET the following day » (Premium, Static),
  // « Trading hours: 9:30am – 4:00pm ET (Legacy NYC) » : chaque carte a les siennes.
  const hours = starts?.match(/(Trading hours: [^.]*?ET\b[^.]*?)\s*(?:\.|$)/i)?.[1]?.trim();
  if (hours) note.push(`${hours}.`);
  note.push(`Price shown for the ${split}% split.`);
  plan.note = note.join(' ');

  return plan;
}

/**
 * Un programme a partir de ses splits lus. Le prix principal est celui du split
 * 80 % ; les autres splits vont dans `splitPrices`, apres verification que leurs
 * cartes decrivent les memes comptes (meme objectif, meme perte max).
 *
 * @param {string} name
 * @param {Array<{split: number|null, cards: Array<{href: string, text: string}>}>} splits
 * @param {{title: string, text: string}|null} faq  la FAQ affichee sous l'onglet, si elle existe
 * @param {boolean} drop  un drop Early Access : pas de split 80 % exige
 */
function programFrom(name, splits, faq, drop = false) {
  let all = Array.isArray(splits) ? splits : [];
  if (drop && all.length === 1 && all[0].split == null) {
    // Un drop montre tous ses splits a la fois, sans selecteur : le lien de chaque carte dit le sien.
    const by = new Map();
    for (const c of all[0].cards ?? []) {
      const q = String(c?.href ?? '').indexOf('?');
      const sp = money(new URLSearchParams(q === -1 ? '' : String(c.href).slice(q + 1)).get('split'));
      if (!by.has(sp)) by.set(sp, []);
      by.get(sp).push(c);
    }
    all = [...by].map(([split, cards]) => ({ split, cards }));
  }
  const read = all.filter((s) => s.cards?.length);
  if (!read.length) throw new Error(`${name} : aucune carte de prix dans son onglet (la mise en page a change)`);
  const empty = all.find((s) => !s.cards?.length);
  if (empty) {
    // Un split propose sans carte : la ligne de prix disparaitrait du site en silence.
    throw new Error(`${name} : aucune carte au split ${empty.split} %, la lecture est partielle`);
  }
  let main = read.find((s) => s.split === PUBLISHED_SPLIT);
  if (!main) {
    if (!drop) {
      throw new Error(
        `${name} : le split ${PUBLISHED_SPLIT} % n'a pas pu etre choisi (splits lus : ${read.map((s) => s.split).join(', ')})`,
      );
    }
    main = read[0];
  }

  const plans = main.cards.map((c) => parseCard(name, main.split, c, drop));
  const sizes = plans.map((p) => p.size);
  if (new Set(sizes).size !== sizes.length) throw new Error(`${name} : deux cartes pour la meme taille`);

  for (const s of read) {
    if (s === main) continue;
    for (const card of s.cards) {
      const other = parseCard(name, s.split, card, drop);
      const base = plans.find((p) => p.size === other.size);
      const tag = `${name} ${other.size / 1000}K`;
      if (!base) throw new Error(`${tag} : vendu au split ${s.split} % mais pas au ${main.split} %`);
      if (base.profitTarget !== other.profitTarget || base.maxDrawdown !== other.maxDrawdown) {
        throw new Error(`${tag} : le split ${s.split} % n'a pas les memes regles d'evaluation que le ${main.split} %`);
      }
      if (base.splitPrices?.[String(s.split)] != null) throw new Error(`${tag} : deux cartes au split ${s.split} %`);
      base.splitPrices = { ...base.splitPrices, [String(s.split)]: other.price };
    }
  }
  for (const p of plans) {
    if (!p.splitPrices) continue;
    const keys = Object.keys(p.splitPrices).sort((a, b) => Number(a) - Number(b));
    p.splitPrices = Object.fromEntries(keys.map((k) => [k, p.splitPrices[k]]));
  }

  // Pas de perte journaliere chez Traders Launch, sur aucun compte : leur page de regles
  // (traderslaunch.com/futures/rules, lue le 21/10/2026) liste toutes les regles de
  // l'evaluation et du compte finance sans en citer, et la FAQ Static ecrit « There is
  // no separate daily loss limit ». Angelo, 21/10/2026 : « si y a pas écrit de daily
  // loss limit.. peut être que par ce que y en a pas ».
  // Les drops publient la leur sur la carte (TL Drop #2 : $600) : celle-la reste.
  for (const p of plans) if (p.dailyLoss === undefined) p.dailyLoss = null;

  return { name, type: 'eval', priceType: 'one-time', plans: plans.sort((a, b) => a.size - b.size) };
}

/**
 * Les programmes vendus, dans la forme du dataset.
 *
 * @param {{views: Array<{account: string, splits: Array<{split: number|null, cards: Array<{href: string, text: string}>}>,
 *                        faq?: {title: string, text: string}|null, text?: string}>,
 *          legacy: {splits: Array<{split: number|null, cards: Array<{href: string, text: string}>}>}}} snap
 *        le releve de `readTradersLaunchPage`
 * @param {{log?: (s: string) => void}} [opts]
 * @returns {Array<{name: string, type: 'eval', priceType: 'one-time', plans: object[]}>}
 * @throws  quand un onglet vendu n'a plus de carte lisible, ou quand deux lectures d'un fait se contredisent
 */
export function programsFromSnapshot(snap, { log = () => {} } = {}) {
  const views = snap?.views;
  if (!Array.isArray(views) || views.length === 0) {
    throw new Error('traderslaunch.com : aucun onglet « Account » dans #pricing, la mise en page a change');
  }

  const programmes = [];
  for (const v of views) {
    if (v.account === EARLY_ACCESS) {
      if (!v.splits?.some((s) => s.cards?.length)) continue; // aucun drop en vente
      try {
        const ea = programFrom(EARLY_ACCESS, v.splits, v.faq, true);
        // « TL Drop #2 25K, » -> « TL Drop #2 · Hyperprop only. Ends Mon, Nov 2, 6:53 AM ET. »
        const card = v.splits.flatMap((s) => s.cards ?? [])[0];
        const title = lines(card?.text)[0]?.replace(/\s*[\d.]+\s*K\b,?\s*$/i, '');
        const ends = lines(v.text).find((l) => /^Ends /.test(l));
        const intro = [
          title ? `${title}${v.platform ? ` · ${v.platform} only` : ''}.` : null,
          ends ? `${ends}.` : null,
        ]
          .filter(Boolean)
          .join(' ');
        if (intro) for (const p of ea.plans) p.note = `${intro} ${p.note}`;
        programmes.push(ea);
      } catch (err) {
        // Un drop au gabarit inconnu ne doit pas geler Premium / Static / Legacy.
        log(`Early Access : drop en vente mais illisible, NON publie (${err.message})`);
      }
      continue;
    }
    programmes.push(programFrom(v.account, v.splits, v.faq));
  }

  const legacy = snap.legacy;
  if (legacy?.splits?.some((s) => s.cards?.length)) programmes.push(programFrom('Legacy NYC', legacy.splits, null));

  if (!programmes.length) throw new Error('traderslaunch.com : aucune carte de prix futures sur la page');
  return programmes;
}

/** Une phrase pour le journal sur l'onglet Early Access, ou null s'il n'existe plus. */
export function earlyAccessStatus(snap) {
  const v = snap?.views?.find((x) => x.account === EARLY_ACCESS);
  if (!v) return null;
  const n = (v.splits ?? []).reduce((k, s) => k + (s.cards?.length ?? 0), 0);
  const sur = v.platform ? ` sur ${v.platform}` : '';
  if (n) return `Early Access : ${n} carte(s) en vente${sur}, publiees comme programme « ${EARLY_ACCESS} »`;
  return 'Early Access : aucun drop en vente';
}

/**
 * Ouvre la page dans Chromium headless, clique chaque onglet « Account » de
 * #pricing puis chacun de ses splits, et releve les cartes (et la FAQ de
 * l'onglet quand il en a une). Idem pour les Legacy NYC. Rien n'est parse ici.
 *
 * @param {{chromium: object, url?: string, settleMs?: number}} opts  `chromium` de playwright
 */
export async function readTradersLaunchPage({ chromium, url = TRADERSLAUNCH_URL, settleMs = 8000 }) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
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
    await page.waitForTimeout(settleMs);

    const inPage = {
      accounts: () => {
        const sec = document.querySelector('#pricing');
        if (!sec) return null;
        const norm = (e) => e.innerText.trim().split('\n')[0].trim();
        return [...sec.querySelectorAll('button[aria-pressed]')]
          .filter((b) => b.innerText.trim() && !/^\d+%$/.test(b.innerText.trim()))
          .map(norm);
      },
      clickAccount: (label) => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const b = [...sec.querySelectorAll('button[aria-pressed]')]
          .filter(vis)
          .find((x) => x.innerText.trim().split('\n')[0].trim() === label);
        if (!b) return false;
        if (b.getAttribute('aria-pressed') !== 'true') b.click();
        return true;
      },
      // Les boutons « 60% » / « 80% » ... : ceux des onglets sont avant le bouton
      // « View Legacy Accounts », ceux des Legacy apres.
      splits: ([legacy, pct]) => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const all = [...sec.querySelectorAll('button')];
        const legacyBtn = all.find((b) => /View Legacy Accounts/i.test(b.innerText));
        const isAfter = (b) =>
          !!legacyBtn && !!(legacyBtn.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        const btns = all
          .filter(vis)
          .filter((b) => /^\d+%$/.test(b.innerText.trim()))
          .filter((b) => (legacy ? isAfter(b) : !isAfter(b)));
        if (pct == null) {
          return {
            list: btns.map((b) => Number(b.innerText.trim().replace('%', ''))),
            pressed: btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => Number(b.innerText.trim().replace('%', '')))[0] ?? null,
          };
        }
        const b = btns.find((x) => x.innerText.trim() === `${pct}%`);
        if (!b) return false;
        if (b.getAttribute('aria-pressed') !== 'true') b.click();
        return true;
      },
      openLegacy: () => {
        const sec = document.querySelector('#pricing');
        const b = [...sec.querySelectorAll('button')].find((x) => /View Legacy Accounts/i.test(x.innerText));
        if (!b) return false;
        b.click();
        return true;
      },
      cards: (wantLegacy) => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const links = [...sec.querySelectorAll('a[href*="purchasing-signup?"]')].filter((a) =>
          wantLegacy ? /[?&]hours=1\b/.test(a.href) : !/[?&]hours=1\b/.test(a.href),
        );
        return links.filter(vis).map((a) => {
          let n = a;
          while (n.parentElement && n.parentElement.querySelectorAll('a[href*="purchasing-signup?"]').length === 1) {
            n = n.parentElement;
          }
          return { href: a.href, text: n.innerText };
        });
      },
      // La FAQ affichee sous l'onglet (« Static Accounts FAQ ») : questions ouvertes,
      // puis son texte, reponses comprises.
      faq: () => {
        const sec = document.querySelector('#pricing');
        const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const head = [...sec.querySelectorAll('h1, h2, h3, h4, p, span, div')]
          .filter(vis)
          .find((e) => e.children.length === 0 && /^.+ Accounts FAQ$/.test(e.innerText.trim()));
        if (!head) return null;
        const title = head.innerText.trim().replace(/ Accounts FAQ$/, '');
        const all = sec.textContent.replace(/\s+/g, ' ');
        const at = all.indexOf(`${title} Accounts FAQ`);
        return { title, text: at === -1 ? '' : all.slice(at, at + 8000) };
      },
      text: () => document.querySelector('#pricing').innerText,
    };

    const accounts = await page.evaluate(inPage.accounts);
    if (!accounts?.length) throw new Error('traderslaunch.com : pas de section #pricing ou pas d onglet « Account »');

    const readSplits = async (legacy) => {
      const { list } = await page.evaluate(inPage.splits, [legacy, null]);
      if (!list.length) return [{ split: null, cards: await page.evaluate(inPage.cards, legacy) }];
      const out = [];
      for (const pct of [...new Set(list)]) {
        if (!(await page.evaluate(inPage.splits, [legacy, pct]))) throw new Error(`split ${pct} % introuvable`);
        await page.waitForTimeout(1500);
        const { pressed } = await page.evaluate(inPage.splits, [legacy, null]);
        out.push({ split: pressed, cards: await page.evaluate(inPage.cards, legacy) });
      }
      return out;
    };

    const views = [];
    for (const account of [...new Set(accounts)]) {
      if (!(await page.evaluate(inPage.clickAccount, account))) throw new Error(`onglet « ${account} » introuvable`);
      await page.waitForTimeout(1500);
      const splits = await readSplits(false);
      const faq = await page.evaluate(inPage.faq);
      const view = { account, splits, faq };
      if (!splits.some((s) => s.cards.length)) view.text = await page.evaluate(inPage.text);
      views.push(view);
    }

    await page.evaluate(inPage.openLegacy);
    await page.waitForTimeout(2000);
    const legacy = { splits: await readSplits(true) };

    // Un drop vendu sur une seule plateforme : ses cartes n'existent que derriere
    // « Show <plateforme> Accounts ». Navigateur neuf, les autres onglets restent lus
    // sur la plateforme par defaut.
    const ea = views.find((v) => v.account === EARLY_ACCESS);
    const platform = ea && !ea.splits.some((s) => s.cards.length) ? ea.text?.match(/Show (\w+) Accounts/)?.[1] : null;
    if (platform) {
      const p2 = await (await browser.newContext({ userAgent: BROWSER_UA, viewport: { width: 1440, height: 1000 } })).newPage();
      const r2 = await p2.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (r2 && !r2.ok()) throw new Error(`${url} : HTTP ${r2.status()}`);
      await p2.waitForTimeout(settleMs);
      if (!(await p2.evaluate(inPage.clickAccount, EARLY_ACCESS))) throw new Error(`onglet « ${EARLY_ACCESS} » introuvable`);
      await p2.waitForTimeout(1500);
      const shown = await p2.evaluate((label) => {
        const b = [...document.querySelectorAll('#pricing button')].find((x) => x.innerText.trim() === label);
        if (!b) return false;
        b.click();
        return true;
      }, `Show ${platform} Accounts`);
      if (!shown) throw new Error(`bouton « Show ${platform} Accounts » introuvable`);
      await p2.waitForTimeout(3000);
      // Une taille par bouton « 25K » / « 50K » quand le drop en vend plusieurs.
      const sizes = await p2.evaluate(() =>
        [...document.querySelectorAll('#pricing button[aria-pressed]')]
          .filter((b) => !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length))
          .map((b) => b.innerText.trim())
          .filter((t) => /^\d+K$/.test(t)),
      );
      const seen = new Map();
      for (const size of sizes.length ? sizes : [null]) {
        if (size) {
          await p2.evaluate((t) => {
            const b = [...document.querySelectorAll('#pricing button[aria-pressed]')].find((x) => x.innerText.trim() === t);
            if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
          }, size);
          await p2.waitForTimeout(1500);
        }
        for (const c of await p2.evaluate(inPage.cards, false)) seen.set(c.href, c);
      }
      ea.splits = [{ split: null, cards: [...seen.values()] }];
      ea.platform = platform;
      ea.text = await p2.evaluate(inPage.text);
    }

    return { url, readAt: new Date().toISOString(), views, legacy };
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
  return programsFromSnapshot(snap, { log });
}

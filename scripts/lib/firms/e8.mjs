/**
 * E8 Markets (futures), lu sur e8futures.com : le configurateur « Configure
 * Your Account in Seconds » de la page d'accueil.
 *
 * Ce que la page est devenue (constate le 2026-10-21, lecture en panne depuis
 * au moins le 2026-10-12) : plus de cartes « ACCOUNT SIZE » par taille, plus de
 * bouton « Configure Challenge » qui les ouvre. A la place :
 *
 *   - trois boutons de programme (E8 Signature / E8 Zero MAX / E8 Zero Starter) ;
 *   - une rangee de tuiles de taille ($25K, $50K, ...), chacune avec son prix
 *     barre puis son prix remise ;
 *   - UN panneau de detail pour la tuile choisie, titre
 *     « E8 Signature · Account · $25K », avec le prix, « Save $30 with code E8 »,
 *     puis CHALLENGE RULES / PERFORMANCE RULES / REWARDS.
 *
 * On clique donc chaque programme, puis chaque tuile, et on lit le panneau.
 * Chaque panneau est RECOUPE : son titre doit nommer le programme et la taille
 * qu'on vient de cliquer (sinon le panneau n'a pas suivi le clic), et quand il
 * annonce « Save $X », prix barre - prix doit faire X. Un desaccord arrete tout
 * plutot que de publier le prix d'une autre taille.
 *
 * Les regles lues ne viennent que de la section CHALLENGE RULES : c'est ce que
 * porte le JSON du site (consistency 40 % des Zero = celle de l'evaluation).
 * La section PERFORMANCE RULES (compte finance : « Daily Pause », consistency
 * 35 % du Signature) n'est pas comparee — le JSON ne dit pas encore s'il doit
 * la montrer, c'est a Angelo de le decider.
 */

export const E8_URL = 'https://e8futures.com';

/** Bouton du configurateur -> nom du programme dans public/data/prop-firms.json. */
export const E8_TABS = {
  'E8 Signature': 'E8 Signature Futures',
  'E8 Zero MAX': 'E8 Zero MAX Futures',
  'E8 Zero Starter': 'E8 Zero Starter Futures',
};

const money = (s) => {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const isMoney = (l) => /^\$[\d,]+(\.\d+)?$/.test(l);

/**
 * Le texte d'une section (« CHALLENGE RULES », ...) jusqu'au prochain titre
 * de section, en lignes non vides. null si la section n'existe pas.
 */
function section(lines, title) {
  const at = lines.findIndex((l) => l.toUpperCase() === title);
  if (at < 0) return null;
  const end = lines.findIndex(
    (l, i) => i > at && /^(CHALLENGE RULES|PERFORMANCE RULES|REWARDS)$/i.test(l),
  );
  return lines.slice(at + 1, end < 0 ? undefined : end);
}

/** La valeur qui suit le premier libelle qui matche `re` dans `lines`. */
function valueAfter(lines, re) {
  const i = lines.findIndex((l) => re.test(l));
  return i < 0 || i + 1 >= lines.length ? undefined : lines[i + 1];
}

/**
 * Un panneau de detail (innerText) -> { tab, programName, size, price,
 * originalPrice, rules }. Leve une erreur si le panneau ne se lit pas : un prix
 * qu'on ne lit pas n'est jamais devine.
 *
 * rules.profitTarget / rules.maxDrawdown sont toujours presents (null si la
 * ligne manque : c'est l'appelant qui decide si c'est casse). rules.consistency
 * vaut le pourcentage de la section CHALLENGE RULES, ou null si elle n'en a pas.
 * rules.contracts n'existe que si une ligne « Max contracts » existe.
 */
export function parseE8Panel(text) {
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const head = lines
    .map((l) => /^(.+?)\s*·\s*Account\s*·\s*\$(\d+)K$/i.exec(l))
    .find(Boolean);
  if (!head) throw new Error('panneau E8 sans titre « <programme> · Account · $<taille>K »');
  const tab = head[1].trim();
  const programName = E8_TABS[tab];
  if (!programName) throw new Error(`programme E8 inconnu dans le titre du panneau : « ${tab} »`);
  const size = parseInt(head[2], 10) * 1000;
  const tag = `${programName} $${size / 1000}K`;

  // Les prix sont les lignes « $n » juste avant « Save $X with code » ou
  // « GET STARTED » : prix barre puis prix remise, ou un seul prix sans remise.
  const stop = lines.findIndex((l) => /^Save \$[\d,]+/i.test(l) || /^GET STARTED$/i.test(l));
  if (stop < 0) throw new Error(`${tag} : ni « Save $X » ni « GET STARTED » dans le panneau`);
  const prices = [];
  for (let i = stop - 1; i >= 0 && isMoney(lines[i]); i--) prices.unshift(money(lines[i]));
  if (prices.length === 0 || prices.length > 2)
    throw new Error(`${tag} : ${prices.length} prix avant le bouton, 1 ou 2 attendus`);
  const price = Math.min(...prices);
  const originalPrice = Math.max(...prices);

  const save = /^Save \$([\d,]+)/i.exec(lines[stop]);
  if (save && originalPrice - price !== money(save[1]))
    throw new Error(
      `${tag} : ${originalPrice} - ${price} ne fait pas les $${money(save[1])} annonces`,
    );

  const challenge = section(lines, 'CHALLENGE RULES');
  if (!challenge) throw new Error(`${tag} : pas de section CHALLENGE RULES`);
  const pt = valueAfter(challenge, /^Profit Target$/i);
  const dd = valueAfter(challenge, /drawdown/i);
  const cons = valueAfter(challenge, /^Consistency rule$/i);
  const rules = {
    profitTarget: pt != null && isMoney(pt) ? money(pt) : null,
    maxDrawdown: dd != null && isMoney(dd) ? money(dd) : null,
    consistency: cons != null && /^\d+%$/.test(cons) ? cons : null,
  };
  if (cons != null && rules.consistency == null) rules.consistencyUnreadable = cons;
  const ct = valueAfter(challenge, /^Max contracts$/i);
  if (challenge.some((l) => /^Max contracts$/i.test(l)))
    rules.contracts = ct != null && /^\d+$/.test(ct) ? { minis: parseInt(ct, 10), micros: null } : undefined;

  return { tab, programName, size, price, originalPrice, rules };
}

/**
 * Ouvre la page, clique chaque programme puis chaque tuile de taille, et rend
 * le texte brut de chaque panneau : [{ tab, tile, text }].
 * `launch` : options passees a chromium.launch (ex. { channel: 'chrome' } en local).
 */
export async function fetchE8Panels(pw, launch = {}) {
  const browser = await pw.chromium.launch({ headless: true, ...launch });
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(E8_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
      .getByText('ACCOUNT CONFIGURATOR', { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });

    const panelText = () =>
      page.evaluate(() => {
        // Le plus petit bloc qui porte le titre du panneau, ses regles et son bouton.
        let best = null;
        for (const el of document.querySelectorAll('div, section')) {
          const t = el.textContent || '';
          if (!/·\s*Account\s*·/.test(t) || !/challenge rules/i.test(t) || !/get started/i.test(t)) continue;
          if (!best || t.length < best.textContent.length) best = el;
        }
        return best ? best.innerText : null;
      });

    // Un clic parti avant que la page ne reagisse est perdu (vu le 2026-10-21 :
    // la premiere tuile cliquee laissait le panneau sur $100K). On attend donc
    // que le titre du panneau annonce ce qu'on a clique, et on reclique une fois.
    const showing = (head) =>
      page
        .waitForFunction(
          (h) => {
            for (const el of document.querySelectorAll('div, section')) {
              if (el.children.length === 0 && (el.textContent || '').replace(/\s+/g, ' ').trim().startsWith(h))
                return true;
            }
            return document.body.innerText.includes(h);
          },
          head,
          { timeout: 5000 },
        )
        .then(() => true, () => false);
    const clickUntil = async (locator, head) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await locator.click({ timeout: 15000 });
        if (await showing(head)) return;
      }
    };

    const out = [];
    for (const tab of Object.keys(E8_TABS)) {
      await clickUntil(page.locator('button:visible', { hasText: tab }).first(), `${tab} · Account ·`);
      // Des tuiles « $25K » cachees existent aussi (vue mobile) : seulement les visibles.
      const tiles = page.locator('button:visible').filter({ hasText: /^\s*(\d+% OFF\s*)?\$\d+K/ });
      const n = await tiles.count();
      if (n === 0) throw new Error(`${tab} : aucune tuile de taille visible`);
      for (let i = 0; i < n; i++) {
        const tile = (await tiles.nth(i).innerText()).replace(/\s+/g, ' ').trim();
        const k = /\$(\d+)K/.exec(tile)?.[1];
        await clickUntil(tiles.nth(i), `${tab} · Account · $${k}K`);
        const text = await panelText();
        if (!text) throw new Error(`${tab} ${tile} : panneau de detail introuvable`);
        out.push({ tab, tile, text });
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

/**
 * Les panneaux bruts -> plans lus, en verifiant que chaque panneau dit bien le
 * programme et la taille de la tuile cliquee.
 */
export function plansFromPanels(panels) {
  const plans = [];
  for (const { tab, tile, text } of panels) {
    const plan = parseE8Panel(text);
    const tileSize = /\$(\d+)K/.exec(tile);
    if (plan.tab !== tab || !tileSize || parseInt(tileSize[1], 10) * 1000 !== plan.size)
      throw new Error(
        `clic sur ${tab} ${tile}, mais le panneau affiche ${plan.tab} $${plan.size / 1000}K`,
      );
    plans.push(plan);
  }
  if (plans.length === 0) throw new Error('aucun plan lu dans le configurateur E8');
  return plans;
}

/** Lecture complete : page -> plans. `launch` : voir fetchE8Panels. */
export async function fetchE8Plans(pw, launch = {}) {
  return plansFromPanels(await fetchE8Panels(pw, launch));
}

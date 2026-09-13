/**
 * Synchronise le CATALOGUE d'une firme, pas seulement ses prix.
 *
 * Le chemin historique de scripts/scrape-prop-firms.mjs (`guard()` + `apply()`)
 * est un metteur a jour de prix : les programmes et les tailles sont figes a la
 * main dans public/data/prop-firms.json, et tout produit que ce fichier ne
 * liste pas n'existe pas sur le site. C'est comme ca que FundedSeat a vendu
 * sept familles pendant que le comparateur en montrait trois, que les comptes
 * « Legacy NYC » de Traders Launch n'ont jamais ete publies, et que les 25K de
 * TradeDay et de Blue Guardian Express manquaient.
 *
 * Ici, ce que rend le LECTEUR de la firme est le catalogue : un programme ou
 * une taille qu'il rend et que le JSON ignore est CREE, un programme ou une
 * taille que le JSON garde et que le lecteur ne vend plus est SUPPRIME (la
 * « Flex » de FundedSeat, retiree en aout, a mis des semaines a disparaitre).
 *
 * La ou ce module refuse de trancher : les regles de risque curatees a la main
 * depuis les help centers. Le lecteur gagne quand il PORTE la cle — y compris
 * quand sa valeur est `null`, qui veut dire « la source dit qu'il n'y a pas de
 * regle ». Quand il OMET la cle, il ne sait pas, et la valeur du JSON reste :
 * c'est ce qui garde `consistency: "15% biggest trade"` sur l'Instant Funding
 * de FundedSeat, une regle que leur API n'encode nulle part. Jamais de `null`
 * a la place d'une valeur que le lecteur ne connait pas.
 */

/**
 * Les champs de regle. Le lecteur les remplace quand il porte la cle, le JSON
 * les garde quand il ne la porte pas.
 */
const RULE_FIELDS = [
  'profitTarget',
  'maxDrawdown',
  'ddType',
  'dailyLoss',
  'dailyLossSoft',
  'consistency',
  'contracts',
  'activationFee',
  'maxPayout',
  'minPayout',
  'resetFee',
  'note',
];

/**
 * Les champs que le lecteur possede entierement : il les ecrit quand il les
 * rend, et leur absence est une information (plus de prix barre, plus
 * d'ambiguite de prix), donc la cle disparait du JSON.
 *
 * `priceAmbiguous` / `variants` : chez FundedSeat un meme nom est actif a
 * plusieurs prix en meme temps (« Daily Ultra (35%) - 100K » a $264.50, $297.50
 * et $451.50). Le lecteur publie le moins cher et dit que ce n'est pas le seul ;
 * ce fait se garde tel quel plutot que de se taire.
 */
const READER_OWNED = ['originalPrice', 'priceAmbiguous', 'variants'];

/** L'ordre des cles d'un plan cree, pour que le JSON reste lisible en diff. */
const PLAN_KEY_ORDER = ['size', 'price', 'originalPrice', ...RULE_FIELDS, 'priceAmbiguous', 'variants'];

const sizeTag = (size) => `$${size / 1000}K`;

/** Une valeur dans une ligne de changement : les nombres nus, le reste cite. */
const show = (v) => (typeof v === 'number' || v == null ? String(v) : JSON.stringify(v));

/**
 * Les memes garde-fous numeriques que `guard()`, plus deux garde-fous de
 * catalogue : un lecteur qui ne rend rien, ou qui rend moins de la moitie des
 * plans deja publies, a lu une page partielle — ce n'est pas un catalogue qui
 * a fondu, et on ne supprime pas la moitie du comparateur la-dessus.
 *
 * @param {{name: string, programs: Array}} firm  la firme telle qu'elle est dans le JSON
 * @param {Array} programs  ce que rend le lecteur
 * @throws  des que publier serait pire que garder les anciennes donnees
 */
export function guardCatalog(firm, programs) {
  if (!Array.isArray(programs) || programs.length === 0) {
    throw new Error('le lecteur ne rend aucun programme — catalogue refuse');
  }

  let plansRead = 0;
  for (const program of programs) {
    if (!program?.name) throw new Error('un programme sans nom dans la lecture');
    if (!Array.isArray(program.plans) || program.plans.length === 0) {
      throw new Error(`${program.name}: aucun plan lu`);
    }
    for (const plan of program.plans) {
      if (!Number.isFinite(plan.size) || plan.size <= 0) {
        throw new Error(`${program.name}: un plan sans taille lisible (${plan.size})`);
      }
      const tag = `${program.name} ${sizeTag(plan.size)}`;
      if (!Number.isFinite(plan.price)) throw new Error(`${tag}: non-numeric price`);
      if (plan.price < 10 || plan.price > 6000) {
        throw new Error(`${tag}: price ${plan.price} out of range [10, 6000]`);
      }
      if (plan.originalPrice != null) {
        if (!Number.isFinite(plan.originalPrice)) {
          throw new Error(`${tag}: non-numeric originalPrice`);
        }
        if (plan.price > plan.originalPrice) {
          throw new Error(`${tag}: price ${plan.price} > originalPrice ${plan.originalPrice}`);
        }
      }
      plansRead++;
    }
  }

  const plansPublished = firm.programs.reduce((n, p) => n + p.plans.length, 0);
  if (plansRead * 2 < plansPublished) {
    throw new Error(
      `le lecteur rend ${plansRead} plans la ou le JSON en publie ${plansPublished} — ` +
        'page partielle, pas un catalogue reduit',
    );
  }
}

/** Un plan neuf, dans l'ordre de cles du dataset. */
function newPlan(read) {
  const plan = {};
  for (const key of PLAN_KEY_ORDER) {
    if (!(key in read)) continue;
    if (READER_OWNED.includes(key) && read[key] == null) continue; // rien a dire
    plan[key] = read[key];
  }
  return plan;
}

/** Un plan deja publie, mis a jour champ par champ. Rend le nombre de changements. */
function mergePlan(plan, read, tag, changes) {
  if (plan.price !== read.price) {
    changes.push(`${tag}: price ${show(plan.price)} -> ${show(read.price)}`);
    plan.price = read.price;
  }

  for (const key of READER_OWNED) {
    const value = key in read ? read[key] : null;
    if (value == null) {
      if (plan[key] != null) {
        changes.push(`${tag}: ${key} ${show(plan[key])} -> aucun`);
        delete plan[key];
      } else if (key in plan) {
        delete plan[key]; // un null explicite ne dit rien de plus qu'une cle absente
      }
      continue;
    }
    if (JSON.stringify(plan[key]) !== JSON.stringify(value)) {
      changes.push(`${tag}: ${key} ${show(plan[key])} -> ${show(value)}`);
      plan[key] = value;
    }
  }

  for (const key of RULE_FIELDS) {
    if (!(key in read)) continue; // le lecteur ne sait pas : la regle curatee reste
    if (plan[key] !== read[key]) {
      changes.push(`${tag}: ${key} ${show(plan[key])} -> ${show(read[key])}`);
      plan[key] = read[key];
    }
  }
}

/**
 * Ecrit le catalogue lu dans la firme, en place.
 *
 * @param {{name: string, programs: Array}} firm  mutee
 * @param {Array} programs  ce que rend le lecteur, deja passe par guardCatalog()
 * @param {string[]} changes  les lignes lisibles du journal, completees ici
 */
export function syncCatalog(firm, programs, changes) {
  const published = new Map(firm.programs.map((p) => [p.name, p]));
  const kept = [];

  for (const read of programs) {
    let program = published.get(read.name);
    if (!program) {
      program = { name: read.name, type: read.type, priceType: read.priceType, plans: [] };
      changes.push(
        `${firm.name}: programme « ${read.name} » ajoute (${read.plans.length} taille${
          read.plans.length > 1 ? 's' : ''
        })`,
      );
    } else {
      published.delete(read.name);
      for (const key of ['type', 'priceType']) {
        if (read[key] != null && program[key] !== read[key]) {
          changes.push(`${firm.name} / ${read.name}: ${key} ${show(program[key])} -> ${show(read[key])}`);
          program[key] = read[key];
        }
      }
    }

    const plansBySize = new Map(program.plans.map((pl) => [pl.size, pl]));
    const plans = [];
    for (const readPlan of read.plans) {
      const tag = `${firm.name} / ${read.name} ${sizeTag(readPlan.size)}`;
      let plan = plansBySize.get(readPlan.size);
      if (!plan) {
        plan = newPlan(readPlan);
        if (program.plans.length > 0) changes.push(`${tag}: plan ajoute`);
      } else {
        plansBySize.delete(readPlan.size);
        mergePlan(plan, readPlan, tag, changes);
      }
      plans.push(plan);
    }
    for (const gone of plansBySize.values()) {
      changes.push(`${firm.name} / ${read.name} ${sizeTag(gone.size)}: plan retire`);
    }

    program.plans = plans; // l'ordre du lecteur fait foi
    kept.push(program);
  }

  for (const gone of published.values()) {
    changes.push(`${firm.name} / ${gone.name}: programme retire`);
  }

  firm.programs = kept;
}

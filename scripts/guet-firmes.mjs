#!/usr/bin/env node
/**
 * Guet des firmes : chaque jour, ce qui a changé dans les offres et les règles des firmes, une alerte Discord
 * seulement quand quelque chose change (rien = silence). Logique : scripts/lib/guet-firmes.mjs.
 *
 *  - Offres : les JSON que la synchro du site commite chaque jour (l'historique git EST le relevé) ; on compare la
 *    version vue au tour d'avant (état) à celle de --ref.
 *  - Pages de règles : les URL citées par les fichiers de règles propsim que le runner simule (Apex, FundedNext,
 *    Lucid, Tradeify) et par celui du banc Vest ; lues par curl_cffi depuis une IP de maison (Cloudflare). Le guet ne
 *    modifie JAMAIS un fichier de règles.
 *
 * Usage :
 *   node scripts/guet-firmes.mjs                       # un tour, AUCUN envoi : alerte écrite dans l'aperçu
 *   node scripts/guet-firmes.mjs --envoyer             # un tour, alerte envoyée dans #runner (chemin du runner)
 *   node scripts/guet-firmes.mjs --de <rev> --a <rev>  # rejoue les offres entre deux commits (sans état, sans pages)
 *   node scripts/guet-firmes.mjs --rebase-pages        # relit les pages, enregistre la référence, aucune alerte, aucun envoi
 *   options : --depot <dossier git du site> --ref <rev> --etat <dossier> --apercu <fichier> --sans-pages --sans-prix
 *
 * Premier tour : rien n'est signalé, l'état de départ est enregistré (commit des offres, empreinte de chaque page).
 * L'état est écrit AVANT l'envoi : un envoi raté est noté dans l'aperçu (envoye=false), jamais renvoyé.
 */
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cfFetch } from './lib/cf-fetch.mjs';
import {
  FICHIERS_OFFRES,
  FIRME_DU_DOSSIER,
  baseVest,
  blocsOffres,
  blocsPages,
  differences,
  messages,
  pagesARelire,
  suivrePage,
  journalEchecEnvoi,
  texteDePage,
  texteRetenu,
  titreDePage,
  urlCanonique,
} from './lib/guet-firmes.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const HOME = os.homedir();

/* Où vivent les sources (relevé du 26/11/2026). Les fichiers de règles se lisent, jamais ne s'écrivent. */
const RACINES_REGLES = [
  // propsim des comptes du runner (seul à connaître les paliers ; règles Apex, FundedNext, Lucid, Tradeify)
  path.join(HOME, '.local/share/runner-auto/propsim-paliers/rules'),
  // propsim du juge Tradeify (ASUS, copie Mac)
  path.join(HOME, '.local/share/research-lab-tradeify/propsim/rules'),
  // propsim d'origine (règles Lucid)
  path.join(HOME, '.local/share/research-lab/trading-bots/propsim/rules'),
];
const VEST = { depot: path.join(HOME, 'monfxreplay-python'), branche: 'btc-vest', regles: 'modeles/btc-vest/vest_capital_10k_1step.json', plan: 'modeles/btc-vest/PLAN.md' };
const CATALOGUE_FUNDEDNEXT = path.join(HOME, 'pipeline-v2-boucle/fundednext/articles.json');
const CATALOGUE_APEX = path.join(HOME, 'pipeline-v2-boucle/apex/help_urls.txt');
const ENVOI_PY = path.join(ICI, 'lib/guet-envoi.py');
const PYTHON_ENVOI = process.env.GUET_PYTHON || path.join(HOME, 'monfxreplay-python/.venv/bin/python');

export function args(argv) {
  const o = { depot: path.resolve(ICI, '..'), ref: 'HEAD', etat: path.join(HOME, '.local/share/guet-firmes'), envoyer: false, pages: true, prix: true, rebasePages: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} attend une valeur`);
      return argv[++i];
    };
    if (a === '--depot') o.depot = path.resolve(val());
    else if (a === '--ref') o.ref = val();
    else if (a === '--etat') o.etat = path.resolve(val());
    else if (a === '--apercu') o.apercu = path.resolve(val());
    else if (a === '--envoyer') o.envoyer = true;
    else if (a === '--sans-pages') o.pages = false;
    else if (a === '--sans-prix') o.prix = false;
    else if (a === '--de') o.de = val();
    else if (a === '--a') o.a = val();
    else if (a === '--rebase-pages') o.rebasePages = true;
    else throw new Error(`option inconnue : ${a}`);
  }
  if ((o.de && !o.a) || (!o.de && o.a)) throw new Error('--de et --a vont ensemble');
  if (o.rebasePages) {
    o.envoyer = false; // aucune alerte, donc aucun envoi
    o.pages = true;
  }
  o.apercu ??= path.join(o.etat, 'apercu.jsonl');
  return o;
}

const git = (depot, ...a) => execFileSync('git', ['-C', depot, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function jsonAuCommit(depot, rev, chemin) {
  try {
    return JSON.parse(git(depot, 'show', `${rev}:${chemin}`));
  } catch {
    return null; // fichier absent à ce commit
  }
}

function donneesAuCommit(depot, rev) {
  return Object.fromEntries(FICHIERS_OFFRES.map(({ chemin }) => [chemin, jsonAuCommit(depot, rev, chemin)]));
}

const commitDe = (depot, rev) => git(depot, 'rev-parse', `${rev}^{commit}`).trim();
const dateDe = (depot, rev) => git(depot, 'show', '-s', '--format=%cs', rev).trim();
const court = (sha) => sha.slice(0, 7);
const jjmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '?');

/* ------------------------------------------------------------------ */
/* Fichiers de règles                                                  */
/* ------------------------------------------------------------------ */

function lireJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

/** [{ dossier, fichier, nom, note, prix }] : les dossiers des firmes suivies, la 1re racine gagne sur un doublon. */
function chargerRegles() {
  const vus = new Map();
  for (const racine of RACINES_REGLES) {
    for (const dossier of Object.keys(FIRME_DU_DOSSIER)) {
      const d = path.join(racine, dossier);
      if (!fs.existsSync(d)) continue;
      for (const fichier of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
        const cle = `${dossier}/${fichier}`;
        if (vus.has(cle)) continue;
        const j = lireJson(path.join(d, fichier));
        if (!j || typeof j !== 'object') continue;
        vus.set(cle, { dossier, fichier, nom: j.name || '', note: j.note || '', prix: j.costs?.price_usd ?? null });
      }
    }
  }
  try {
    const j = JSON.parse(git(VEST.depot, 'show', `${VEST.branche}:${VEST.regles}`));
    vus.set(`vest/${path.basename(VEST.regles)}`, { dossier: 'vest', fichier: path.basename(VEST.regles), nom: j.name || '', note: j.note || '', prix: j.costs?.price_usd ?? null });
  } catch (e) {
    console.error(`règles Vest illisibles (${VEST.depot} ${VEST.branche}:${VEST.regles}) : ${e.message.split('\n')[0]}`);
  }
  return [...vus.values()];
}

function sourcesDesPages() {
  const fn = lireJson(CATALOGUE_FUNDEDNEXT) || {};
  const catalogueFundedNext = {};
  for (const u of Object.keys(fn)) {
    const m = u.match(/\/articles\/(\d+)/);
    if (m) catalogueFundedNext[m[1]] = urlCanonique(u);
  }
  let catalogueApex = [];
  try {
    catalogueApex = fs.readFileSync(CATALOGUE_APEX, 'utf8').split('\n').map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x));
  } catch {
    console.error(`catalogue Apex illisible : ${CATALOGUE_APEX}`);
  }
  let base = null;
  try {
    base = baseVest(git(VEST.depot, 'show', `${VEST.branche}:${VEST.plan}`));
  } catch {
    console.error(`plan Vest illisible : ${VEST.depot} ${VEST.branche}:${VEST.plan}`);
  }
  return { catalogueFundedNext, catalogueApex, baseVest: base };
}

/* ------------------------------------------------------------------ */
/* État, aperçu, envoi                                                 */
/* ------------------------------------------------------------------ */

function lireEtat(dossier) {
  return lireJson(path.join(dossier, 'etat.json')) || { version: 1, offres: null, pages: {} };
}

function ecrireEtat(dossier, etat) {
  fs.mkdirSync(dossier, { recursive: true });
  const f = path.join(dossier, 'etat.json');
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(etat, null, 1));
  fs.renameSync(`${f}.tmp`, f);
}

function noterApercu(fichier, texte, mode, envoye) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.appendFileSync(fichier, `${JSON.stringify({ quand: new Date().toISOString(), mode, envoye, texte })}\n`);
}

/**
 * Envoie par le chemin des bots du runner (scripts/lib/guet-envoi.py) ; rend un booléen par message.
 * opt.journal reçoit la ligne d'erreur (stderr de guet-envoi.py) quand l'envoi échoue : c'est le journal du tour.
 */
export function envoyer(textes, opt = {}) {
  const python = opt.python || PYTHON_ENVOI;
  const script = opt.script || ENVOI_PY;
  const salon = opt.salon || 'runner';
  const journal = opt.journal || ((ligne) => console.error(ligne));
  return new Promise((resolve) => {
    const p = execFile(
      python,
      [script, '--salon', salon],
      {
        encoding: 'utf8',
        timeout: 5 * 60_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONPATH: process.env.RUNNER_CODE || path.join(HOME, '.local/share/runner-auto/code') },
      },
      (err, stdout, stderr) => {
        let ok = null;
        try {
          const r = JSON.parse(String(stdout || '').trim().split('\n').pop());
          if (Array.isArray(r) && r.length === textes.length) ok = r.map(Boolean);
        } catch {}
        if (!ok) ok = textes.map(() => false);
        if (err || ok.some((x) => !x)) journal(journalEchecEnvoi(stderr, err));
        resolve(ok);
      },
    );
    p.stdin.on('error', () => {});
    p.stdin.end(JSON.stringify(textes));
  });
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

const sha = (algo, s) => crypto.createHash(algo).update(s).digest('hex');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Texte enregistré au tour d'avant : « url\n\ntexte\n ». */
function texteSauve(fichier) {
  try {
    const brut = fs.readFileSync(fichier, 'utf8');
    const i = brut.indexOf('\n\n');
    if (i < 0) return null;
    return brut.slice(i + 2).replace(/\n$/, '');
  } catch {
    return null;
  }
}

async function lirePage(url) {
  try {
    const { status, text } = await cfFetch(url, { timeoutMs: 30_000 });
    if (status >= 200 && status < 300) return { statut: status, texte: texteDePage(text), titre: titreDePage(text) };
    return { statut: status };
  } catch (e) {
    return { statut: null, erreur: e.message.split('\n')[0] };
  }
}

async function guetPages(etat, dossierEtat, quand, { rebase = false } = {}) {
  const regles = chargerRegles();
  const pages = pagesARelire(regles, sourcesDesPages());
  const dossierTextes = path.join(dossierEtat, 'pages');
  fs.mkdirSync(dossierTextes, { recursive: true });
  const changements = [];
  const bilan = { lues: 0, echecs: [], absentes: [] };
  for (const url of [...pages.keys()].sort()) {
    const { firme, fichiers } = pages.get(url);
    const lu = await lirePage(url);
    const empreinte = typeof lu.texte === 'string' ? sha('sha256', lu.texte) : null;
    const ancien = etat.pages[url] || null;
    const { etat: nouveau, evenement } = suivrePage(ancien, lu, empreinte, quand, { rebase });
    nouveau.firme = firme;
    etat.pages[url] = nouveau;
    const f = path.join(dossierTextes, `${sha('sha1', url).slice(0, 16)}.txt`);
    const texteAvant = evenement === 'texte' ? texteSauve(f) : null;
    if (texteRetenu(lu, nouveau)) {
      bilan.lues++;
      if (evenement === 'texte' && fs.existsSync(f)) fs.copyFileSync(f, f.replace(/\.txt$/, `.avant-${quand.slice(0, 10)}.txt`));
      fs.writeFileSync(f, `${url}\n\n${lu.texte}\n`);
    } else if (lu.statut === 404 || lu.statut === 410) bilan.absentes.push(`${url} (HTTP ${lu.statut})`);
    else bilan.echecs.push(`${url} (${nouveau.derniereErreur || lu.erreur || 'page illisible'})`);
    if (evenement && !rebase) {
      const ch = { url, firme, evenement, titre: nouveau.titre, statut: lu.statut, fichiers };
      if (evenement === 'texte' && typeof texteAvant === 'string') {
        ch.texteAvant = texteAvant;
        ch.texteApres = lu.texte;
      }
      changements.push(ch);
    }
    await pause(400);
  }
  return { changements, bilan, total: pages.size };
}

/* ------------------------------------------------------------------ */
/* Tour                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const o = args(process.argv.slice(2));
  const quand = new Date().toISOString();
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  if (o.rebasePages) {
    // Nouvelle extraction seulement : la référence des pages est réécrite, rien n'est signalé ni envoyé.
    const etat = lireEtat(o.etat);
    const { bilan, total } = await guetPages(etat, o.etat, quand, { rebase: true });
    ecrireEtat(o.etat, etat);
    console.log(`rebase des pages : ${total} à relire, ${bilan.lues} références enregistrées, ${bilan.absentes.length} absentes (404/410), ${bilan.echecs.length} non lues, aucune alerte, aucun envoi`);
    for (const x of bilan.absentes) console.log(`  absente : ${x}`);
    for (const x of bilan.echecs) console.log(`  non lue : ${x}`);
    return;
  }
  const regles = o.prix ? chargerRegles() : [];
  const sections = [];

  if (o.de) {
    // Rejeu : offres seules, entre deux commits, sans toucher à l'état.
    const [de, a] = [commitDe(o.depot, o.de), commitDe(o.depot, o.a)];
    const blocs = blocsOffres(differences(donneesAuCommit(o.depot, de), donneesAuCommit(o.depot, a)), regles);
    if (blocs.length) sections.push(`Offres du site (données ${court(de)} du ${jjmm(dateDe(o.depot, de))} → ${court(a)} du ${jjmm(dateDe(o.depot, a))})`, ...blocs);
  } else {
    const etat = lireEtat(o.etat);
    if (o.prix) {
      const nouveau = commitDe(o.depot, o.ref);
      const ancien = etat.offres?.commit;
      let lisible = false;
      if (ancien && ancien !== nouveau) {
        try {
          commitDe(o.depot, ancien);
          lisible = true;
        } catch {
          console.error(`commit ${ancien} absent du dépôt : nouveau départ à ${court(nouveau)}, rien de signalé`);
        }
      }
      if (lisible) {
        const blocs = blocsOffres(differences(donneesAuCommit(o.depot, ancien), donneesAuCommit(o.depot, nouveau)), regles);
        if (blocs.length) sections.push(`Offres du site (données ${court(ancien)} du ${jjmm(dateDe(o.depot, ancien))} → ${court(nouveau)} du ${jjmm(dateDe(o.depot, nouveau))})`, ...blocs);
      }
      console.log(ancien ? `offres : ${court(ancien)} → ${court(nouveau)}` : `offres : état de départ ${court(nouveau)}`);
      etat.offres = { commit: nouveau, date: dateDe(o.depot, nouveau), vuLe: quand };
    }
    if (o.pages) {
      const { changements, bilan, total } = await guetPages(etat, o.etat, quand);
      console.log(`pages : ${total} à relire, ${bilan.lues} lues, ${bilan.absentes.length} absentes (404/410), ${bilan.echecs.length} non lues`);
      for (const x of bilan.absentes) console.log(`  absente : ${x}`);
      for (const x of bilan.echecs) console.log(`  non lue : ${x}`);
      const blocs = blocsPages(changements);
      if (blocs.length) sections.push('Pages de règles (lues depuis la maison)', ...blocs);
    }
    ecrireEtat(o.etat, etat); // AVANT l'envoi : jamais deux fois la même alerte
  }

  if (!sections.length) {
    console.log('rien de changé : aucune alerte');
    return;
  }
  const textes = messages(`Guet des firmes · ${aujourdhui}`, sections);
  if (!o.envoyer) {
    for (const t of textes) noterApercu(o.apercu, t, 'apercu', null);
    console.log(`aperçu (aucun envoi) : ${textes.length} message(s) dans ${o.apercu}\n`);
    console.log(textes.join('\n\n-----\n\n'));
    return;
  }
  const ok = await envoyer(textes);
  textes.forEach((t, i) => noterApercu(o.apercu, t, 'envoi', ok[i]));
  console.log(`envoi #runner : ${ok.filter(Boolean).length}/${textes.length} message(s) livrés`);
  if (!ok.every(Boolean)) process.exitCode = 1;
}

const lanceDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lanceDirect) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}

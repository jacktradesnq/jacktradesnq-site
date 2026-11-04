@/Users/angelo/obsidian-mind/work/active/jacktradesnq/jacktradesnq.md

# jacktradesnq.com — design & code rules

## Stack
- Next.js 15 App Router + TypeScript + Tailwind v4 (static export `output: 'export'`)
- CSS pur dans app/globals.css (tokens OKLCH + import Fontshare)
- Animations : Framer Motion (reveal) + GSAP ScrollTrigger (parallax scroll)
- Déploiement Cloudflare Pages via GitHub Actions (npm run build → deploy out/)
- Client Components isolés pour JS interactif (prairieBackground, HeroReveal)

## Direction esthétique déclarée (ne PAS dévier)
**dark editorial site-objet** (home + page partenaire, refonte 2026-05-25).
- Fond noir chaud brun (`oklch(0.12-0.16`), accent **gold unique** (`oklch(0.78-0.80 0.14 ~80`)
- Wordmark Zodiak monumental + canvas candlesticks infini en fond (mask radial au centre)
- Ton : éditorial, magazine, premium ; pas de funnel marketing agressif
- Point mémorable : wordmark géant + point doré (leitmotiv de marque) + bougies live
- Anti-objectif explicite : ne PAS faire un link-in-bio déguisé ni un funnel de vente type Whop
- La refonte dark couvre home + `/nefarious/` (+ `/prop-firms/`), CSS scopé sous `.jtnq-home` / `.jtnq-nef` ; globals.css ne garde que la base (polices, tokens, pages légales).
- (Ancienne direction warm-editorial prairie Kazuo Oga = abandonnée 2026-05-25, conservée nulle part.)

## Typographie (OBLIGATOIRE)
- Tout le texte du site : **Satoshi**, sans italique, sans majuscules forcées ni lettres espacées, petits textes à 14 px et clairs (Angelo, 02/11/2026 : « le texte est weird », puis sur l'essai : « oui ca em fait », « ce type de tedxt sah on le fait partout sur min site »). Il garde les couleurs (« On pourrait garder la couleur »).
- Grand titre de page : **Zodiak** (droit, gras), seule exception.
- Fonts self-hosted dans public/fonts/ (fix COEP — JAMAIS de CDN Google Fonts / Fontshare)
- Inter reste banni (cf anti-slop).

## Couleurs (OKLCH uniquement, pas de hex dans les composants)
3 couches : primitive (valeurs OKLCH brutes) → semantic (bg, fg, card, primary, muted, border, ring) → component overrides.

## Spacing (4pt grid strict)
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 — jamais 13px / 27px.

## Radius (pillowy, direction unique)
4px (inputs) / 12px (cards) / 999px (CTA pills).

## Anti-slop rules (non-négociables)
- JAMAIS : Inter, Roboto, Arial, Open Sans, Lato, Space Grotesk, system-ui seul
- JAMAIS : gradient violet→rose, purple-on-white
- JAMAIS : 3 cards emoji icons + "Fast / Secure / Scalable"
- JAMAIS : "Get Started" + "Learn more" ghost centered hero
- JAMAIS : lorem ipsum
- JAMAIS : emoji en remplacement d'icônes UI
- JAMAIS : ombre noire plate — toujours layered OKLCH alpha
- JAMAIS : mélange glassmorphism + neubrutalism dans un écran

## I18n
Tout en anglais SAUF footer légal FR (mentions légales + disclaimer AMF D.321-1 + confidentialité) pour conformité française.

## Accessibilité
- Focus ring global `:focus-visible`
- Contraste WCAG AA (4.5:1 body, 3:1 large)
- Reduced-motion honoré
- Semantic HTML

## Workflow
- Branche dédiée par feature (JAMAIS main)
- 1 fix = 1 vérif visuelle avant commit
- Changement visible du site : je l'ouvre en localhost dans son Chrome (onglet 9223 activé devant lui), puis son ok AVANT le merge (Angelo 12/10/2026 : « bah brother tu mas même pas montrer avant de merge »). Jamais une capture à la place (25/10/2026 : « Tu envoies une photo au lieu de l'ouvrir en localhost. C'est pas logique […] Personne veut de tes putains de photos »). Règle propre au site : elle ne vaut pas pour ClipForge (22/10 : « Clipforge, je m'en fous du visuel »).
- Après merge : purge Cloudflare cache via dashboard
- Angelo copy-colle les specs depuis le Claude principal vers ce CLI

---

## Etat (2026-05-09)

- Branche active : `main`
- Dernier commit : `d5c99dd` 2026-05-09 — fix(interactive): button style + label to match other PDF CTAs
- Uncommitted changes : non — clean

---

## Features livrées (DO NOT re-implement)

### Site core
- Home page (app/page.tsx) : refonte dark editorial site-objet 2026-05-25 (hero canvas candlesticks + wordmark Fraunces, hub Nefarious + Prop firms, socials icônes footer). Ancien hero prairie remplacé.
- Page partenaire (app/nefarious/page.tsx) : Nefarious, testimonials Whop verbatim + Join CTA Discord (2026-05-25)
- Layout global (app/layout.tsx) : nav + hamburger mobile wired (commit `3fac707`), theme-color + apple-touch-icon (commit `b591231`)
- OG image 1200x630 (public/og-image.png, commit `6854b17`)
- Fonts self-hosted Fraunces + Satoshi (public/fonts/, commit `67af186`)
- Font preload dans layout (commit `b591231`)
- CSP headers : script-src unsafe-inline + connect-src 'self' pour RSC payloads (commit `756fdaf`)
- noindex sur RSC .txt payloads (commit `bc67ec3`)
- Trailing slash sur tous les Links internes (commit `a3dd397`)
- Pages legales : /mentions-legales + /politique-confidentialite

---

## Branches locales non-mergees (2026-05-09)

| branche | derniere activite | note |
|---------|-------------------|------|
| feat/discord-partner | 2026-05-01 | Nefarious Discord partner card |
| feat/forcesweep-data-card | 2026-05-08 | ForceSweep data entry |
| feat/globex-ib-data-card | 2026-05-08 | Globex IB data entry |
| feat/ib50-zinc-variants | 2026-05-08 | IB50 Mr Zinc variants |
| feat/interactive-pdf-builder | 2026-05-09 | StraddleExplorer PDF — partiellement sur main |
| feat/news-830-rewrite-fixes | 2026-05-08 | news-830 fixes apres rewrite engine |
| feat/news-830-setup | 2026-05-08 | setup initial news-830 entry |
| feat/nfp-feb-2026-fix | 2026-05-07 | NFP Feb 2026 delayed release |
| feat/panda-mascot | 2026-05-09 | Panda mascot interactive (non mergee) |
| feat/pro-redesign | 2026-04-27 | Redesign pro (abandonne ?) |
| feat/strategies-page | 2026-05-01 | Page strategies (WIP) |
| feat/wins-losses-cols | 2026-05-07 | Wins/Losses cols straddle |
| fix/swap-cpi-nfp-pdfs | 2026-05-09 | Fix PDF CPI/NFP swap |
| revert/remove-news-830-public | 2026-05-09 | Revert temporaire news-830 |

---

## Commandes utiles

```bash
npm run dev       # dev server localhost:3000
npm run build     # static export -> out/
npm start         # serve out/ (preview)
npx tsc --noEmit  # type check sans build
npm test          # tests scripts/ (lances aussi par la CI)
```

Deploy : push sur `main` -> GitHub Actions -> Cloudflare Pages auto.

---

## Gotchas

- /prop-firms reprend TOUT ce que la firme publie sur son propre site (plans, splits, prix, règles), sans demander à Angelo plan par plan (21/10/2026 : « tant que y a sur leur site faut que ca sois sur nôtre site aussi »). Une nouvelle firme affiliée qu'il mentionne s'ajoute à la page (Vest Markets, 21/10). Le code imprimé est JTNQ partout où il marche tapé au checkout, même si le lien porte déjà la remise (Traders Launch, 21/10).
- La meilleure remise que la firme affiche (bannière, prix barré, code public) s'attribue à JTNQ : « 20% off with code JTNQ », jamais une remise affichée sans le code, jamais une question ni un test au checkout (Angelo, 11/10/2026 : « part du principe que mon code est bien partout. C'est juste logique » ; rappelé le 26/10/2026 sur le TL Drop #2 : « on a le même prix genre entre le code public et mon code »).
- /prop-firms ne mentionne pas une règle qui n'existe pas : pas de « No daily loss limit », pas de « Not published », la ligne disparaît (Angelo, 21/10/2026 : « si y a pas de daily loss limit ne le mentionne pas », « pourquoi mettre un truc qui n'existe pas ? […] Tu ne le mentionnes pas, tu t'en fous »). Une ligne s'affiche dès qu'une firme a une vraie valeur sur au moins un plan.
- Détail de cette règle (Angelo, 22/10/2026) : « Winning days: None » sort dès que le rythme de payout est écrit (« si c écrit daily payout c bon ») ; « Payout cap: None » reste sauf si « uncapped payouts » est déjà écrit (« si y a pas uncapped payout, payout cap c bien ») ; « Consistency None » reste (« conssitency none nan en vrai laisse ») ; « No time limit / No consistency rule / No minimum trading days » restent s'ils ne sont pas répétés partout (« tant que c pas repeter la même chose PARTOUT ») ; « No activation fee » reste (« c important ») ; pas de profit target ni de daily loss affiché sur un compte instant qui n'en a pas ; une éval 2-step sans consistency ni minimum de jours = « One-day pass per step ».
- Comparateur « Prop compare » (app/prop-firms/compare/, Angelo, 01/11/2026), décisions une par ligne :
  - Aucun classement (contrats partenaires) : ordre par défaut alphabétique firme puis taille, aucun badge best/cheapest/recommended/popular, aucune firme mise en couleur ou en avant, mêmes colonnes pour toutes ; le visiteur trie lui-même en cliquant un en-tête (Angelo, 01/11/2026).
  - Colonnes et filtres = ceux de la page Challenges de PropFirmMatch sans Popularity, Loyalty pts, ROI Index ; Futures et Perps = deux tableaux séparés, chacun ses colonnes (liste perps relue sur propfirmmatch.com le 01/11/2026, dans compare/columns.ts) ; filtres Size, Steps, Price (budget max), Apply discount, Customize (Angelo, 01/11/2026).
  - Plus de colonne « Last checked » (tableau et cartes téléphone) ; lastChecked reste dans les données (prix datés d'une firme en retard, « stale ») (Angelo, 01/11/2026 : « pas besoin de ça »).
  - Payout frequency : un seul mot par sens, « Daily » pour une fois par jour (Every day, Once per day, Daily from day one), « On demand » pour à tout moment (Any time…, On Demand), « 5 winning days » pour 5 jours gagnants au-dessus d'un minimum avant chaque payout (Tradeify Growth, Lucid Flex) ; la normalisation se fait à un seul endroit (payoutFreqVal dans firm-view.ts, appliquée par futures et perps), les données gardent les mots de la firme, la phrase entière de la firme reste au survol (les conditions « from day one », « with no open position », « no cap » y restent) ; deux sens différents ne partagent jamais un mot (« 5 days to payout » = délai avant le 1er payout ; Tradeify Lightning « 5 Days », sans règle de jours gagnants, s'affiche « Every 5 days », sa carte dit « Payout Frequency 5 Days ») (Angelo, 01/11/2026 : « je préfère que les mêmes appellations soient le même mot »).
  - Même règle sur TOUT le comparateur (Angelo, 01/11/2026) : un format par sens et par colonne, écrit à un seul endroit (lib/compare-words.mjs, appliqué par cellVal de firm-view.ts pour futures et perps), les données gardent les mots de la firme, la phrase d'origine au survol quand du sens tombe : Max contracts « X minis or Y micros » (« 1 mini ») ; Max payout le $ sur chaque montant, cap BluSky « $X in any 7 days » ; Profit split « 80% (90% option) » (Vest « 80% / 90% ») ; Daily loss « 3% or none », « 3%, 4% or none » ; Consistency « 35% » (« best day » au survol) ; jour gagnant « (… minimum per day) » ; une ligne = une taille, une phrase qui liste toutes les tailles avec les tailles écrites à la fin (« (25K / 50K / 100K / 150K) ») ne montre que la valeur de la sienne, sinon elle reste entière (jamais de correspondance devinée).
  - « On demand » s'affiche, E8 compris : Angelo, 01/11/2026 : « garde on demand payout, en fait ça se dit » (lève son « enlève le on demand payout » du 12/10/2026).
  - Filtres en plus dans la barre du haut, pas de barre latérale : Firm (une ou plusieurs ; une seule firme = #compare=<firm-id>), Max loss type (les libellés de la colonne, tirés des données), Daily loss limit (Any / With / Without ; un plan vendu avec et sans passe les deux, un plan dont la règle n'est pas publiée ne passe ni l'un ni l'autre) ; sur téléphone dans « Filters », « Clear filters » les remet à zéro (Angelo, 01/11/2026).
  - Données : uniquement les JSON du site, rien copié de PropFirmMatch ; valeur absente = « — », règle que la firme dit ne pas avoir = « None » ; champs programme optionnels steps / split / payoutFrequency / maxPayout / minPayout / evalConsistency / fundedConsistency, à défaut ce que l'existant porte déjà, jamais de valeur inventée (Angelo, 01/11/2026).
  - Firmes non affiliées (public/data/compare-extra-firms.json, "affiliate": false, Lucid Trading et Tradeify) : seulement dans le comparateur, bouton vers leur site officiel, leur code public tel quel ; les affiliées gardent JTNQ et leurs liens /go/ (Angelo, 01/11/2026).
  - Code public expiré (promo.ends passé dans compare-extra-firms.json) : le comparateur n'affiche plus ni le code ni les prix remisés (prix catalogue, sans barré), au build et dans le navigateur (lib/promo-ends.mjs + promo-clock.ts, la même horloge que les promos perps) ; Tradeify est relu chaque jour par scripts/scrape-tradeify.mjs dans update-prop-firms.yml (code, date de fin, 12 prix), page illisible ou moins de 12 prix = firme stale + job rouge ; Lucid reste à la main (403 Cloudflare) (Angelo, 01/11/2026 : « quand c'est expiré check tous les jours jusqu'à ce qu'il y ait le bon code »).
  - Disclaimer : les firmes qui affichent le code JTNQ sont affiliées (commission sur les inscriptions avec JTNQ), une firme sans code JTNQ ne l'est pas ; le reste (AMF D.321-1) inchangé (Angelo, 01/11/2026).
  - Fenêtre d'une firme partenaire allégée, sans tableau de plans : intro + « Angelo's take » (content/prop-firms/firm-notes.md, écrits par LUI seul, case vide = rien d'affiché, jamais de texte à sa place), code JTNQ + bouton vers la firme, « See all plans » = comparateur filtré sur la firme ; bloc identique pour toutes (Angelo, 01/11/2026).
  - Téléphone : sous 760px une carte par plan, mêmes champs, filtres repliables (Angelo, 01/11/2026).
  - Anciennes adresses gardées : /prop-firms/, #futures, #perps, #trade-copier, /prop-firms/crypto/, /prop-firms/cfd/, /go/ (Angelo, 01/11/2026).
  - Sélection : une case Compare sur chaque plan, 2 plans ou plus, même firme ou firmes différentes ; chaque plan coché rejoint les autres en haut du même tableau, sans clic de confirmation, la liste reste dessous pour en ajouter, Cancel annule tout, rien d'autre d'ajouté ; futures et perps restent deux tableaux (Angelo, 02/11/2026 : « tu prends 2 plan différent que ce sois le même propfirm ou 2 propfirm différent ou même + et tu compares comme ca, on rajoute rien » ; « t'as pas besoin de reconfirmer sur comparer, genre juste ça s'ajoute, ça s'ajoute, mais tu peux faire genre annuler »).
  - Emplacement : 4e bouton de /prop-firms, libellé « Prop compare » (Angelo, 01/11/2026 : « Prop compare pour qu'ils comprennent on compare quoi »), hash #compare et #compare=<firm-id> ; composant autonome, une page à part = rendre <ComparePanel> ailleurs.
- Idées reprises de fredvshapes.com, jamais sa forme (Angelo, 04/11/2026 : « j'avoue page giveaways, pourquoi pas », « le but c pas de copier coller tout entièrement ») :
  - Carte d'une firme : la remise dans la pastille, « 20% off with code JTNQ », « Up to 35% off… » quand elle varie selon les plans ; même format pour toutes (lib/discount-words.mjs). Futures = calculée sur les prix des plans, perps = le taux publié.
  - Comparateur : un bouton par limite de daily loss sur les plans vendus en plusieurs versions (MFP Elite, Vest 1-Step), le prix suit (lib/daily-loss-choices.mjs). Rien d'autre n'a de boutons.
  - /giveaways : ses mots repris de Discord, historique dans content/giveaways/giveaways.json mis à jour à la main ; aucun pseudo de gagnant affiché sans son accord.
- `output: 'export'` : pas de server-side runtime, pas d'API routes dynamiques.
- Section études (/studies, ex-/backtested-data, /print, PDF, data JSON, scripts de backtest) retirée le 12/10/2026 à la demande d'Angelo (« pas sur que ca sois un projet a mon image », puis « je veux bien » pour « Je les retire ») ; les anciennes URLs redirigent vers la home (public/_redirects). Tout reste dans l'historique git.
- Fonts : ne plus importer via CDN Fontshare (bloque COEP). Self-hosted uniquement dans `public/fonts/`.
- CSP `connect-src 'self'` obligatoire pour RSC payload fetch (Next.js 15 App Router).
- `trailingSlash: true` dans next.config.js — tous les `<Link>` internes doivent finir par `/`.
- Cloudflare cache agressif — apres merge sur main, forcer purge cache CF si assets semblent stales.
- Hook edit-rules.sh bloque Write/Edit sur main — toujours passer par une branche.
- Newsletter retirée le 11/10/2026 à la demande d'Angelo (« les newsletters, c'était un truc qu'on voulait faire, mais en vrai, flemme. Supprime. » ; la newsletter classait ses firmes partenaires, ce que ses contrats interdisent) : formulaire /prop-firms, endpoints `functions/` (sauf `functions/api/community.js`, compteur Discord), workflow, envoi. Le moteur de prix réduit à l'essentiel (12/10/2026) : `scripts/lib/promo-analysis.mjs` (règles de prix) + `content/prop-firms/codes.md` (code d'Angelo par firme), lus par `build-live-promos.mjs` (feed des promos `/go/promos/*`) ; les logos `public/logos/email/` servent à ce feed.
- `overrides` postcss/sharp dans package.json : versions corrigées que Next 15.5 et miniflare figent trop bas (npm audit ne proposait qu'un saut majeur). À retirer quand Next/wrangler embarquent eux-mêmes ces versions.

## <frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design,
this creates what users call the "AI slop" aesthetic. Avoid this: make creative,
distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic
fonts like Arial and Inter; opt instead for distinctive choices that elevate the
frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency.
Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only
solutions for HTML. Focus on high-impact moments: one well-orchestrated page load
with staggered reveals creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors.
Layer CSS gradients, use geometric patterns, or add contextual effects.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively. Vary between light and dark themes, different fonts,
different aesthetics. You still tend to converge on common choices (Space Grotesk,
for example) across generations. Think outside the box.
</frontend_aesthetics>

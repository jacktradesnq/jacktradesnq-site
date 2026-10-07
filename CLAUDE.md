@/Users/angelo/obsidian-mind/work/active/jacktradesnq/jacktradesnq.md

# jacktradesnq.com — design & code rules

## Stack
- Next.js 15 App Router + TypeScript + Tailwind v4 (static export `output: 'export'`)
- CSS pur dans app/globals.css (tokens OKLCH + import Fontshare)
- Animations : Framer Motion (reveal) + GSAP ScrollTrigger (parallax scroll)
- Déploiement Cloudflare Pages via GitHub Actions (npm run build → deploy out/)
- Client Components isolés pour JS interactif (prairieBackground, HeroReveal)
- Plus d'export PDF côté client : News830Explorer + jsPDF retirés le 2026-10-07 (jamais affichés sur aucune page). Les PDF du site sont des fichiers statiques (public/downloads, BilingualPdfLink)
- `marked` pour parser les explanation.md backtested-data

## Direction esthétique déclarée (ne PAS dévier)
**dark editorial site-objet** (home + page partenaire, refonte 2026-05-25).
- Fond noir chaud brun (`oklch(0.12-0.16`), accent **gold unique** (`oklch(0.78-0.80 0.14 ~80`)
- Wordmark Fraunces italique monumental + canvas candlesticks infini en fond (mask radial au centre)
- Ton : éditorial, magazine, premium ; pas de funnel marketing agressif
- Point mémorable : wordmark italique géant + point doré (leitmotiv de marque) + bougies live
- Anti-objectif explicite : ne PAS faire un link-in-bio déguisé ni un funnel de vente type Whop
- Les pages `studies/` gardent leur traitement existant (globals.css) — la refonte dark couvre home + `/nefarious/` uniquement, CSS scopé sous `.jtnq-home` / `.jtnq-nef` pour ne pas polluer studies.
- (Ancienne direction warm-editorial prairie Kazuo Oga = abandonnée 2026-05-25, conservée nulle part.)

## Typographie (OBLIGATOIRE)
- Titres / wordmark : **Fraunces** (serif italique) — self-hosted public/fonts/
- Body / UI : **Satoshi** (sans-serif clean) — self-hosted
- Labels / eyebrows / data : **JetBrains Mono** (uppercase, letter-spacing ~.2em) — self-hosted public/fonts/JetBrainsMono.woff2
- Fonts self-hosted dans public/fonts/ (fix COEP — JAMAIS de CDN Google Fonts / Fontshare)
- Inter reste banni (cf anti-slop) ; le mono est JetBrains Mono, pas un fallback système.

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
- Home page (app/page.tsx) : refonte dark editorial site-objet 2026-05-25 (hero canvas candlesticks + wordmark Fraunces, hub Studies+Nefarious, socials icônes footer). Ancien hero prairie remplacé.
- Page partenaire (app/nefarious/page.tsx) : Nefarious, testimonials Whop verbatim + Join CTA Discord (2026-05-25)
- Layout global (app/layout.tsx) : nav + hamburger mobile wired (commit `3fac707`), theme-color + apple-touch-icon (commit `b591231`)
- OG image 1200x630 (public/og-image.png, commit `6854b17`)
- Fonts self-hosted Fraunces + Satoshi (public/fonts/, commit `67af186`)
- Font preload dans layout (commit `b591231`)
- CSP headers : script-src unsafe-inline + connect-src 'self' pour RSC payloads (commit `756fdaf`)
- noindex sur RSC .txt payloads (commit `bc67ec3`)
- Trailing slash sur tous les Links internes (commit `a3dd397`)
- Pages legales : /mentions-legales + /politique-confidentialite

### Backtested-data mini-site
- Hub /backtested-data (app/backtested-data/page.tsx) : liste auto depuis content/ + stats TradingView/Data/Updated
- Dynamic slug routing (app/backtested-data/[slug]/page.tsx) : lit meta.json + explanation.md via lib/backtested-data.ts
- Layout lateral avec sidebar (app/backtested-data/layout.tsx + _components/Sidebar.tsx)
- BacktestedShell.tsx : wrapper shell pour pages slug
- SubNav.tsx : navigation intra-page
- AI disclaimer sur hub landing (commit `499c417`)
- StraddleExplorer.tsx : widget interactif 20KB, filtres/stat cards/data table, embedded mode, JSON-driven via public/data/*.json

### Entrees backtested-data publiees (content/backtested-data/)
| slug | titre | categorie | date |
|------|--------|-----------|------|
| asia-open | Asia open (NWOG fill study) | data | 2026-05-04 |
| cpi-day-stats | CPI straddle | data | 2026-05-03 |
| killzone-past-vs-now | Killzone range | data | 2026-05-04 |
| nfp | NFP straddle | data | 2026-05-04 |

### Straddle data (public/data/)
- `nfp-straddle.json` (163KB) — NFP straddle combos, exploite par StraddleExplorer
- `cpi-straddle.json` (55.5KB) — CPI straddle combos, exploite par StraddleExplorer
- Colonnes : Wins/Losses/No-Fill (Avg PnL + Worst PnL supprimes, commit `839fe94`)

### NFP page
- Delayed Feb 2026 release (Wed 11 Feb) ajoute (commit `ad3d7b0`)
- Colonnes Wins/Losses/No-Fill, Avg/Worst PnL supprimes (commit `839fe94`)

### news-830 entry (sur main)
- Mirror jtnq : 108-variant grid (commit `6194ba9`)
- news-830-ifvg retire puis republie v2.0 avec chiffres rewritten engine (commits `96de475` + `9cb1c6e`)

### Interactive StraddleExplorer (sur main depuis 2026-05-09)
- jsPDF + jspdf-autotable installes (commit `d99a412`), retires le 2026-10-07
- Embedded mode (commit `258ef81`)
- CSS complet : filtres, stat cards, data table (commit `7eff650`)
- Colonnes Wins/Losses/No-Fill (commit `38541f8`)
- Bouton PDF CTA style aligne (commit `d5c99dd`)

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

## Architecture backtested-data (content-driven)

Pour ajouter une nouvelle entree :
1. Creer `content/backtested-data/<slug>/meta.json` (title, category, date, excerpt, tradingviewUrl, pdfFile)
2. Creer `content/backtested-data/<slug>/explanation.md`
3. Optionnel : JSON dans `public/data/<slug>.json` si StraddleExplorer ou chart interactif
4. La page `/backtested-data/<slug>/` est generee automatiquement via `[slug]/page.tsx`

---

## Commandes utiles

```bash
npm run dev       # dev server localhost:3000
npm run build     # static export -> out/
npm start         # serve out/ (preview)
npx tsc --noEmit  # type check sans build
npm test          # tests scripts/ + functions/ (lances aussi par la CI)
node scripts/check-filterbar-layout.mjs  # barre de filtres sans chevauchement (site servi sur :8788, ou BASE=https://jacktradesnq.com)
node scripts/check-page-width.mjs        # aucune page studies plus large qu'un téléphone (360/390/430px), même usage
```

Deploy : push sur `main` -> GitHub Actions -> Cloudflare Pages auto.

---

## Gotchas

- `output: 'export'` : pas de server-side runtime, pas d'API routes dynamiques. `lib/backtested-data.ts` utilise `fs` -> server component uniquement (pas 'use client').
- Fonts : ne plus importer via CDN Fontshare (bloque COEP). Self-hosted uniquement dans `public/fonts/`.
- CSP `connect-src 'self'` obligatoire pour RSC payload fetch (Next.js 15 App Router).
- `trailingSlash: true` dans next.config.js — tous les `<Link>` internes doivent finir par `/`.
- Cloudflare cache agressif — apres merge sur main, forcer purge cache CF si assets semblent stales.
- StraddleExplorer = Client Component lourd (20KB) — ne pas dupliquer, passer config via props `embedded` + `slugOverride`.
- news-830-ifvg data retiree puis republiee — ne pas republier sans chiffres valides depuis engine rewritten.
- Hook edit-rules.sh bloque Write/Edit sur main — toujours passer par une branche.
- `functions/` = Cloudflare Pages Functions (newsletter), chargées par leur chemin, importées par personne : `knip.json` les déclare en entrées, ne pas les prendre pour du code mort.
- `overrides` postcss/sharp dans package.json : versions corrigées que Next 15.5 et miniflare figent trop bas (npm audit ne proposait qu'un saut majeur). À retirer quand Next/wrangler embarquent eux-mêmes ces versions.
- Études : `lib/study-stats.ts` = catalogue du hub, `lib/strategy-stats.ts` = stats par étude IFVG, `lib/straddle-trades.ts` = trades straddle (découpe 2026-10-07, chacun < 800 lignes).
- Onglets d'étude : `V3Tabs.tsx` assemble, un fichier par onglet (`V3WeekdayTab`, `V3YearTab`, `V3TradesTab`) ; libellés de période dans `lib/lookback-labels.ts` (découpe 2026-10-07).

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

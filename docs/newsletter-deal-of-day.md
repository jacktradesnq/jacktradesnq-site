# Newsletter — deal of the day

Un email par jour avec la meilleure offre prop firm du moment, tiré de
`public/data/prop-firms.json` (les mêmes chiffres que la page `/prop-firms/`,
scrapés chaque matin par `scripts/scrape-prop-firms.mjs`).

Rien n'est inventé : si la donnée n'existe pas, le texte n'en parle pas.

## Le texte est à toi, le reste est à la machine

Aucune phrase n'est dans le code. Tout ce qui se lit est dans deux fichiers :

| Fichier | Ce que tu y écris |
|---|---|
| `content/newsletter/messages.md` | Les phrases des trois messages : objet, accroche, bouton, pied, le message Discord, le tweet, et les quatre "pièges" |
| `content/newsletter/takes.md` | Ton avis, firme par firme. Une firme sans section sort sans avis, rien n'est inventé |

Trois règles dans ces fichiers : `{trou}` que la machine remplit,
`[entre crochets]` qui disparaît si l'info n'existe pas ce jour-là,
`*entre étoiles*` pour le gras du mail. Si tu inventes un trou, la machine
refuse et te dit lequel, elle n'envoie jamais un mail avec un blanc.

Pour voir le résultat après une modif :

```
cd ~/jacktradesnq-site
node scripts/build-deal-of-day.mjs --dry
```

## Ce que ça fait

| Fichier | Rôle |
|---|---|
| `scripts/lib/copy.mjs` | Lit tes deux fichiers de texte, remplit les trous, refuse une variable inventée |
| `scripts/lib/deal-of-day.mjs` | Choisit la firme du jour et passe les chiffres à tes phrases |
| `scripts/build-deal-of-day.mjs` | CLI : rend les messages, tient l'état de rotation |
| `functions/api/subscribe.js` | POST du formulaire, stocke en "pending", envoie le mail de confirmation |
| `functions/api/newsletter/confirm.js` | Le clic qui met l'adresse sur la liste |
| `functions/api/newsletter/unsubscribe.js` | Désinscription en un clic |
| `functions/api/newsletter/send.js` | Envoie l'email du jour aux adresses confirmées |
| `app/prop-firms/DealSignup.tsx` | Le formulaire, en bas de la page prop firms |
| `.github/workflows/newsletter-daily-deal.yml` | Le job (manuel pour l'instant, aucun cron) |

## Comment la firme du jour est choisie

Par ordre de priorité, sur les firmes non `stale` :

1. **promo qui expire sous 96h** (le champ `promo.ends`)
2. **promo nouvelle** depuis la veille (diff avec `data/newsletter/snapshot.json`)
3. **prix qui a baissé** depuis la veille
4. sinon la **plus grosse remise réelle** (prix barré dans les données)

Une firme sortie il y a moins de 7 jours n'est jamais reprise, donc la semaine
couvre les 7 firmes. À remise égale, c'est le compte **50K** qui est mis en
avant (la taille que les traders comparent), pas le plus gros ticket.

Voir la rotation sans rien envoyer :

```
node scripts/build-deal-of-day.mjs --dry
node scripts/build-deal-of-day.mjs --all      # un aperçu par firme
node scripts/build-deal-of-day.mjs --dry --force=legends-trading
```

Les aperçus atterrissent dans `.newsletter-preview/` (email HTML, texte,
message Discord, tweet).

Tests :

```
node --test scripts/deal-of-day.test.mjs scripts/copy.test.mjs functions/_shared/subscribers.test.mjs functions/api/endpoints.test.mjs
```

## Ce qu'il reste à brancher (côté comptes, pas côté code)

### 1. Resend (l'envoi)

1. Créer un compte sur resend.com, ajouter le domaine `jacktradesnq.com`.
2. Coller les 3 enregistrements DNS qu'il donne dans Cloudflare DNS
   (un TXT `_dmarc`, un TXT DKIM, un MX ou TXT SPF selon ce qu'il affiche).
3. Créer une clé API, la garder pour l'étape 3.

Gratuit : 3 000 emails par mois, **100 par jour** (donc ~100 abonnés en envoi
quotidien). Au-delà, 20 $/mois pour 50 000. Vérifié le 2026-08-20 sur
resend.com/pricing.

### 2. Le stockage des inscrits (Cloudflare KV)

```
cd ~/jacktradesnq-site
npx wrangler kv namespace create NEWSLETTER
```

Puis dans le dashboard Cloudflare : Workers & Pages → jacktradesnq → Settings →
Bindings → ajouter un binding KV nommé `NEWSLETTER` sur ce namespace.

### 3. Les variables du projet Pages

Dashboard Cloudflare → jacktradesnq → Settings → Environment variables :

| Nom | Valeur | Type |
|---|---|---|
| `RESEND_API_KEY` | la clé de l'étape 1 | secret |
| `NEWSLETTER_FROM` | `JackTradesNQ <deals@jacktradesnq.com>` | texte |
| `SITE_ORIGIN` | `https://jacktradesnq.com` | texte |
| `NEWSLETTER_SEND_KEY` | une phrase au hasard, longue | secret |

### 4. Le secret GitHub

Repo → Settings → Secrets and variables → Actions → New secret :
`NEWSLETTER_SEND_KEY`, la **même** valeur qu'à l'étape 3.

### 5. Premier envoi, puis le quotidien

Le workflow tourne **tous les jours à 6h40 UTC sur les serveurs GitHub**, juste
après le sync des prix de 6h17. Ton Mac peut être fermé, éteint, en voyage :
rien de la chaîne ne tourne chez toi.

Par défaut ce run quotidien est un **essai à blanc** : il compose le mail,
compte les abonnés confirmés et n'envoie à personne.

Pour l'armer, une seule variable à créer :
repo → Settings → Secrets and variables → Actions → onglet **Variables** →
`NEWSLETTER_ENABLED` = `true`. Pour le désarmer, la repasser à `false`.

Même chose pour le post Discord automatique : `NEWSLETTER_DISCORD` = `true`.

Un envoi à la main, quand tu veux : onglet Actions →
"Newsletter — deal of the day" → Run workflow → `mode: send`.

| Déclencheur | `NEWSLETTER_ENABLED` | Ce qui se passe |
|---|---|---|
| cron quotidien | absente ou `false` | essai à blanc, zéro mail |
| cron quotidien | `true` | envoi aux abonnés confirmés |
| bouton, `mode: dry-run` | peu importe | essai à blanc |
| bouton, `mode: send` | peu importe | envoi |

## Garde-fous déjà en place

- Double opt-in : une adresse non confirmée ne reçoit jamais l'email du jour.
- `mode` doit valoir exactement `send` ; tout le reste est un dry-run.
- Un email sans emplacement de désinscription est refusé par l'endpoint.
- En-tête `List-Unsubscribe` one-click sur chaque envoi.
- Honeypot + 5 inscriptions max par IP et par jour.
- Une firme `stale` (scrape raté, anciens chiffres gardés) n'est jamais mise en
  avant : sa promo peut être morte.

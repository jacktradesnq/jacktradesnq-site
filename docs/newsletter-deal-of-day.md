# Newsletter — deal of the day

Un email par jour avec la meilleure offre prop firm du moment, tiré de
`public/data/prop-firms.json` (les mêmes chiffres que la page `/prop-firms/`,
scrapés chaque matin par `scripts/scrape-prop-firms.mjs`).

Rien n'est inventé : si la donnée n'existe pas, le texte n'en parle pas.

## Ce que ça fait

| Fichier | Rôle |
|---|---|
| `scripts/lib/deal-of-day.mjs` | Choisit la firme du jour et écrit les 3 messages (email, Discord, tweet) |
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
node --test scripts/deal-of-day.test.mjs functions/_shared/subscribers.test.mjs functions/api/endpoints.test.mjs
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

### 5. Premier envoi

Onglet Actions → "Newsletter — deal of the day" → Run workflow :

- `mode: dry-run` → il rend l'email et répond le nombre d'abonnés, sans envoyer.
- `mode: send` → il envoie vraiment.

Le workflow n'a **aucun cron** : tant que personne ne clique, rien ne part. Le
jour où le texte est réglé, ajouter un bloc `schedule:` (après le sync des prix
de 6h17 UTC, donc vers 6h30).

## Garde-fous déjà en place

- Double opt-in : une adresse non confirmée ne reçoit jamais l'email du jour.
- `mode` doit valoir exactement `send` ; tout le reste est un dry-run.
- Un email sans emplacement de désinscription est refusé par l'endpoint.
- En-tête `List-Unsubscribe` one-click sur chaque envoi.
- Honeypot + 5 inscriptions max par IP et par jour.
- Une firme `stale` (scrape raté, anciens chiffres gardés) n'est jamais mise en
  avant : sa promo peut être morte.

# Le texte de la newsletter

C'EST ICI QUE TU ECRIS. Aucun code, que des phrases.

Trois regles, c'est tout :

1. `{prix}` en anglais `{price}` : un trou que la machine remplit avec la vraie
   donnee du jour. La liste complete est en bas de ce fichier.
2. `[entre crochets]` : disparait completement si l'info n'existe pas ce jour-la.
   Exemple : `[, instead of {was}]` s'efface quand la firme n'a pas de prix barre.
3. `*entre etoiles*` : mis en gras dans le mail.

Ne touche pas aux lignes qui commencent par `##`, c'est le nom du bloc.
Si tu inventes un trou qui n'existe pas, la machine refuse d'envoyer et te dit
lequel, elle n'envoie jamais un mail avec un blanc dedans.

Pour tester ce que tu viens d'ecrire :

    node scripts/build-deal-of-day.mjs --dry

---

## email.subject
{firm} {account} at {price}[ instead of {was}][, ends {ends}]

## email.preheader
[{discount}% off, was {was}. ]{split} split, payout {payout}.

## email.eyebrow
Deal of the day

## email.ends
ends {ends}

## email.lead
*{price}* for a {account}[, instead of {was}].

## email.sub
[{discount}% off on the {plan} plan.]

## email.specs
*{split}* profit split · payout *{payout}*[ · {contracts}]

## email.labels
target = Profit target
maxdd = Max drawdown
dailyloss = Daily loss
size_col = Account size
now_col = Now
before_col = Before

## email.cta
Get the {size} at {price}

## email.code
Code at checkout: {code}

## email.code_in_link
No code to type, the discount rides on the link.

## code_line
Code {code}

## code_line_in_link
Discount is already on the link

## email.catch_title
The catch

## email.take_title
What I watch

## email.footer
Prices read off {firm}'s own site, checked {checked}. Affiliate links, your price does not change. You signed up for this on jacktradesnq.com.

## email.unsubscribe
Unsubscribe

## discord
**{firm}, deal of the day**
{price} for a {account}[, instead of {was}]. [{discount}% off on the {plan} plan.][ Ends {ends}.]

Every size: {ladder}
{split} split - payout {payout} - {ddtype} drawdown[ - {contracts}]

## tweet
{price} for a {account}[, instead of {was}]. {firm}, {plan} plan.[ Ends {ends}.]
{split} split, payout {payout}.

## catch.monthly
Billed every month, not once. It stops costing you the day you stop.

## catch.consistency
Consistency rule: {consistency}.

## catch.activation
{activation} activation fee once you get funded.

---

# Les trous disponibles

| trou | exemple aujourd'hui |
|---|---|
| `{firm}` | Blue Guardian |
| `{plan}` | Reserve |
| `{account}` | 50K challenge (ou 50K instant funded account) |
| `{size}` | 50K |
| `{price}` | $75 (avec /mo si c'est un abonnement) |
| `{was}` | $100 (vide si la firme n'a pas de prix barre) |
| `{discount}` | 25 (vide s'il n'y a aucune remise) |
| `{split}` | 90% |
| `{payout}` | On-demand |
| `{ddtype}` | EOD Trailing |
| `{target}` | $3,000 (vide sur un compte instant) |
| `{maxdd}` | $2,000 |
| `{dailyloss}` | $1,000 (vide si la firme n'en a pas) |
| `{contracts}` | 4 Mini / 40 Micro |
| `{consistency}` | 40% |
| `{activation}` | $150 (vide s'il n'y en a pas) |
| `{code}` | JTNQ (vide si le code est deja dans le lien) |
| `{url}` | ton lien d'affiliation |
| `{ends}` | Sunday (vide si la promo n'a pas de date de fin) |
| `{checked}` | 2026-09-26 |
| `{ladder}` | 25K $48 - 50K $75 - 100K $111 - 150K $222 |
| `{take}` | ta phrase a toi, ecrite dans takes.md |

Ton avis par firme se met dans `takes.md`, pas ici.

## Ce qui n'existe volontairement PAS

**Le texte promo de la firme** (genre « 45% OFF + 50% w/ code ») n'est
pas un trou disponible. Deux raisons :

1. Ces deux pourcentages sont des alternatives, pas une addition. Aucune firme
   ne laisse cumuler deux remises. L'imprimer a cote de notre chiffre calcule
   ferait croire a un cumul qui n'existe pas.
2. C'est de la prose marketing qui bouge sans prevenir. Les deux seuls chiffres
   fiables sont le prix et le prix barre du plan.

`{discount}` est donc TOUJOURS calcule sur ces deux prix, sur un seul plan. Si
tu ecris un autre pourcentage a la main dans une phrase, la machine refuse
d'emettre et te dit lequel ne colle pas. Elle ne peut pas non plus deviner ce
que fait un code au panier : le prix affiche est le prix public, et le lecteur
part au checkout avec le code.

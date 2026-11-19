# Quel code on imprime, firme par firme

Une ligne par firme. Trois valeurs possibles :

    e8-markets = JTNQ      -> la page dit "code JTNQ"
    tradeify = JackTNQ     -> la firme t'a donne un autre code : la page dit "code JackTNQ"
    une-firme = link       -> aucun code a taper, le lien porte la remise

## Pourquoi c'est JTNQ partout

Un code affilie ne peut pas donner moins que le code public de la firme. Si
c'etait le cas, l'affilie n'aurait aucune raison de pousser son code : il
pousserait le code public, y perdrait sa commission, et la firme y perdrait la
vente. L'affiliation ne tiendrait pas debout.

La donnee le montre directement : chez **E8 Markets**, le
code public scrape sur leur propre site EST `JTNQ`. Ils publient ton code comme
promo generale. Chez les autres, le code public et le
tien ouvrent la meme remise, celle qui est deja dans le prix affiche.

Donc le prix de la page est le prix qu'on paie avec ton code, et c'est ton code
qui est imprime. Jamais le leur : ca te sortirait de la transaction partout ou
une firme attribue par code.

## Traders Launch

Le lien applique deja la remise (`coupon=JTNQ` dans l'URL), mais le code JTNQ
marche aussi tape a la main au checkout : Josh l'a attribue le 21/06/2026 et il a
ete verifie applique au checkout le 29/06 (vault, partnerships/traderslaunch.md).
Quelqu'un qui revient sur leur site sans le lien doit donc voir le code
(Angelo, 21/10/2026 : « si ils veulent ils peuvent egalement utiliser mon code
non ? imagine ils ont pas clique mon lien »).

## Tradeify

Le code est JackTNQ (cette casse), pas JTNQ : Despina (Tradeify Affiliate Team)
l'a mis a jour le 19/11/2026 (« Sure, this has been updated! », visuel « USE
CODE: JACKTNQ ») (Angelo, 19/11/2026 : « c officielle j'ai le code JackTNQ sur
tradeify. donc mtn go changer dans mon site »). Tradeify n'est que dans le
comparateur : public/data/compare-extra-firms.json porte le meme code
("code": "JackTNQ", scripts/firms-tradeify.test.mjs verifie que les deux disent
pareil), le bouton mene a leur site (aucun lien de tracking donne). Le feed des
promos ne lit que prop-firms.json, il ne voit pas Tradeify.

---

## codes
traders-launch = JTNQ
e8-markets = JTNQ
blusky = JTNQ
tradeify = JackTNQ

---

# Si tu changes une ligne

`= link` fait disparaitre le code de la page, et la
phrase devient "la remise est portee par le lien". Les liens portent ton
attribution de toute facon (`coupon=JTNQ`), donc `link` ne te
fait jamais perdre une commission, il te fait juste perdre l'occasion de
faire taper ton nom.

La machine n'imprimera jamais un code public a la place du tien : le code public d'une firme n'est jamais lu
par le build des promos.

# Quel code on imprime, firme par firme

Une ligne par firme. Deux valeurs possibles :

    fundedseat = JTNQ      -> la page dit "code JTNQ"
    traders-launch = link  -> aucun code a taper, le lien porte la remise

## Pourquoi c'est JTNQ partout

Un code affilie ne peut pas donner moins que le code public de la firme. Si
c'etait le cas, l'affilie n'aurait aucune raison de pousser son code : il
pousserait le code public, y perdrait sa commission, et la firme y perdrait la
vente. L'affiliation ne tiendrait pas debout.

La donnee le montre directement : chez **E8 Markets** et chez **TradeDay**, le
code public scrape sur leur propre site EST `JTNQ`. Ils publient ton code comme
promo generale. Chez les autres, le code public (BG25, ULTRA50, 2.0, LTG) et le
tien ouvrent la meme remise, celle qui est deja dans le prix affiche.

Donc le prix de la page est le prix qu'on paie avec ton code, et c'est ton code
qui est imprime. Jamais le leur : ca te sortirait de la transaction partout ou
une firme attribue par code.

## Le cas particulier de Traders Launch

Eux n'ont pas de code public du tout. Leur remise de 15% arrive par le lien
(`coupon=JTNQ` dans l'URL), donc la page dit qu'il n'y a rien a taper. Mettre
`JTNQ` la ferait taper un code qui n'existe pas chez eux.

---

## codes
blue-guardian = JTNQ
traders-launch = link
top-one-futures = JTNQ
fundedseat = JTNQ
legends-trading = JTNQ
e8-markets = JTNQ
tradeday = JTNQ

---

# Si tu changes une ligne

`= link` fait disparaitre le code de tous les messages et de la page, et la
phrase devient "la remise est portee par le lien". Les 7 liens portent ton
attribution de toute facon (`afmc=JTNQ`, `ref=JTNQ`, `a_aid=JTNQ`,
`coupon=JTNQ`, `sourceId=jtnq`), donc `link` ne te fait jamais perdre une
commission, il te fait juste perdre l'occasion de faire taper ton nom.

La machine n'imprimera jamais un code public a la place du tien : si un code
comme BG25 ou ULTRA50 apparait dans un message, le build refuse d'emettre.

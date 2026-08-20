# Quel code on imprime, firme par firme

Une ligne par firme. Trois valeurs possibles :

    fundedseat = JTNQ      -> le mail dit "Code at checkout: JTNQ"
    legends-trading = LTG  -> le mail dit "Code at checkout: LTG"
    blue-guardian = link   -> le mail dit qu'il n'y a pas de code a taper,
                              la remise est portee par le lien

C'est TOI qui tranches ici, parce que c'est la seule chose que la donnee ne
peut pas savoir : est-ce que ton code marche chez cette firme, ou est-ce que la
remise passe par le lien.

Deux choses que la machine garantit :

- Elle n'imprimera JAMAIS un code public a la place du tien. Si tu ne declares
  rien pour une firme, elle imprime `JTNQ` (la meme regle que ta page
  /prop-firms/) et te le signale dans la sortie du build.
- Le lien d'affiliation part de toute facon dans tous les messages, code ou
  pas : les 7 URLs portent deja ton attribution (afmc=JTNQ, ref=JTNQ,
  a_aid=JTNQ, coupon=JTNQ, sourceId=jtnq). Un `= link` ne te fait rien perdre.

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

# A verifier une fois, puis oublier

Ce que je sais de source sure aujourd'hui, et ce qui reste a trancher :

| firme | ce qui est verifie | a decider |
|---|---|---|
| E8 Markets | `code: "JTNQ"` est dans la donnee scrapee, donc ton code est bien le code du site | rien |
| TradeDay | le code public scrape EST `JTNQ`, lien `a_aid=JTNQ` | rien |
| Traders Launch | aucun code public, le lien porte `coupon=JTNQ` et applique -15% (page /prop-firms/) | mis a `link`, le lien fait tout |
| LEGENDS Trading | tracker : lien `?ref=JTNQ`, **code affiche cote site : LTG** (Apprentice 80% / Elite 35%) | est-ce que `JTNQ` marche comme code chez eux ? Sinon mettre `LTG` ou `link` |
| Top One Futures | codes publics `2.0` (site) et `BOGO` (Elite Access) | est-ce que `JTNQ` marche comme code ? Sinon `link` |
| FundedSeat | code public `ULTRA50`, lien `fundedseat.link/jtnq` | est-ce que `JTNQ` marche comme code ? |
| Blue Guardian | code public `BG25`, lien `afmc=JTNQ` | est-ce que `JTNQ` marche comme code ? |

Reponse simple si tu ne sais pas pour une firme : mets `link`. Tu ne perds ni
la remise (elle est deja dans le prix scrape) ni la commission (elle est dans
le lien), et personne ne tape un code qui ne marche pas.

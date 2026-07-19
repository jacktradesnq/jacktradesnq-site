# Audit véracité prop-firms.json — 2026-07-19

## Vue d'ensemble

| Firme | Programmes/Plans | OK | DIVERGENT | UNVERIFIABLE |
|---|---|---|---|---|
| Blue Guardian | 4 / 15 | 149 | 1 (consistency Direct) | 0 |
| Traders Launch | 1 / 3 | 29 | 0 | 1 (codeDiscountPct) |
| Top One Futures | 6 / 24 | 233 | 7 (maxDrawdown x4, originalPrice x1, consistency x2) | 0 |
| FundedSeat | 2 / 7 | 70 | 0 | 0 |
| LEGENDS Trading | 3 / 12 | 116 | 0 | 0 |
| E8 Markets | 3 / 10 | ~95 | 0 | 0 |
| FundedNext | 4 / 12 | 118 | 2 (split, payout — firm-level) | 0 |
| **Total** | **23 / 83** | **~810** | **10** | **1** |

Aucun verdict SECONDARY_ONLY (source officielle accessible pour toutes les firmes) et aucun PRICE_DRIFT isolé constaté (tous les prix recoupés collent au centime près aux sources officielles capturées/live le 2026-07-19).

Point le plus sensible de l'audit (E8 Zero, cf firme déjà corrigée manuellement par le client) : re-vérifié via 2 sources officielles supplémentaires indépendantes — ddType="EOD Trailing" confirmé CORRECT, aucune régression.

## Blue Guardian

Source primaire : `blueguardian.html` — capture RSC/JSON du configurateur d'achat (buy-screen : wooProductId, coupon, sizes/challengeRules/fundedRules par plan). Source haute confiance (écran d'achat officiel).

Firm-level : split 90% OK (fundedRules "Profit Split":"90/10" sur les 4 programmes). payout "On-demand" OK — cite blueguardian.com/payouts : "Get paid on-demand, weekly or bi-weekly depending on account type and add-ons." promo 40% OFF / code LAUNCH OK (coupon.label "Save 40% with code" / coupon.code "LAUNCH" sur tous les plans futures).

4 programmes / 15 plans. Champs vérifiés : size, price, originalPrice, profitTarget, maxDrawdown, ddType, dailyLoss, dailyLossSoft, consistency, contracts (10 champs x 15 plans = 150 vérifications) : **149 OK, 1 DIVERGENT**.

ddType — citation par programme (buy-screen, tooltip explicite) :
- **Direct** (instant, ddType="EOD") : tooltip = "Static drawdown (no trailing). After any withdrawal, drawdown floor locks at starting balance + $100." → nature confirmée STATIQUE explicitement.
- **Express** (eval, ddType="EOD Trailing") : tooltip fundedRules = "EOD trailing during eval and funded. After any withdrawal, drawdown floor locks at starting balance + $100." → nature TRAILING confirmée explicitement.
- **Reserve** (eval, ddType="EOD Trailing") : même tooltip que Express ("EOD trailing during eval and funded...").
- **Standard** (eval, ddType="EOD Trailing") : même tooltip que Express/Reserve.

DIVERGENT :
- Direct (tous sizes) — champ `consistency`="None" : correct pour la phase eval (aucune, normal — pas d'eval sur un compte instant) MAIS le buy-screen affiche une règle de consistency de PAYOUT progressive (20%/25%/30%) non reflétée dans le dataset. Voir `divergences.jsonl`.

Note méthodologique (transverse, pas spécifique à Blue Guardian) : le champ `consistency` du dataset ne capture que la règle de phase eval/challenge. Plusieurs programmes (ex Standard ici, funded consistency 40%) ont AUSSI une règle de consistency en phase funded non reprise dans le dataset — comportement cohérent sur tout le dataset, pas une erreur isolée. Signalé une fois ici pour Direct car c'est le SEUL type de consistency qui existe pour ce programme (pas de phase eval).

## Traders Launch

Source primaire : `traderslaunch.html` = homepage marketing traderslaunch.com (pas le configurateur app.traderslaunch.com). Contient toutefois une section pricing id="pricing" avec cards par taille (prix, target, drawdown, contracts) qui sert d'écran de vente direct (boutons "Get Funded" → liens signup avec query params type/size/split/hours) — traité comme buy-screen de niveau 1. Explainer visuel + FAQ present sur la même page pour la nature du drawdown.

Firm-level : split 80% OK (tag "80% Profit Split" sur les 3 pricing cards ; note : meta SEO mentionne aussi une option 55% non visible/sélectionnable dans cette capture — non bloquant, le 80% correspond à l'affichage par défaut). payout "Daily" OK ("Daily Payouts" / "Same-day payout processing" x10+ occurrences). promo=null OK (aucun code promo générique affiché sur la homepage, cohérent).

1 programme (1-Step, eval) / 3 plans. Champs vérifiés (size, price, originalPrice, profitTarget, maxDrawdown, ddType, dailyLoss, dailyLossSoft, consistency, contracts) : **29 OK, 1 UNVERIFIABLE** (codeDiscountPct, firm-level, hors grille des 10 champs/plan).

ddType — citation (1 seul programme, même mécanisme sur les 3 tailles) :
- **1-Step** (ddType="EOD Trailing") : explainer visuel de la homepage = "Hit the profit target. The drawdown floor trails you up, then **locks at your starting balance**." + aria-label du graphique : "equity rises to the profit target while the EOD drawdown floor rises then locks at the starting balance." → nature TRAILING confirmée explicitement (verbe "trails"), avec lock au breakeven. Attention : un widget comparatif marketing sur la même page oppose "EOD only" (TL, coché) à "Trailing" (concurrents, X) — formulation trompeuse mais l'explainer détaillé + FAQ "What is the 40% rule?" font foi (source plus précise > tableau comparatif marketing). Pas de divergence retenue.
- Consistency 40% confirmé via FAQ "What is the 40% rule?" (question présente, phase eval uniquement — "No Consistency Rules" une fois funded, cohérent avec le dataset).
- Daily Loss Limit : aucune mention "Daily Loss" sur le site → cohérent avec dailyLoss=null/dailyLossSoft=false pour les 3 plans.
- Activation Fees : tableau comparatif confirme "$0" pour TL (JSON n'a pas de champ activationFee pour ce programme = cohérent).

UNVERIFIABLE :
- codeDiscountPct=15 (firm-level) — non publié publiquement, code affilié privé JTNQ. Voir `divergences.jsonl`.

## Top One Futures

Source primaire : `topone.html` = homepage toponefutures.com, comparateur Webflow (`acc__content__pane`) avec table par programme (par taille : price/target/drawdown/daily loss/consistency/contracts) + boutons "Get Funded" liés à checkout.toponefutures.com?type=...&size=... (query params confirmés = buy-screen fiable, pas juste marketing). Complété par vérification LIVE (playwright, 2026-07-19) sur toponefutures.com et checkout.toponefutures.com pour lever 2 ambiguïtés (voir divergences ci-dessous). ddType nature confirmée soit par le mot explicite "Trailing" dans le label de ligne ("Trailing max drawdown"), soit (Elite Daily, label différent "Max Loss Limit") via l'article officiel help.toponefutures.com.

Firm-level : split 90% OK. payout "On-demand" OK (cohérent, Elite Daily précise "Daily" comme argument produit spécifique, n'entre pas en contradiction). promo "40-50% OFF"/code SUMMER OK (confirmé sur Elite Challenge 40%, Elite Daily 50%, Instant/S2F/Ignite 40%) ; promoCode/promoLabel par programme tous confirmés dont Elite Access/code ACCESS/"2 for $19 each" (texte site : "Buy 2 or more accounts with code ACCESS and unlock $19 per account").

6 programmes / 24 plans. Champs vérifiés (10 champs x 24 plans = 240) : **233 OK, 7 DIVERGENT**.

ddType — citation par programme :
- **Elite Challenge** (EOD Trailing) : row label "Trailing max drawdown" + "Drawdown mode: End of day" (mot "Trailing" explicite).
- **Elite Daily** (EOD Trailing) : row label sur le site = "Max Loss Limit" (PAS "Trailing" — ambigu sur le buy-screen) → vérifié via help.toponefutures.com/en/articles/13904722 : "As your account grows, the drawdown level moves upward and locks in at your starting balance +$100 and does not continue to trail" + "does NOT trail intraday" → nature TRAILING (EOD) confirmée explicitement par le help center.
- **Elite Access** (EOD Trailing) : row label "Trailing max drawdown" + "Drawdown mode: End of day".
- **Instant Sim Funded** (EOD Trailing) : row label "Trailing max drawdown" + "Drawdown mode: End of day".
- **S2F Sim Pro** (Intraday) : row label "Trailing max drawdown" + "Drawdown mode: Intraday" → trail temps réel confirmé.
- **Ignite** (EOD Trailing) : row label "Trailing max drawdown" + "Drawdown mode: End of Day".

DIVERGENT (détail dans `divergences.jsonl`) :
- Instant Sim Funded 100k & 150k, Ignite 100k & 150k : `maxDrawdown` dataset = ancienne valeur (site a augmenté le drawdown room, ancien chiffre barré visible en marge du nouveau sur la page live — capture d'écran à l'appui).
- Elite Access (toutes tailles) : `originalPrice` ne correspond à aucun prix réel du parcours d'achat — recoupe exactement la colonne "Reset Fee on Funded" (frais de reset après funded, pas un prix barré). Prix réel vérifié au checkout live : Base Price $189.00 flat pour le plan 50k (aucune mention de $499). `price` lui-même est correct (vérifié au checkout réel).
- Elite Challenge & Elite Access (toutes tailles) : `consistency` reprend le chiffre de la règle FUNDED plutôt que CHALLENGE (qui est explicitement "None"/"None!" sur le buy-screen). Chiffre affiché non inventé mais mal étiqueté côté phase. Elite Daily, à l'inverse, reprend bien le chiffre CHALLENGE (cohérent).

## FundedSeat

Source primaire : capture fundedseat.html quasi vide (SPA lazy-load confirmé, comme signalé dans le brief) → contournée via playwright live (2026-07-19) sur fundedseat.com/#pricing-section (buy-screen réel, cartes par taille avec bouton "Add to Cart" → checkout.fundedseat.com/checkout/auth?productId=...) + réutilisation d'une capture antérieure du même jour (`code-baseline/result-fundedseat.json` + `code-baseline/proofs/fundedseat-before.png`) qui montre le récapitulatif de commande réel à l'étape checkout (pré-auth) pour le plan 1-Step $25,000 : Plan/Drawdown Mode EOD/Account Size/Subtotal $140.00/Discount -$63.05/Total $76.95 — confirme le prix ET le fait que le checkout expose "Drawdown Mode" mais sans préciser la nature (juste "EOD", ambigu sur ce buy-screen precis) → vérifié via help-center.fundedseat.com (voir ddType ci-dessous).

Firm-level : split 90% OK ("Keep 90% of your profits" + "90% profit split"). payout "Daily · 5h guaranteed" OK ("Get paid daily" / "5 Hours Guaranteed Payouts" / "5 hours payout"). promo "45% OFF + 50% w/ code JULY50, ends 2026-07-26" OK (bandeau site exact : "LIMITED TIME OFFER 45% OFF all accounts No Code required" + "Get 50% OFF your next 3 purchases: JULY50" + bannière "50% OFF YOUR NEXT 3 PURCHASES — USE CODE JULY50 — ENDS JULY 26").

2 programmes / 7 plans. Champs vérifiés (size, price, originalPrice, profitTarget, maxDrawdown, ddType, dailyLoss, dailyLossSoft, consistency, contracts) : **70 OK, 0 DIVERGENT, 0 UNVERIFIABLE.** Dataset le plus propre de l'audit — tous les chiffres (prix, target, drawdown, daily loss, consistency, contracts) recoupés 1:1 avec la carte de prix live pour les 7 plans (1-Step 25/50/100/150k + Instant Funding 25/50/100k).

ddType — citation (règle unique, partagée par les 2 programmes, buy-screen label = "EOD Drawdown" seul, ambigu) :
- Confirmé via help-center.fundedseat.com/en/articles/11173621-rules-eod-drawdown (officiel) : "If the account balance increased by the end of the day, the drawdown limit adjusts upward. If the account balance decreased, the drawdown remains unchanged." + "The EOD Trailing Drawdown locks when profits exceed the drawdown limit by $100." → nature TRAILING confirmée explicitement par le help center officiel (le terme "EOD Trailing Drawdown" est même utilisé littéralement par FundedSeat). ddType="EOD Trailing" correct pour 1-Step ET Instant Funding.
- Daily Loss Limit "(soft breach)" — libellé officiel confirme dailyLossSoft=true pour les 2 programmes.
- Consistency "35%" (1-Step) / "15% biggest trade" ("Biggest trade rule" — libellé officiel identique) confirmés phase evaluation (onglet "Evaluation Rules" actif par défaut sur la carte de prix).

## LEGENDS Trading

Source primaire : `new-firms/legends_plans_raw.html` (page /plans thelegendstrading.com, capturée 18 juil) + `legends_plans_text.txt` (texte nettoyé). Cartes de prix par taille avec bouton "Get started", montant "Save $X with code LTG" calculé en direct = buy-screen fiable. Page alimentée par l'API officielle du site elle-même (visible dans le JS embarqué : `https://api.thelegendstrading.com/shop/plans?purchasableOnly=true&broker=Tradovate`). Note : `new-firms/legends.json` est un fichier de travail (brouillon de notre propre pipeline, mêmes chiffres que le JSON live) — PAS utilisé comme source de vérité, seulement l'HTML brut capturé du site.

Firm-level : split 90% OK ("90/10 profit split" texte officiel). payout "Twice monthly" OK ("you can request payouts—up to twice per month" — citation exacte). promo "Apprentice 80% · Elite 35% off" OK — MAIS le bandeau marketing en haut de la page annonce "45% OFF ELITE" alors que le montant "Save $X with code LTG" affiché sur chaque carte Elite calcule très précisément 35% (ex 25k : $99→$64.35, Save $34.65 = 35,0%). Le chiffre carte (buy-screen, plus granulaire) fait foi > bandeau marketing générique ; notre 35% est correct, c'est le bandeau du SITE qui est incohérent en interne (non-imputable au dataset).

3 programmes / 12 plans. Champs vérifiés (size, price, originalPrice, profitTarget, maxDrawdown, ddType, dailyLoss, dailyLossSoft, consistency, contracts, + activationFee sur Apprentice) : **116 OK, 0 DIVERGENT, 0 UNVERIFIABLE.**

ddType — citation par programme (mot "trailing" explicite dans le libellé lui-même à chaque fois, aucune ambiguïté) :
- **Apprentice** (EOD Trailing) : cartes de prix = "$X EOD trailing max loss" (toutes tailles).
- **Elite** (EOD Trailing) : cartes de prix = "$X EOD trailing max loss" (toutes tailles).
- **Straight to Master** (EOD Trailing) : cartes de prix = "$X trailing max loss" (mot "EOD" absent du libellé sur ce programme précis mais "trailing" explicite conservé ; même mécanique que les 2 autres programmes, cohérent).

## E8 Markets — ATTENTION PRIORITAIRE (firme où le client a déjà trouvé une erreur ddType manuellement)

Sources croisées (3 sources indépendantes) : `new-firms/e8_all_tabs_FINAL.json` (buy-screen — Playwright DOM text du configurateur "Configure Your Account" live sur e8futures.com, les 3 onglets/10 tailles) ; `e8help-overview.html` (help center officiel, article comparatif "All product overviews E8 One vs E8 Zero vs E8 Pro vs E8 Signature") ; `helpfutures.e8markets.com/en/articles/15935817-e8-zero-starter-and-max` (help center FUTURES dédié, fetché live playwright 2026-07-19 après passage du challenge Cloudflare — voir `audit/e8_zero_article.txt`).

**Historique de l'erreur** : le fichier de travail `new-firms/e8.json` (brouillon, 18 juil, PAS la source de vérité) contient encore `ddType: "EOD"` pour E8 Zero MAX/Starter — une inférence basée sur un texte générique de `e8_translations_en.json` ("staticDrawdown... never moves... no trailing", non spécifiquement rattaché à Zero Futures, potentiellement copy Forex/CFD). Le dataset LIVE (`prop-firms.json`) a déjà corrigé en `"EOD Trailing"` pour les deux programmes Zero — **confirmé CORRECT** par re-vérification indépendante :
- Citation directe et non-ambiguë (help center futures dédié, article "E8 Zero (Starter and Max)") : *"3% EOD-Dynamic Drawdown – A moving loss limit based on your highest end-of-day balance. It only updates once per day at market close (intraday equity swings do not move it). It locks permanently at the initial balance level."* — "moving"/"locks" = trailing puis lock, confirme EOD Trailing.
- Corroboré par `e8help-overview.html` : "EOD Dynamic Drawdown | Moves based on closed profits only at End-Of Day | It became static once you reach the starting balance amount" (même mécanique décrite pour E8 Zero ET E8 Signature).
- Le même article confirme aussi Profit Target ($3,000/$6,500/$13,500 pour 50K/100K/200K) et "40% Best Day rule" (challenge) — recoupe exactement le dataset.
- **Root cause de l'ancienne erreur documentée pour éviter récidive** : `e8_translations_en.json` contient un item mal nommé (clé interne `"static"`, titre affiché "EOD Dynamic Drawdown", description "never moves... no trailing") — texte interne à E8 potentiellement incohérent ou relatif à un autre marché (Forex E8 Zero). Ne PAS réutiliser ce fichier de traductions comme source de nature ddType sans confirmation croisée help-center futures dédié.

E8 Signature Futures : ddType="EOD Trailing" confirmé via buy-screen ("Drawdown type: End of Day", générique mais cohérent) + `e8help-overview.html` (même citation "Moves...becomes static..." appliquée explicitement à Signature).

Reste des champs (buy-screen `e8_all_tabs_FINAL.json`, 3 programmes / 10 plans) :
- **E8 Signature** (25/50/100/150K) : price/originalPrice, profitTarget, maxDrawdown, contracts — tous OK (ex 25K : $83/$110, target $1,500, DD $1,000, "2" contrats = 2 minis/20 micros).
- **E8 Zero MAX** (50/100/200K) : price/originalPrice, profitTarget, maxDrawdown, consistency 40% — tous OK.
- **E8 Zero Starter** (50/100/200K) : idem MAX (règles identiques confirmées par l'article officiel : "Both versions have identical rules; the only difference is... payout caps"), tous OK.

Firm-level : split 80% OK ("Payout 80%" partout + "eligible to receive 80% or 100%"). payout "On-demand" OK (Zero : "Payout frequency: You can request it every day!"). promo "Up to 40% off with code E8" OK — Signature affiche ~25% avec code E8 ("Save $27 with code E8" sur $110), Zero affiche ~40% (ex $328→$197 = 39,9%) : le "Up to 40%" reflète bien le plafond (Zero), formulation correcte.

3 programmes / 10 plans. Champs vérifiés (10 champs x 10 plans, moins consistency/ddType déjà détaillés) : **~95 OK, 0 DIVERGENT, 0 UNVERIFIABLE.** Aucune divergence retrouvée — l'erreur historique ddType Zero est bien corrigée et re-confirmée par 2 sources officielles indépendantes supplémentaires.

## FundedNext

Source primaire : `new-firms/fundednext/chunk52_parsed.json` — payload RSC Next.js OFFICIEL de la section pricing live de fundednext.com (buy-screen exact : `discountedPrice`/`originalPrice`/`promoCode`/`challengeRules`/`fundedRewardRules` par plan, avec `learnMoreUrl` vers le help center officiel pour chaque règle). Qualité de source maximale — c'est littéralement le JSON qui alimente l'écran d'achat. Note : `new-firms/fundednext/fundednext.json` est un fichier de travail (mêmes chiffres que le JSON live), pas utilisé comme preuve indépendante.

Firm-level : promo "Rapid Pro and Rapid Daily: 50% Off (Futures)" / code RAPID50 OK (package "rapid" → `promoCode:"RAPID50"`, `savedAmount:"50%"`, exact). 

DIVERGENT (champs firm-level, valeur unique ne peut pas représenter les 4 programmes) :
- `split` = "90%" déclaré pour toute la firme, mais le payload officiel donne : Flex = "Up to 95%" (badge "Limited Time Offer"), **Legacy = "80%"**, Rapid Pro = "90%", Rapid Daily = "90%". Le 90% ne colle qu'à 2 programmes sur 4.
- `payout` = "Daily" déclaré pour toute la firme, mais le payload donne : Flex = "5 Days", Legacy = "5 Days", Rapid Pro = "3 Days", **Rapid Daily = "Daily"** (seul celui-ci est vraiment quotidien, cohérent avec son nom). Voir `divergences.jsonl` pour les citations exactes.

4 programmes / 12 plans. Champs vérifiés (size, price, originalPrice, profitTarget, maxDrawdown, ddType, dailyLoss, dailyLossSoft, consistency, contracts) : **118 OK, 2 DIVERGENT (firm-level split + payout), 0 UNVERIFIABLE.** Tous les champs par PLAN (les 10 x 12 = 120, dont ddType et dailyLossSoft) sont exacts à 100%.

ddType — citation unique (même mécanique confirmée littéralement pour les 4 programmes, texte extrait directement du payload buy-screen, aucune ambiguïté à lever) :
- **Flex / Legacy / Rapid Pro / Rapid Daily** (EOD Trailing, tous programmes) : `"label":"Max Loss Limit (EOD)"`, description officielle verbatim : *"How far your balance / equity can drop before the challenge attempt ends. Trails your highest end-of-day balance upward, then locks once the [threshold is reached]."* → mot "Trails" explicite directement dans le buy-screen (pas besoin de recours au help center ici).
- `dailyLossSoft=true` (Rapid Daily) confirmé par la description officielle du Daily Loss Limit : *"Exceeding it does not breach the account. It pauses your trading until the next day."* (soft breach = pause, pas de liquidation).


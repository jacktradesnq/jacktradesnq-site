# Sources — LEGENDS Trading & E8 Markets Futures

Extraction date: 2026-07-18. Method: raw HTML curl + regex/text parsing for Legends (static Webflow site); Playwright (self-contained npm install in this folder, chromium headless) + Nuxt SSR payload decoding for E8 (client-rendered Nuxt/Vue site). No LLM summarization was used to produce any number below — every value was read from machine-parsed HTML/DOM text or decoded JSON. WebSearch/WebFetch were used ONLY for secondary cross-checking against third-party aggregators, never as the primary source of a number.

All raw capture files live alongside this doc in the same folder (`new-firms/`):
- `legends_plans_raw.html` (curl of https://thelegendstrading.com/plans), `legends_plans_text.txt` (tag-stripped text dump, line-numbered)
- `e8futures_home_raw.html` (curl of https://e8futures.com), `e8_all_tabs_FINAL.json` (Playwright-extracted live "Configure Your Account" card text for all 3 tabs), `e8_compare_simfi_payload.json` + `e8_compare_simfi.decoded.json` (E8's internal product-catalog JSON, decoded from Nuxt's devalue flat-array format via `decode_nuxt_payload.py`)

---

## 1. LEGENDS Trading

Source: `curl https://thelegendstrading.com/plans` → 200, 137,689 bytes, Webflow static HTML (fully present in initial response, no JS rendering needed). Saved as `legends_plans_raw.html`, tag-stripped to `legends_plans_text.txt`.

Site nav confirms only 3 programs exist on the plans page: **Apprentice**, **Elite**, **Straight to master** (tab labels, `legends_plans_text.txt` lines 22-24). Each has exactly 4 sizes: $25K / $50K / $100K / $150K. → 3 × 4 = 12 plans (matches gate #1 expectation).

### Raw snippet — Apprentice $25,000 card (legends_plans_text.txt lines 26-42)
```
$25,000
Max 4 contracts / 40 micros
$165
$33
/ per month
Save
$132
with code
LTG
Get started
What's included
80% off Code: LTG
$1,500 profit goal
$1,500 EOD trailing max loss
Consistency 30%
4 days
$99 Activation Fee
```
→ price=33, originalPrice=165, profitTarget=1500, maxDrawdown=1500, ddType derived from literal "EOD trailing max loss", consistency=30%, contracts="4 minis/40 micros" (site says "contracts" not "Minis" here — same wording issue noted below), activationFee=99.

### Raw snippet — Elite $25,000 card (lines 98-115)
```
$25,000
Max 2 contracts / 20 micros
$99
$64.35
/ one time
Save
$34.65
with code
LTG
Get started
What's included
Code: LTG
$1,500 Profit Target
$1,250 EOD trailing max loss
Daily Loss Limit: None
Consistency: 40%
Contracts: 2 Minis / 20 Micros
Activation Fee: None
```
→ Confirms explicitly "Daily Loss Limit: None" and "Activation Fee: None" (only program that spells this out verbatim).

### Raw snippet — Straight to Master $100,000 and $150,000 cards (lines 207-240)
```
$100,000
Max 14 contracts / 70 micros
$599
$359.40
/ one time
Save
$239.60
with code
LTG
Get started
What's included
Code: LTG
$4,000 profit goal
$3.000 trailing max loss
Consistency 30%
10 days
Most Popular
$150,000
Max 17 contracts / 85 micros
$699
$419.40
/ one time
Save
$279.60
with code
LTG
Get started
What's included
Code: LTG
$6,250 profit goal
$4.000 trailing max loss
Consistency 30%
10 days
```

### Data quality notes / anomalies (Legends)
1. **Site-side typo, thousands separator**: several cards render profit goals / max-loss with a European-style dot instead of comma and sometimes drop the `$`, e.g. `3.000 profit goal` (Apprentice $50K), `$6.000 profit goal` (Apprentice $100K), `$9.000 profit goal` (Apprentice $150K), `$3.000 EOD trailing max loss` (Apprentice $100K), `$4.000 profit goal` / `$3.000 trailing max loss` / `$4.000 trailing max loss` (Straight to Master). These were parsed as the intended integer (dot = thousands separator, not decimal), e.g. `3.000` → 3000. This is a real bug on Legends' own site copy, not an extraction error — flagged here for Angelo, raw text preserved above as proof.
2. **Straight to Master profit-target break in pattern**: Apprentice and Elite both scale profit target at a flat 6% of size (25K→1500, 50K→3000, 100K→6000, 150K→9000). Straight to Master matches this at 25K (1500) and 50K (3000) but then drops to **4000 at 100K** (4%, not 6%) and **6250 at 150K** (4.17%, not 6%), while its max-drawdown $ values are identical to Apprentice's at every size (1500/2000/3000/4000). This looks like it could be a genuine (if irregular) site value, or a possible copy error on Legends' side — transcribed as-is from the live site, not "corrected" to the 6%-pattern. Flag for Angelo before publishing.
3. **Daily Loss Limit**: only the Elite tab explicitly states "Daily Loss Limit: None" in its card. Apprentice and Straight to Master cards simply don't show a daily-loss line at all (no value, no "None" either). Cross-checked against a third-party review (futurespropfirms.us, see §3 below) which states explicitly: *"The firm enforces no daily loss limit on any plan"* — used this as corroboration to set `dailyLoss: null` for all three Legends programs, not just Elite.
4. **ddType for Straight to Master**: its cards say plain "trailing max loss" (no "EOD" prefix), while Apprentice/Elite explicitly say "EOD trailing max loss". The FAQ block repeated on the same page names the concept sitewide as "EOD Trailing Max Loss Parameters" (see snippet below), and the third-party review explicitly says *"All Legends Trading evaluations use end-of-day (EOD) trailing drawdown, not intraday trailing"* — so `ddType: "EOD Trailing"` was applied uniformly across all 3 programs. Not 100% first-party-explicit for Straight to Master specifically, but two corroborating signals (sitewide FAQ term + independent review) support it. Flagged as an inference, not a direct quote, for this one program.
5. **Promo banner vs actual computed discount mismatch**: the sitewide banner (line 2 of `legends_plans_text.txt`) reads `🔥 80% off Apprentice & 45% OFF ELITE`. Computing the actual discount from the extracted numbers: Apprentice is indeed exactly 80% off at every size (33/165=0.20, 37/185=0.20, 45/225=0.20, 64/320=0.20 → 80% off, correct). **Elite is NOT 45% off** — actual computed discount is a consistent **35% off** at every size (64.35/99=0.65, 96.85/149=0.65, 117/180=0.65, 149.50/230=0.65 → 35% saved, not 45%). Straight to Master gets a consistent **40% off** (239.40/399=0.60, etc.) that isn't mentioned in the banner at all. `promo.label` in legends.json was kept as the LITERAL banner text (per the instruction to record what's publicly displayed), but this divergence is flagged here since it affects trust in the "45%" figure — real Elite discount is 35%.
6. FAQ text block on the same page (repeats near-identically under every question — looks like unfinished/placeholder CMS copy on Legends' side) does confirm the sitewide term: *"What Happens if I Go Over My Daily Max Loss or EOD Trailing Max Loss Parameters?"* (line 523) — used only to confirm terminology, not a numeric source.
7. `knowledge.thelegendstrading.com` (linked in footer) returned HTTP 403 on curl (Cloudflare/bot-block) — could not be used as a supplementary source. Not required given (3) and (4) above already had 2-source corroboration.
8. Contracts wording: Apprentice and Straight to Master cards literally say "Max N contracts / M micros" (not "Minis"), while Elite explicitly says "Max N Minis / M Micros" for the same ratio (always 1 mini : 10 micros at every size, every program). Normalized all three to the schema's "X minis / Y micros" format since the underlying ratio and contract class are identical — this is a wording normalization only, not a data change.
9. Split/payout (firm-level): "90/10 profit split — Join live funded after 2nd payout, and keep your 90/10 split" and "Flexible Payouts... you can request payouts—up to twice per month" (`legends_plans_text.txt` lines 496-498) → `split:"90%"`, `payout:"Twice monthly"`.

### Cross-check — third-party aggregator (Legends)
`WebFetch https://futurespropfirms.us/legends-trading-review/` (2026-07-18):
> "All Legends Trading evaluations use end-of-day (EOD) trailing drawdown, not intraday trailing... The firm enforces no daily loss limit on any plan... Traders keep a significant portion (90%) of the profits... Withdrawal frequency: Twice per month... The Straight to Master plan requires 10 trading days, with a 30% consistency rule."

This matches our extraction on: EOD trailing (✓), no daily loss (✓), 90% split (✓), twice-monthly payout (✓), Straight to Master 10 days / 30% consistency (✓). One **divergence**: this review states account sizes go "$25,000 - $250,000", but the live official /plans page (checked 2026-07-18) only lists 4 sizes up to $150,000, with no $200K/$250K tier anywhere in the current DOM. Treated the live official site as authoritative (current data) and flagged the $250K claim as likely stale/aggregator error — not included in legends.json.

---

## 2. E8 Markets — Futures only

**Critical routing finding**: `e8markets.com` is E8's forex/CFD/crypto site (confirmed via its own nav: "Forex Market" / ticker tape showing EURUSD, GBPUSD, leveraged FX pairs). The **futures product lives on a separate domain, `e8futures.com`** (linked from e8markets.com's nav as "Futures Market" → `https://e8futures.com`). All futures data below was pulled from `e8futures.com` exclusively. Nothing from `e8markets.com`'s own forex/CFD pricing was used.

`e8futures.com` is a Nuxt 3 (Vue) SSR app — curl gets the page shell but the actual "Configure Your Account" pricing widget renders client-side. Per the mission's fallback instruction, a self-contained Playwright (chromium headless, installed via `npm i playwright && npx playwright install chromium` inside `new-firms/`) was used to render the page, click "Configure Challenge", switch between the 3 account tabs, and read the resulting DOM text directly (`e8_extract_final.mjs` → `e8_all_tabs_FINAL.json`).

### Raw snippet — live DOM text, E8 Signature $25K card (`e8_all_tabs_FINAL.json`)
```
ACCOUNT SIZE

$25K

PRICE

$83
$110

Save $27 with code E8 on first order

Drawdown
4% Max
Payout
80%
GET STARTED
Challenge
Performance
CHALLENGE RULES
Profit Target
$1,500
Max drawdown
$1,000
Drawdown type
End of Day
Max contracts
2
REWARDS
Payout
80%
Pass in as little as
1 Day
Contains activation fee
No Activation Fee
```
(Full text for all 4 Signature sizes + all 3 Zero MAX sizes + all 3 Zero Starter sizes is in `e8_all_tabs_FINAL.json`, verbatim DOM `innerText`.)

### Cross-check #1 — E8's own internal product-rules JSON
While rendering the homepage, Playwright's network capture picked up `https://e8futures.com/compare-simfi-funded-accounts/_payload.json?...` (an SSR data payload for E8's own product-comparison page, fetched by the site itself, not by us guessing an API). This is Nuxt's `devalue`-style flat-array serialization (every value hoisted to an indexed cell, dict/array values referencing other cells by integer index, special 2-element tagged arrays like `["ShallowReactive", N]` unwrapping to cell N). Wrote a small generic decoder (`decode_nuxt_payload.py`) to reconstruct the nested object — no hand-guessing of values, pure structural graph resolution. Decoded output: `e8_compare_simfi.decoded.json`.

Relevant decoded entries (percentages, not $ — used to verify the $ values read live match `size × %` exactly):
```json
"e8signature_v_fu": {
  "customizable": false, "profit_split": 80, "profit_target": 6, "max_total_drawdown": 3,
  "balances": {"25000":{"price":110}, "50000":{"price":150}, "100000":{"price":260}, "150000":{"price":390}},
  "subtypes": [{"name":"phase1","min_profit":6,"max_total_drawdown_variants":{"25000":4,"50000":4,"100000":3,"150000":3}},
               {"name":"funded","max_daily_drawdown":2, ...}]
}
"e8zero_max_fu": {
  "profit_split": 80, "profit_target": 6, "max_total_drawdown": 3,
  "balances": {"50000":{"price":328}, "100000":{"price":588}, "200000":{"price":1088}},
  "subtypes": [{"name":"phase1","min_profit_variants":{"50000":6,"100000":6.5,"200000":6.75},"consistency":40}, ...]
}
"e8zero_start_fu": { same rules as e8zero_max_fu, "balances": {"50000":{"price":178}, "100000":{"price":278}, "200000":{"price":558}} }
```
Verification math (all exact matches, no rounding needed):
- Signature $25K: 25000×4%=$1,000 max DD ✓ (live card said $1,000); 25000×6%=$1,500 target ✓
- Signature $150K: 150000×3%=$4,500 ✓; 150000×6%=$9,000 ✓
- Zero (any tier) $100K: 100000×6.5%=$6,500 target ✓ (live card said $6,500, NOT a flat 6%=$6,000 — confirms the size-dependent target variant is real, not a copy error); 100000×3%=$3,000 max DD ✓
- Zero $200K: 200000×6.75%=$13,500 ✓; 200000×3%=$6,000 ✓
- Original ("was $X") prices for every size on every program match the catalog's `balances[size].price` exactly (110/150/260/390 for Signature; 328/588/1088 for Zero MAX; 178/278/558 for Zero Starter).

The internal catalog also lists several OTHER "_fu"-suffixed codes (`e8zero_fu`, `e8signature_fu`, `e8signature_fu_h`, `e8futures1`, `e8futures2`, `e8futures3`) that do **not** appear anywhere in the live "Configure Your Account" flow's 3 tabs (only `e8signature_v_fu` ≈ "E8 Signature", `e8zero_max_fu` ≈ "E8 Zero MAX", `e8zero_start_fu` ≈ "E8 Zero Starter" are actually sold today). Per the mission's instruction to exclude anything in doubt: **these extra codes were deliberately excluded** from e8.json as likely legacy/unlisted SKUs not currently for sale — only the 3 tabs a real visitor can click and buy were used.

### Cross-check #2 — official E8 help center article (first-party, separate subdomain)
`helpfutures.e8markets.com/en/articles/10155917-max-available-contract-sizes` (fetched via Playwright since direct curl/WebFetch got HTTP 403 from Cloudflare) — this is where the max-contracts numbers for the Zero family (missing from the Challenge-rules card UI) came from:
```
E8 Zero Futures Simfi Challenge
Account Balance | Maximum Contract Size
$200,000        | 10 Contracts ($100,000 margin)
$100,000        | 8 Contracts ($80,000 margin)
$50,000         | 4 contracts ($40,000 margin)

E8 Signature
Account Balance | Maximum Contract Size
$150,000 | 12 Contracts ($120,000 margin)
$100,000 | 8 Contracts ($80,000 margin)
$50,000  | 4 Contracts ($40,000 margin)
$25,000  | 2 contracts ($20,000 margin)
```
E8 Signature numbers match the live DOM card exactly (2/4/8/12 — confirmed twice, independently). E8 Zero's table (4/8/10 for 50K/100K/200K) is generic "E8 Zero Futures" — it does not separate MAX vs Starter, implying both share the same contract caps (see anomaly note below). Micros = contracts × 10 (margin $10,000 per mini-class future e.g. /ES, /NQ vs $1,000 per micro e.g. /MES, /MNQ, per the same article's margin table) → 4 minis/40 micros ($50K), 8 minis/80 micros ($100K), 10 minis/100 micros ($200K).

### Cross-check #3 — third-party aggregators
`WebFetch https://propfirmapp.com/prop-firms/e8-markets`:
> "Product Name: E8 Signature Futures... Profit Split: 80%... Payout Frequency: On-demand... $25K | $110 | $1,500 | $1,000 | ... 2 /ES, 20 /MES", "$50K | $150 | $3,000 | $2,000 | 4/ES 40/MES", "$100K | $260 | $6,000 | $3,000 | 8/ES 80/MES", "$150K | $390 | $9,000 | $4,500 | 12/ES 120/MES". "Drawdown Type: EOD (End-of-Day) Dynamic Drawdown... trails your end-of-day balance"; "Daily Pause (Performance Stage Only): 2% of initial balance... does not terminate account"; "Consistency... 35% Best Day Rule (applies Performance stage only)".

This is an exact match on all 4 sizes' original prices, profit targets, max drawdown $, and contracts — strong independent confirmation. It also clarifies that the 2% daily-pause and 35%-best-day rule apply **only at the funded/Performance stage**, not during the Challenge — consistent with the internal catalog (`phase1` subtype has no `max_daily_drawdown` / `consistency` key for `e8signature_v_fu`), which is why `dailyLoss: null` and `consistency: "None"` were used for E8 Signature Futures' eval-stage plans in e8.json (funded-stage-only rules are out of scope for the eval-plan schema, per the mission's field definitions).

`WebSearch` result quoting E8 Zero's own marketing copy (from e8markets.com's translations, general product family, en.json fetched during network capture):
> "E8 Zero is a one-phase challenge with a 6% profit target, a single 3% EOD drawdown, daily payouts and a 100% payout..." / definition of "staticDrawdown": "The {drawdown}% loss limit is calculated from your initial account balance. It never moves with your equity or closed profits." vs "EOD Dynamic Drawdown" (Signature): "trails your end-of-day balance — nothing moves intraday."

Used this to set `ddType: "EOD"` (fixed/static) for both Zero MAX Futures and Zero Starter Futures, vs `ddType: "EOD Trailing"` for Signature Futures — even though the live configurator UI shows the same generic "Drawdown type: End of Day" label for all three. This is an inference from official (if generic, company-wide rather than futures-specific) product-family copy, not a literal futures-page quote — flagged here for transparency. Note E8 Zero's 100% payout claim is for the FOREX/general product; the futures variant (`e8zero_max_fu`/`e8zero_start_fu`) is priced/shown at 80% payout by default on the live futures configurator (a `profit_splits:[80,100]` option exists in the internal catalog suggesting a possible 100%-split upgrade, but this was never shown/confirmed in the live UI — excluded from e8.json per "if in doubt, exclude and note").

`damnpropfirms.com/futures-prop-firms/e8-futures/` gave **divergent, likely-stale numbers** for E8 Signature Futures ($66/$90/$156/$234 "monthly" for 25K/50K/100K/150K, and claimed "100% profit split" and a "T1 news flatten rule"). These don't match the live site, propfirmapp, funded.now, or the internal catalog (all four of which agree tightly on $110/$150/$260/$390 one-time, 80% split). Treated damnpropfirms as unreliable/outdated for this firm and **did not use it** for any number in e8.json — flagged here as the "divergence vs aggregator" the mission asked to record.

### Anomaly / open question — E8 Zero MAX vs Zero Starter
Every rule field read (profit target, max drawdown %, consistency, contracts) is **identical** between "E8 Zero MAX Futures" and "E8 Zero Starter Futures" at every matching size — only price differs (MAX costs ~80-90% more than Starter for the same size). The internal catalog's `custom_options.profit_splits: [80, 100]` array on both suggests MAX might unlock an optional 100% profit-split configuration not exposed as a separate line item in the default Challenge-rules card (Starter might be locked to 80% only) — this is a plausible explanation but **not directly confirmed** anywhere in the rendered UI or help articles fetched. Flagged for Angelo rather than guessed into the JSON.

### Gate check — no leverage/FX in e8.json
All e8.json data was sourced exclusively from `e8futures.com`'s futures-only "Configure Your Account" flow and futures-only help center (`helpfutures.e8markets.com`). No leverage ratios, no FX pairs, no CFD terminology appear anywhere in e8.json. Contract instruments referenced in sourcing (ES/MES, NQ/MNQ, CL/MCL, GC/MGC, etc.) are all CME/NYMEX/COMEX/CBOT futures, confirmed via the official futures margin table (`e8_help_contracts.txt`).

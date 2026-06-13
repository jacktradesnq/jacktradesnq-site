## Sweep → Continuation or Retrace? (NQ)

Me and a mate kept arguing about this one. A wick sweeps a recent high or low, then closes back on the wrong side — does price keep running in the sweep direction, or come back to re-tag the level it just swept? I ran both definitions over every NQ sweep in 10 years to settle it.

### How I set it up

- NQ continuous front-month, 5-minute bars
- 2016-01-03 → 2026-05-11
- 52,355 sweeps (27,196 bearish, 25,159 bullish), out of 703,918 bars
- Sweep = a wick takes out a recent pivot (6-bar lookback) then closes back wrong-side
- Continuation = price extends 3× ATR *before* re-tagging the swept level
- Retrace = it re-tags the swept level first
- Cont within 6h = continuation reached within six hours, whatever happens in between
- Everything is ATR-relative so the numbers hold across regimes

### The base rate

All 52,355 sweeps:

- **Retrace first: 83.5%** — coming back to re-tag the level before a 3× ATR run is the norm by a mile.
- **Immediate continuation: 8.9%** — a clean run with no pullback is rare.
- Neither: 7.2%.
- But continuation *does* eventually show up **61.3%** of the time within six hours.

One honest caveat: the retrace target is close and the continuation target (3× ATR) is far, so that 83.5% is mechanically inflated. Don't read the absolute number — read the *relative* gaps between sessions below, where the definition is the same everywhere.

### By session

| Session | Retrace first | Immediate cont. | Cont. within 6h |
|---|---|---|---|
| Asia | 81.4% | 6.3% | 42.6% |
| London | 85.2% | 5.0% | 63.2% |
| NY AM | 83.5% | 9.0% | highest |

London sweeps re-tag the most before running, but they reach continuation within six hours way more than Asia (63.2% vs 42.6%) — it's a slow re-tag-then-go. NY AM gives the highest *immediate* continuation, which fits the session's bigger displacement.

So who won the argument? Expecting a re-tag before the run is the right base case every session — fading the immediate continuation is statistically the safer side. But a re-tag is an entry timing, not a reversal: continuation still arrives 61% of the time. The thing that actually separates the sweeps that run immediately is how much the sweep bar displaced.

---

Not financial advice. These datas are AI-gathered and could be wrong — backtest it yourself before you trade any of it.

## Sweep → Continuation or Retrace? (NQ)

A common argument: when a wick sweeps a recent high or low and closes back the wrong way, does price *continue* in the sweep direction, or does it *retrace* to re-tag the level it just swept? This study runs both definitions across every qualifying sweep in 10 years of NQ to settle which is the norm.

### Definition

- Instrument: NQ continuous front-month futures, 5-minute bars
- Period: 2016-01-03 → 2026-05-11
- Sweep events: **52,355** (27,196 bearish, 25,159 bullish), from 703,918 five-minute bars
- **Sweep**: a wick that takes out a recent pivot (6-bar lookback) then closes back on the wrong side
- **Continuation**: price extends 3× ATR *before* re-tagging the swept level
- **Retrace**: price re-tags the swept level first
- **Cont within 6h**: continuation target reached within six hours regardless of retrace
- All thresholds are ATR-relative, so the numbers hold across regimes

### The base rate

Across all 52,355 sweeps:

- **Retrace first: 83.5%** — re-tagging the swept level before a 3× ATR extension is the overwhelming norm.
- **Immediate continuation: 8.9%** — a clean run before any pullback is rare.
- **Neither: 7.2%**.
- But continuation *eventually* arrives **61.3%** of the time within six hours.

The important caveat: the retrace target sits close and the continuation target (3× ATR) sits far, so the absolute retrace number is mechanically inflated. The honest read is the *relative* comparison between conditions — same definition everywhere — not the raw 83.5%.

### By session

| Session | Retrace first | Immediate cont. | Cont. within 6h |
|---|---|---|---|
| Asia | 81.4% | 6.3% | 42.6% |
| London | 85.2% | 5.0% | 63.2% |
| NY AM | 83.5% | 9.0% | (highest immediate) |

London sweeps retrace the most before extending but reach continuation within six hours far more than Asia (63.2% vs 42.6%) — the London sweep is a slow re-tag-then-go. NY AM produces the highest *immediate* continuation rate, consistent with the session's higher displacement.

### Context

The takeaway is structural, not a trade: expecting price to re-tag a swept level before it runs is the base case across every session — fading the immediate continuation is statistically "with the grain," but the 61% eventual-continuation rate means a re-tag is an entry timing, not a reversal signal. The single biggest driver of which sweeps *do* run immediately is the displacement of the sweep bar itself. Behaviour only — no edge promise.

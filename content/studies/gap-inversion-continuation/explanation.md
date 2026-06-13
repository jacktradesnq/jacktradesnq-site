## Gap Inversion → Hourly Continuation (NQ)

When NQ gaps at a session open, trades back through the prior close (an **inversion**), and the first hour then closes *against* the gap, does the second hour keep pushing in that new direction? This study measures the conditional hourly continuation rate against the unconditional base rate, over the full 10-year NQ history.

### Definition

- Instrument: NQ continuous front-month futures, 1-hour bars
- Period: 2016-04-20 → 2026-05-11 (10 years)
- Nights observed: **2,063**
- Baseline hourly pairs: **33,739**
- **Bearish setup**: gap-up that inverts (H1 low trades below the prior close) **and** H1 closes red → measure H2
- **Bullish setup** (symmetric): gap-down that inverts (H1 high trades above the prior close) **and** H1 closes green → measure H2

### Baseline — what an average hour does

Across all 33,739 hourly pairs with no condition attached:

- A given hour makes a **lower low** than the prior hour **43.6%** of the time.
- It makes a **higher high** **48.6%** of the time.

These are the numbers any conditional setup has to beat to be meaningful.

### Bearish setup — gap-up, inverted, red H1

On the **414** nights that matched (gap-up, price inverts below prior close, first hour closes red):

- H2 makes a **lower low 57.3%** of the time — versus the 43.6% baseline. That is a **+13.6 point** edge.
- H2 closes red **47.8%** of the time.
- Clean continuation down (lower low *and* red close) **39.1%** of the time.

The inversion plus a red first hour shifts the odds of a second-hour extension meaningfully above random, but the *close* stays near a coin flip — the extension shows up in the wick (lower low) more reliably than in the body.

### Bullish setup — gap-down, inverted, green H1

The mirror condition on **490** nights:

- H2 makes a **higher high 61.4%** of the time — versus the 48.6% baseline (**+12.8 points**).
- Clean continuation up **44.9%** of the time.

The bullish side is slightly stronger than the bearish side, consistent with NQ's long-run upward drift.

### Recent regime (2025–2026)

Narrowing to the current regime sharpens the bearish signal considerably. On the **61** matching nights in 2025–2026:

- H2 makes a lower low **63.9%** of the time, versus a **40.0%** baseline in the same window — a **+23.9 point** edge.

The 2025–26 regime, with its wide weekend and macro gaps, produces cleaner inversions: when the gap fails and the first hour confirms, the second hour follows through far more often than the 10-year average suggests. The sample is small (61 nights), so treat the magnitude as indicative rather than precise.

### Context

These are conditional probabilities, not a trade plan. A 57–64% lower-low rate is an edge over the base rate, not a guarantee — the close rates near 48% show that a "continuation" hour still round-trips often. The number describes how NQ behaves after a failed gap; it does not tell you where to enter, where to stop, or what to risk. Trade what you see.

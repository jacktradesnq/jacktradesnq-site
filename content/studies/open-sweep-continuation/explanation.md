## PDH/PDL Sweep at the 18:00 & London Opens (NQ)

Both the 18:00 ET re-open and the 02:00 ET London open frequently spike straight into the prior day's high or low. This study measures how often that first-3-minute sweep happens, and — once it does — whether price continues through the level or reverses back inside, across the 2024–2026 regime.

### Definition

- Instrument: NQ continuous front-month futures, 1-minute bars
- Window: 2024-01-01 → 2026-05-31 (recent regime); 10-year history also computed
- **PDH / PDL**: high / low of the most recent completed RTH session (09:30–16:00 ET)
- **Sweep**: any bar in the first 3 minutes after the open trades through PDH (up) or PDL (down)
- **Continuation**: price extends past the sweep extreme before any bar trades back through the level (first event wins)
- **Reversal**: any post-sweep bar trades back through the level (not mutually exclusive with continuation)

### 18:00 ET open

| Setup | Sweep rate | Continuation | Closes beyond | Reversal |
|---|---|---|---|---|
| PDH sweep-up | 36.7% (223 nights) | 76.7% | 86.5% | 31.8% |
| PDL sweep-down | 22.2% (135 nights) | 66.7% | 82.2% | 34.8% |

At the 18:00 open, sweeping the prior high is the more common event (36.7% of nights) and the more continuation-prone: when NQ pokes PDH in the first three minutes, it keeps going 76.7% of the time and closes the window beyond the level 86.5% of the time. Sweep-downs are rarer and slightly less clean.

### London 02:00 ET open

| Setup | Sweep rate | Continuation | Closes beyond | Reversal |
|---|---|---|---|---|
| PDH sweep-up | 20.4% (124 nights) | 82.3% | 73.4% | 52.4% |
| PDL sweep-down | 12.4% (75 nights) | 76.0% | 69.3% | 57.3% |

London sweeps are less frequent but show the highest *continuation* rate (82.3% on the up side) — yet also the highest *reversal* rate (52.4%). That is not a contradiction: continuation and reversal are measured independently, so a London sweep often pushes past the level *and* later trades back through it. The London open both extends and round-trips more than 18:00.

### Context

These are descriptive frequencies on a recent-regime sample, not a trade plan. A 76–82% continuation rate is conditional on the sweep already having happened in the first three minutes — and the high London reversal rate warns that "continuation" here does not mean "no pullback." Behaviour only.

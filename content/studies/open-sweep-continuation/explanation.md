## PDH/PDL Sweep at the 18:00 & London Opens (NQ)

NQ loves spiking straight into the prior day's high or low right as the 18:00 re-open or the 02:00 London open hits. I wanted to know how often that first-3-minute sweep actually happens, and once it does, whether price keeps going through the level or snaps back. Recent regime (2024–26).

### How I set it up

- NQ continuous front-month, 1-minute bars
- 2024-01-01 → 2026-05-31 (also ran the full 10y)
- PDH / PDL = high / low of the last completed RTH session (09:30–16:00 ET)
- Sweep = any bar in the first 3 minutes trades through PDH (up) or PDL (down)
- Continuation = price pushes past the sweep extreme before trading back through the level
- Reversal = a later bar trades back through the level (measured separately — a sweep can do both)

### 18:00 ET open

| Setup | Sweep rate | Continuation | Closes beyond | Reversal |
|---|---|---|---|---|
| PDH sweep-up | 36.7% (223 nights) | 76.7% | 86.5% | 31.8% |
| PDL sweep-down | 22.2% (135 nights) | 66.7% | 82.2% | 34.8% |

At 18:00 the prior high gets poked more often (36.7% of nights) and it's the cleaner one — when NQ takes PDH in the first 3 minutes it keeps going 76.7% of the time and closes beyond the level 86.5%. Sweep-downs are rarer and a touch messier.

### London 02:00 ET open

| Setup | Sweep rate | Continuation | Closes beyond | Reversal |
|---|---|---|---|---|
| PDH sweep-up | 20.4% (124 nights) | 82.3% | 73.4% | 52.4% |
| PDL sweep-down | 12.4% (75 nights) | 76.0% | 69.3% | 57.3% |

London sweeps less often but has the highest continuation (82.3% up) — and also the highest reversal (52.4%). Not a contradiction: I measure them separately, so London often pushes past the level *and* later trades back through it. London both runs and round-trips more than 18:00.

Heads up: these are recent-regime numbers and the continuation rate only counts once the sweep already happened in the first 3 minutes. And the high London reversal rate means "continuation" there does not mean "no pullback."

---

Not financial advice. These datas are AI-gathered and could be wrong — backtest it yourself before you trade any of it.

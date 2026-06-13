## The 8:30 Candle — First Move & Reversal (NQ)

Most US data drops at 08:30 ET, and the first 1-minute candle after the release sets a high and a low that the rest of the morning trades around. This study measures, per event, which side of that candle breaks first, how often the *opposite* side gets taken in the same session, and how long it takes. Full 10-year history.

### Definition

- Instrument: NQ continuous front-month futures, 1-minute bars (FOMC excluded)
- Period: 2016-01-07 → 2026-06-04 · **1,166** release days · session end 17:00 ET
- The **8:30 candle** is the 1-minute bar printing at 08:30 ET
- **First side** = which of its high/low the first post-candle breakout takes
- **Other hit** = the opposite side is later touched (08:31–17:00)
- **Close confirms** = price closed strictly beyond the first-side level before the opposite was touched

### By event (NQ)

| Event | n | Other side hit | Close confirms | Median mins to other side | 8:30 candle width |
|---|---|---|---|---|---|
| CPI | 126 | 73.0% | 92.1% | 62 min | 71.8 pts |
| NFP | 124 | 70.2% | 88.6% | 42 min | 59.6 pts |
| PPI | 126 | 75.4% | 87.1% | 61 min | 32.3 pts |
| PCE | 122 | 82.0% | 91.5% | 27 min | 24.2 pts |
| GDP | 122 | 85.2% | 79.1% | 36 min | 17.9 pts |
| Retail Sales | 90 | 78.9% | 81.4% | 31 min | 22.4 pts |
| Jobless Claims | 328 | 86.6% | 83.3% | 18 min | 12.5 pts |

### What it says

Two patterns hold across every 08:30 event:

- **The other side almost always gets taken.** Even on the most directional prints (CPI, NFP) the opposite side of the 8:30 candle is hit 70%+ of the time, climbing to 85%+ on lower-impact data like Jobless Claims and GDP. Single-direction days are the exception.
- **Impact scales the candle and slows the reversal.** CPI and NFP print the widest 8:30 candles (60–72 pts) and take the longest to revisit the other side (42–62 min). Low-impact Jobless Claims prints a 12-pt candle and round-trips in 18 minutes. Bigger the surprise, wider the candle, longer it commits before reversing.

Close-confirmation is high everywhere (79–92%): when a side breaks, price usually closes beyond it before any reversal — the first move is real, it just rarely is the *only* move.

### Context

These are first-move and reversal frequencies, not a trade. "The other side gets taken 70–86% of the time" describes the round-trip tendency of news candles — it does not tell you which side breaks first or where to enter. Behaviour only, across NQ; the same study runs on ES, GC and SI in the hub.

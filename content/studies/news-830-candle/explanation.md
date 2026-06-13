## The 8:30 Candle — First Move & Reversal (NQ)

Most US data drops at 08:30 ET, and that first 1-minute candle prints a high and a low the rest of the morning trades around. I went through every event to see which side breaks first, how often the *other* side gets taken later, and how long that takes. 10 years.

### How I set it up

- NQ continuous front-month, 1-minute bars (FOMC left out)
- 2016-01-07 → 2026-06-04, 1,166 release days, session ends 17:00 ET
- The 8:30 candle = the 1-min bar printing at 08:30 ET
- First side = which of its high/low the first breakout takes
- Other hit = the opposite side gets touched later (08:31–17:00)
- Close confirms = price closed beyond the first side before the other one got touched

### By event (NQ)

| Event | n | Other side hit | Close confirms | Median mins to other side | Candle width |
|---|---|---|---|---|---|
| CPI | 126 | 73.0% | 92.1% | 62 min | 71.8 pts |
| NFP | 124 | 70.2% | 88.6% | 42 min | 59.6 pts |
| PPI | 126 | 75.4% | 87.1% | 61 min | 32.3 pts |
| PCE | 122 | 82.0% | 91.5% | 27 min | 24.2 pts |
| GDP | 122 | 85.2% | 79.1% | 36 min | 17.9 pts |
| Retail Sales | 90 | 78.9% | 81.4% | 31 min | 22.4 pts |
| Jobless Claims | 328 | 86.6% | 83.3% | 18 min | 12.5 pts |

### What it says

Two things hold on every 08:30 event:

- **The other side almost always gets taken.** Even on the violent prints (CPI, NFP) the opposite side of the 8:30 candle gets hit 70%+ of the time, up to 85%+ on the smaller data like Jobless Claims and GDP. A one-way day is the exception, not the rule.
- **Bigger the impact, wider the candle, slower the reversal.** CPI and NFP print the widest 8:30 candles (60–72 pts) and take the longest to come back to the other side (42–62 min). Jobless Claims prints a 12-pt candle and round-trips in 18. The bigger the surprise, the longer price commits before flipping.

Close-confirmation is high everywhere (79–92%): when a side breaks, price usually closes beyond it before any reversal. So the first move is real — it's just rarely the *only* move.

This is round-trip tendency, not direction — it doesn't tell you which side breaks first. Same study runs on ES, GC and SI in the hub.

---

Not financial advice. These datas are AI-gathered and could be wrong — backtest it yourself before you trade any of it.

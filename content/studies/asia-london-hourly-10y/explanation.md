## Asia → London — Does Asia Predict London? (NQ)

Asia sets the overnight box, London usually runs it. I wanted three things from this: which Asia level London takes more often, how often the sweep actually reverses (the turtle soup), and whether the *size* of Asia tells you anything about London. 10 years.

### How I set it up

- NQ continuous front-month, 1-minute bars
- 2016-01-01 → 2026-12-31, 2,599 nights
- Asia killzone 18:00–00:00 ET, post-Asia sweep window 02:00–07:00 ET

### Which Asia level does London take?

Over the 02:00–07:00 ET window:

- Sweeps the **Asia high**: **56.0%** of nights (high only 42.5%)
- Sweeps the **Asia low**: **44.5%** (low only 31.0%)
- Both: 13.5% · Neither: 13.0%

London leans up — it takes the Asia high more than the low, which fits NQ drifting up. A clean one-sided raid (one level, not both) happens about 3 nights in 4.

### The turtle soup (sweep one side, break the other)

The proper reversal — London sweeps one Asia extreme then breaks the other — is rare:

- Sweep Asia **low** first, then break the **high** (bullish): **6.3%** of nights
- Sweep Asia **high** first, then break the **low** (bearish): **7.2%**

So roughly 1 night in 15 per direction. It's real, just not common — most sweeps keep going rather than fully flip across the box.

### Does a big Asia mean a big London?

I split nights into quartiles by Asia range and measured London's expansion rate:

| Asia range quartile | Mean Asia range | London expansion rate |
|---|---|---|
| Q1 (smallest) | 18.0 pts | 42.2% |
| Q2 | 42.9 pts | 43.5% |
| Q3 | 75.3 pts | 41.9% |

London expands about **42% no matter how big or small Asia was**. A tight Asia doesn't mean a tight London, a wide Asia doesn't mean a wide one — Asia range tells you basically nothing about London. Each session sets its own range.

That last one is the useful bit: stop sizing London off what Asia did. The 56/44 high-vs-low lean and the ~7% turtle soup are tendencies, not triggers.

---

Not financial advice. These datas are AI-gathered and could be wrong — backtest it yourself before you trade any of it.

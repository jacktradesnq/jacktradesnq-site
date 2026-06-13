## NFP — Both-Side Sweep Timing (NQ)

NFP whips both directions before it commits, and you get chopped if you pick a side early. I wanted the timing: how often NQ takes out *both* sides of the tight pre-release range, and when it does, whether it's finished in the 08:30 premarket reaction or it waits for the 09:30 cash open. 10 years.

### How I set it up

- NQ continuous front-month, 1-minute bars
- 2016-01-08 → 2026-05-08, 121 NFP days (FRED dates)
- Reference range = high/low of the 08:15–08:30 ET consolidation right before the print
- Both-side swept = price trades above the ref high *and* below the ref low same day (08:30–16:00)
- Timing = when the *second* side gets taken
- Pre-9:30 = done in the 08:30 premarket reaction · Post-9:30 = at/after the cash open

### Full history (2016–2026)

- **Both sides swept same day: 81.8%** of NFP days.
- Of those, **73.7%** were done **before 09:30** — in the premarket.
- Only 26.3% waited for the cash open or later.
- The first side went pre-9:30 on **100%** of both-side days.

So 4 NFP days in 5, NQ runs both ways — and when it does, the whole round-trip is usually over before New York even opens. The first side *always* goes in the premarket. The 08:30 print is where the violence is, not 09:30.

### Recent regimes

| Window | n | Both-side same day | Of those, pre-9:30 |
|---|---|---|---|
| 2024+ | 29 | 86.2% | 76.0% |
| 2025+ | 15 | 80.0% | 83.3% |
| Full 10y | 121 | 81.8% | 73.7% |

It's stable, and if anything getting earlier: in 2025+, when both sides go, **83.3%** are done before 09:30. The premarket is doing *more* of the work, not less.

This tells you *when to expect the chop*, not which way it breaks — an 81.8% both-side rate is the opposite of a directional read. Point is the structure: the range gets taken at 08:30, not at the cash open.

---

Not financial advice. These datas are AI-gathered and could be wrong — backtest it yourself before you trade any of it.

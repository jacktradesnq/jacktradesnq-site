"""NFP IFVG: 3 exit variants × ES SMT × side filter × year breakdown.

For each NFP event passing sweep+IFVG+geom:
  - Variant A "no_be"   : pure SL/TP/timeout
  - Variant B "be_50"   : MFE>=50% TP-dist arms BE
  - Variant C "tp1_be"  : MFE>=50% closes half at +50% TP-dist, remainder runs to TP / BE / timeout

Plus ES SMT confirmation:
  - SHORT (NQ swept UP): SMT = ES low_swept (ES_low < ES_pre_low during 8:30-11:00 ET)
  - LONG  (NQ swept DOWN): SMT = ES high_swept

Output: /Users/angelo/jacktradesnq-news830/public/data/news-830-model.json
108 rows = 3 variants × 2 SMT × 3 side × 6 years.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from data import load_bars
from run_nfp_be50 import (
    load_nfp_events,
    PRE_LOOKBACK_MIN,
    TIMEOUT_SWEEP_HOUR_ET,
    TIMEOUT_RESOLVE_HOUR_ET,
    TICK,
    ET,
    DATE_FROM,
    DATE_TO,
    SYMBOL,
)
from run_news_830_v2 import find_3bar_fvg, scan_bars_last_close

sys.path.insert(0, "/Users/angelo/monfxreplay-python")
from costs import cost_per_trade


OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "output", "nfp-ifvg-smt-3way.json")
YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]
SIDES = ["BOTH", "LONG", "SHORT"]
SMTS = [False, True]
SMT_MODES = ["off", "target", "mirror"]
VARIANTS = ["no_be", "be_50", "tp1_be"]


def index_bars(symbol: str) -> dict[int, dict]:
    print(f"[load] {symbol} 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    rows = load_bars(symbol, DATE_FROM, DATE_TO)
    bars_idx = {int(r["ts"]): {"open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"]} for r in rows}
    print(f"[load] {symbol} {len(bars_idx)} bars indexed", file=sys.stderr)
    return bars_idx


def detect_setup(ev: dict, bars_idx: dict[int, dict]) -> dict:
    """Run sweep + IFVG entry detection. Returns dict with status + entry data."""
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]
    out = {
        "date": ev["date"],
        "et_date": et_date,
        "year": et_date[:4],
        "t0_utc": t0,
    }

    # Release-bar range: single 8:30 ET 1m candle at t0 (BUG 6 fix; was max/min over 5 prior bars).
    # PRE_LOOKBACK_MIN kept imported for compat but unused here.
    release_bar = bars_idx.get(t0)
    if release_bar is None:
        out["status"] = "SKIP_NO_PRE"; return out
    pre_high = release_bar["high"]
    pre_low = release_bar["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(TIMEOUT_SWEEP_HOUR_ET, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())
    resolve_deadline_ts = int(deadline_et.replace(hour=TIMEOUT_RESOLVE_HOUR_ET).timestamp())

    # Sweep watch starts at t0+1 (8:31), AFTER the release bar closes (BUG 6 fix).
    sweep_dir = sweep_price = sweep_ts = None
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            up = b["high"] > pre_high
            dn = b["low"] < pre_low
            if up and dn:
                if (b["high"] - pre_high) >= (pre_low - b["low"]):
                    sweep_dir, sweep_price = "UP", b["high"]
                else:
                    sweep_dir, sweep_price = "DOWN", b["low"]
                sweep_ts = cur
                break
            if up:
                sweep_dir, sweep_price, sweep_ts = "UP", b["high"], cur; break
            if dn:
                sweep_dir, sweep_price, sweep_ts = "DOWN", b["low"], cur; break
        cur += 60
    if sweep_dir is None:
        out["status"] = "SKIP_NO_SWEEP"; return out

    side = "SHORT" if sweep_dir == "UP" else "LONG"
    sl = sweep_price + TICK if sweep_dir == "UP" else sweep_price - TICK
    tp = pre_low if sweep_dir == "UP" else pre_high

    scan_bars = []
    cur = sweep_ts
    while cur <= resolve_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            scan_bars.append({"ts": cur, **b})
        cur += 60
    if len(scan_bars) < 3:
        out["status"] = "SKIP_NO_SCAN_BARS"; return out

    # Both-sides-swept invalidation level:
    #   sweep UP   → watch for pre_low - 1 tick being touched BEFORE IFVG break
    #   sweep DOWN → watch for pre_high + 1 tick being touched BEFORE IFVG break
    # If TP-side gets swept before entry triggers, TP is already gone → no edge.
    opp_level_low = pre_low - TICK   # used when sweep_dir == "UP"
    opp_level_high = pre_high + TICK  # used when sweep_dir == "DOWN"

    pending_fvgs: list[dict] = []
    entry_ts = entry_price = None
    both_sides_swept = False
    for n, bar in enumerate(scan_bars):
        # Check opposite-side sweep BEFORE evaluating IFVG break on this bar.
        # Skip the sweep bar itself (n==0) — the same bar that set the first sweep
        # cannot count as "both sides swept" against itself.
        if n > 0:
            if sweep_dir == "UP" and bar["low"] <= opp_level_low:
                both_sides_swept = True
                break
            if sweep_dir == "DOWN" and bar["high"] >= opp_level_high:
                both_sides_swept = True
                break
        for fvg in pending_fvgs:
            if sweep_dir == "UP":
                if bar["close"] < fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]; break
            else:
                if bar["close"] > fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]; break
        if entry_ts is not None:
            break
        if n >= 2:
            a = scan_bars[n - 2]; b_ = scan_bars[n - 1]; c = scan_bars[n]
            if (b_["ts"] - a["ts"] == 60) and (c["ts"] - b_["ts"] == 60):
                fvg = find_3bar_fvg(a, b_, c, sweep_dir)
                if fvg is not None:
                    pending_fvgs.append(fvg)

    if both_sides_swept:
        out["status"] = "SKIP_BOTH_SIDES_SWEPT"
        out["sweep_dir"] = sweep_dir
        out["sweep_ts"] = sweep_ts
        out["pre_high"] = pre_high
        out["pre_low"] = pre_low
        return out

    if entry_ts is None:
        out["status"] = "SKIP_NO_IFVG"; return out

    if side == "SHORT":
        if entry_price >= sl or entry_price <= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out
    else:
        if entry_price <= sl or entry_price >= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out

    out["status"] = "OK"
    out["side"] = side
    out["sweep_dir"] = sweep_dir
    out["sweep_ts"] = sweep_ts
    out["pre_high"] = pre_high
    out["pre_low"] = pre_low
    out["entry_ts"] = entry_ts
    out["entry_price"] = entry_price
    out["sl"] = sl
    out["tp"] = tp
    out["resolve_deadline_ts"] = resolve_deadline_ts
    return out


def simulate_variant(setup: dict, variant: str, bars_idx: dict[int, dict]) -> dict:
    """Simulate exit for given variant. Returns {result, pts}."""
    side = setup["side"]
    entry_price = setup["entry_price"]
    entry_ts = setup["entry_ts"]
    sl = setup["sl"]
    tp = setup["tp"]
    resolve_deadline_ts = setup["resolve_deadline_ts"]

    tp_dist = abs(tp - entry_price)
    half_target = 0.5 * tp_dist  # +50% target for half close in tp1_be

    be_active = False
    half_closed = False  # for tp1_be only
    half_pts = 0.0

    mfe = 0.0
    cur = entry_ts + 60
    result = None
    exit_price = None
    exit_ts = None

    while cur <= resolve_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            if side == "SHORT":
                fav = entry_price - b["low"]
                if fav > mfe: mfe = fav
                hit_sl = b["high"] >= sl
                hit_tp = b["low"] <= tp
                # Half-target hit on this bar?
                hit_half = (variant == "tp1_be") and (not half_closed) and (b["low"] <= entry_price - half_target)
                hit_be_retest = be_active and (b["high"] >= entry_price)

                # Resolve order: SL has priority over BE on same bar (worst-case honest)
                if hit_sl and hit_tp:
                    full_loss = entry_price - sl  # negative
                    if variant == "tp1_be" and half_closed:
                        result = "LOSS_HALF_BE" if be_active else "LOSS_HALF"
                        # half locked at +half_target ; remainder = BE (0) if be_active else SL
                        rem = 0.0 if be_active else (entry_price - sl)
                        pts = 0.5 * half_target + 0.5 * rem
                        exit_price = sl
                    else:
                        result = "LOSS"
                        pts = full_loss
                        exit_price = sl
                elif hit_sl:
                    if variant == "tp1_be" and half_closed:
                        rem = 0.0 if be_active else (entry_price - sl)
                        pts = 0.5 * half_target + 0.5 * rem
                        result = "LOSS_HALF_BE" if be_active else "LOSS_HALF"
                        exit_price = sl
                    else:
                        result = "LOSS"; pts = entry_price - sl; exit_price = sl
                elif hit_tp:
                    if variant == "tp1_be" and half_closed:
                        pts = 0.5 * half_target + 0.5 * tp_dist
                        result = "WIN_FULL"; exit_price = tp
                    else:
                        result = "WIN"; pts = tp_dist; exit_price = tp
                elif variant == "be_50" and hit_be_retest:
                    result = "BE"; pts = 0.0; exit_price = entry_price
                elif variant == "tp1_be" and half_closed and hit_be_retest:
                    # half locked, remainder retests BE
                    pts = 0.5 * half_target + 0.5 * 0.0
                    result = "BE_HALF"; exit_price = entry_price
                elif variant == "tp1_be" and (not half_closed) and hit_half:
                    half_closed = True
                    be_active = True
                    # don't exit, continue
                # arm BE for be_50 if not yet armed
                if result is None and variant == "be_50" and not be_active and mfe >= half_target:
                    be_active = True
            else:  # LONG
                fav = b["high"] - entry_price
                if fav > mfe: mfe = fav
                hit_sl = b["low"] <= sl
                hit_tp = b["high"] >= tp
                hit_half = (variant == "tp1_be") and (not half_closed) and (b["high"] >= entry_price + half_target)
                hit_be_retest = be_active and (b["low"] <= entry_price)

                if hit_sl and hit_tp:
                    if variant == "tp1_be" and half_closed:
                        rem = 0.0 if be_active else (sl - entry_price)
                        pts = 0.5 * half_target + 0.5 * rem
                        result = "LOSS_HALF_BE" if be_active else "LOSS_HALF"
                        exit_price = sl
                    else:
                        result = "LOSS"; pts = sl - entry_price; exit_price = sl
                elif hit_sl:
                    if variant == "tp1_be" and half_closed:
                        rem = 0.0 if be_active else (sl - entry_price)
                        pts = 0.5 * half_target + 0.5 * rem
                        result = "LOSS_HALF_BE" if be_active else "LOSS_HALF"
                        exit_price = sl
                    else:
                        result = "LOSS"; pts = sl - entry_price; exit_price = sl
                elif hit_tp:
                    if variant == "tp1_be" and half_closed:
                        pts = 0.5 * half_target + 0.5 * tp_dist
                        result = "WIN_FULL"; exit_price = tp
                    else:
                        result = "WIN"; pts = tp_dist; exit_price = tp
                elif variant == "be_50" and hit_be_retest:
                    result = "BE"; pts = 0.0; exit_price = entry_price
                elif variant == "tp1_be" and half_closed and hit_be_retest:
                    pts = 0.5 * half_target + 0.5 * 0.0
                    result = "BE_HALF"; exit_price = entry_price
                elif variant == "tp1_be" and (not half_closed) and hit_half:
                    half_closed = True
                    be_active = True

                if result is None and variant == "be_50" and not be_active and mfe >= half_target:
                    be_active = True

            if result is not None:
                exit_ts = cur
                break
        cur += 60

    if result is None:
        last = scan_bars_last_close(bars_idx, resolve_deadline_ts, entry_ts)
        if last is None:
            return {"result": "SKIP_NO_RESOLVE", "pts": 0.0}
        exit_ts, last_price = last
        exit_price = last_price  # store timeout exit price for chart markers
        # Timeout: pts = unrealized at last close
        if side == "SHORT":
            full_unreal = entry_price - last_price
        else:
            full_unreal = last_price - entry_price
        if variant == "tp1_be" and half_closed:
            pts = 0.5 * half_target + 0.5 * full_unreal
            result = "TIMEOUT_HALF"
        else:
            pts = full_unreal
            result = "TIMEOUT"

    return {"result": result, "pts": round(pts, 4), "exit_price": exit_price, "exit_ts": exit_ts}


def compute_es_smt(ev: dict, es_idx: dict[int, dict], side: str) -> bool:
    """Did ES take its target during 8:30-11:00 ET window?
    SHORT (NQ swept UP) → ES low must be < ES pre_low.
    LONG  (NQ swept DOWN) → ES high must be > ES pre_high.
    """
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]

    # ES release-bar range: single 8:30 ET 1m candle at t0 (BUG 6 fix; was 5-bar lookback).
    es_release = es_idx.get(t0)
    if es_release is None:
        return False
    es_pre_high = es_release["high"]
    es_pre_low = es_release["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(TIMEOUT_SWEEP_HOUR_ET, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())

    # ES sweep watch starts at t0+1 (8:31), AFTER release bar closes (BUG 6 fix).
    es_high_swept = False
    es_low_swept = False
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = es_idx.get(cur)
        if b is not None:
            if b["high"] > es_pre_high:
                es_high_swept = True
            if b["low"] < es_pre_low:
                es_low_swept = True
        cur += 60

    if side == "SHORT":
        return es_low_swept
    else:
        return es_high_swept


def compute_es_smt_mirror(ev: dict, es_idx: dict[int, dict], side: str) -> bool:
    """Did ES sweep the SAME source side NQ swept during 8:30-11:00 ET?
    SHORT (NQ swept UP its high) → ES high must be > ES pre_high.
    LONG  (NQ swept DOWN its low) → ES low  must be < ES pre_low.
    """
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]

    es_release = es_idx.get(t0)
    if es_release is None:
        return False
    es_pre_high = es_release["high"]
    es_pre_low = es_release["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(TIMEOUT_SWEEP_HOUR_ET, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())

    es_high_swept = False
    es_low_swept = False
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = es_idx.get(cur)
        if b is not None:
            if b["high"] > es_pre_high:
                es_high_swept = True
            if b["low"] < es_pre_low:
                es_low_swept = True
        cur += 60

    if side == "SHORT":
        return es_high_swept
    else:
        return es_low_swept


def aggregate_rows(trades: list[dict], cost_pts: float = 0.0) -> dict:
    """Aggregate list of {result, pts, side, year, smt} -> n/w/l/be/wr/pf/net_pts/avg_win/avg_loss.

    *cost_pts* is the per-trade transaction cost (points). When > 0, pf and net_pts
    are cost-adjusted (net), while w/l/be/wr stay on original result labels.
    """
    win_pts = []
    loss_pts = []
    be_count = 0
    n = 0
    for t in trades:
        n += 1
        r = t["result"]
        p = t["pts"]
        if r in ("WIN", "WIN_FULL"):
            win_pts.append(p)
        elif r in ("LOSS",):
            loss_pts.append(p)
        elif r in ("BE",):
            be_count += 1
        elif r == "LOSS_HALF":
            loss_pts.append(p)
        elif r == "LOSS_HALF_BE":
            if p > 0.001:
                win_pts.append(p)
            elif p < -0.001:
                loss_pts.append(p)
            else:
                be_count += 1
        elif r == "BE_HALF":
            if p > 0.001:
                win_pts.append(p)
            else:
                be_count += 1
        elif r == "TIMEOUT":
            if p > 0.001:
                win_pts.append(p)
            elif p < -0.001:
                loss_pts.append(p)
            else:
                be_count += 1
        elif r == "TIMEOUT_HALF":
            if p > 0.001:
                win_pts.append(p)
            elif p < -0.001:
                loss_pts.append(p)
            else:
                be_count += 1

    w = len(win_pts)
    l = len(loss_pts)
    be = be_count
    sum_win = sum(win_pts)
    sum_loss = sum(loss_pts)
    pf_gross = (sum_win / abs(sum_loss)) if sum_loss < 0 else (float("inf") if sum_win > 0 else 0.0)
    wl = w + l
    wr = (w / wl) if wl else 0.0
    net_gross = sum_win + sum_loss

    # --- net (cost-adjusted) ---
    if cost_pts > 0:
        net_win = []
        net_loss = []
        for t in trades:
            pn = t["pts"] - cost_pts
            if pn > 0.001:
                net_win.append(pn)
            elif pn < -0.001:
                net_loss.append(pn)
        sum_win_net = sum(net_win)
        sum_loss_net = sum(net_loss)
        if sum_loss_net < 0:
            pf_net = sum_win_net / abs(sum_loss_net)
        elif sum_win_net > 0:
            pf_net = None  # infinite
        else:
            pf_net = 0.0
        net_pts = round(net_gross - cost_pts * n, 2)
        pf_out = round(pf_net, 3) if pf_net is not None else None
        avg_win = round(sum_win_net / len(net_win), 3) if net_win else 0.0
        avg_loss = round(sum_loss_net / len(net_loss), 3) if net_loss else 0.0
    else:
        pf_out = round(pf_gross, 3) if pf_gross != float("inf") else None
        pf_net = pf_gross
        net_pts = round(net_gross, 2)
        avg_win = round(sum_win / w, 3) if w else 0.0
        avg_loss = round(sum_loss / l, 3) if l else 0.0

    return {
        "n": n,
        "w": w,
        "l": l,
        "be": be,
        "wr": round(wr, 4),
        "pf": pf_out,
        "net_pts": net_pts,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "pf_gross": round(pf_gross, 3) if pf_gross != float("inf") else None,
        "net_pts_gross": round(net_gross, 2),
        "tx_cost_pts": cost_pts,
        "tx_cost_total": round(cost_pts * n, 2),
    }


def main():
    nq_idx = index_bars(SYMBOL)  # MNQ.c.0 (Databento) — 7y native micro-futures
    es_idx = index_bars("ES")

    events = load_nfp_events()

    # Per-event base setup using NQ
    setups = []
    for ev in events:
        s = detect_setup(ev, nq_idx)
        setups.append((ev, s))

    # For each OK setup, compute ES SMT (target + mirror) + 3 variant outcomes
    trade_db = []  # list of dicts: {year, side, smt_target, smt_mirror, variant, result, pts}
    for ev, s in setups:
        if s["status"] != "OK":
            continue
        smt_target = compute_es_smt(ev, es_idx, s["side"])
        smt_mirror = compute_es_smt_mirror(ev, es_idx, s["side"])
        for variant in VARIANTS:
            sim = simulate_variant(s, variant, nq_idx)
            if sim["result"] == "SKIP_NO_RESOLVE":
                continue
            trade_db.append({
                "year": s["year"],
                "side": s["side"],
                "smt_target": smt_target,
                "smt_mirror": smt_mirror,
                "variant": variant,
                "result": sim["result"],
                "pts": sim["pts"],
            })

    # Build rows: 3 variants × 3 SMT modes × 3 sides × (years+ALL)
    rows = []
    for variant in VARIANTS:
        for smt_mode in SMT_MODES:
            for side in SIDES:
                for year in YEARS + ["ALL"]:
                    sub = []
                    for t in trade_db:
                        if t["variant"] != variant:
                            continue
                        if side != "BOTH" and t["side"] != side:
                            continue
                        if year != "ALL" and t["year"] != year:
                            continue
                        if smt_mode == "target" and not t["smt_target"]:
                            continue
                        if smt_mode == "mirror" and not t["smt_mirror"]:
                            continue
                        sub.append(t)
                    agg = aggregate_rows(sub, cost_pts=cost_per_trade("NQ"))
                    rows.append({
                        "year": year,
                        "variant": variant,
                        "smt_mode": smt_mode,
                        "side": side,
                        **agg,
                    })

    n_events_total = sum(1 for _, s in setups if s["status"] == "OK")
    out = {
        "meta": {
            "source": "MNQ.c.0 (Databento, 7y native micro-futures) + ES.c.0 (SMT)",
            "date_from": DATE_FROM,
            "date_to": DATE_TO,
            "n_events_total": n_events_total,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "event_filter": "NFP",
            "variants": {
                "no_be": "Pure SL/TP/timeout, no breakeven move",
                "be_50": "MFE>=50% TP-dist arms BE; bar touching entry exits flat",
                "tp1_be": "MFE>=50% closes half at +50% TP-dist AND moves stop to BE on remainder",
            },
            "smt_modes": {
                "off": "no SMT filter",
                "target": "ES took its OPPOSITE-side pre-news liquidity (NQ short → ES low<pre_low; NQ long → ES high>pre_high)",
                "mirror": "ES swept the SAME source side NQ swept (NQ short up → ES high>pre_high; NQ long down → ES low<pre_low)",
            },
        },
        "rows": rows,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(out, f, indent=2, default=str)

    def find_row(year, variant, smt_mode, side):
        for r in rows:
            if r["year"] == year and r["variant"] == variant and r["smt_mode"] == smt_mode and r["side"] == side:
                return r
        return None

    print(f"\n=== SUMMARY ===")
    print(f"n_events_total (OK setups) = {n_events_total}")
    print(f"rows count = {len(rows)} (expected {len(VARIANTS)*len(SMT_MODES)*len(SIDES)*(len(YEARS)+1)})")
    print(f"\n=== REFERENCE no_be / BOTH / ALL — 3 modes ===")
    for mode in SMT_MODES:
        r = find_row("ALL", "no_be", mode, "BOTH")
        print(f"NFP no_be BOTH ALL  smt={mode:7s} n={r['n']:3d}  WR={int(round(r['wr']*100)):2d}%  PF={r['pf']}  net={r['net_pts']}")

    print(f"\nOutput: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

"""SI 10y 8:30 ET news IFVG runner — 15 events × 3 exit variants × GC SMT × 3 sides × 11 year buckets.

SI anchor (3.68M bars canonique) + GC SMT pair.
SI tick = 0.005 (Comex silver). SL fix: full range sweep_ts→entry_ts ± 1 tick.
SMT relative sweep via rolling 10min window.
"""

from __future__ import annotations
import csv
import json
import os
import sys
import time as _time
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo
from collections import defaultdict

import pandas as pd
import numpy as np

sys.path.insert(0, "/Users/angelo/monfxreplay-python")
from costs import cost_per_trade

NEWS_CSV = "/Users/angelo/news-cal-official/news_official_2016_2026.csv"
ET = ZoneInfo("America/New_York")

DATE_FROM = "2016-01-04"
DATE_TO = "2026-05-15"

SI_TICK = 0.005
GC_TICK = 0.10

TIMEOUT_SWEEP_HOUR_ET = 11
TIMEOUT_RESOLVE_HOUR_ET = 16

YEARS = ["2016","2017","2018","2019","2020","2021","2022","2023","2024","2025","2026"]
SIDES = ["BOTH", "LONG", "SHORT"]
VARIANTS = ["no_be", "be_50", "tp1_be"]

# 4 events — SI anchor + GC SMT (replacing removed non-canonical SI-vs-YM set)
EVENTS = [
    "NFP", "PCE", "RetailSales", "EmpireState",
]

EVENT_RELEASE_TIME = {
    "CPI": (8,30), "NFP": (8,30), "PPI": (8,30), "RetailSales": (8,30),
    "PCE": (8,30), "GDP": (8,30), "JoblessClaims": (8,30),
    "EmpireState": (8,30), "FOMC": (14,0), "ADP": (8,15),
    "JOLTS": (10,0), "ISMMfg": (10,0), "ISMServices": (10,0),
    "CBConfidence": (10,0), "PhillyFed": (8,30), "DurableGoods": (8,30),
}

EVENT_SWEEP_HOURS = {
    "CPI": 3, "NFP": 3, "PPI": 3, "RetailSales": 3,
    "PCE": 3, "GDP": 3, "JoblessClaims": 3,
    "EmpireState": 3, "FOMC": 3, "ADP": 3,
    "JOLTS": 2, "ISMMfg": 2, "ISMServices": 2,
    "CBConfidence": 2, "PhillyFed": 3, "DurableGoods": 3,
}

EVENT_SLUG: dict[str, str] = {
    "NFP":            "nfp-ifvg-smt-si-vs-gc",
    "PCE":            "pce-ifvg-smt-si-vs-gc",
    "RetailSales":    "retailsales-ifvg-smt-si-vs-gc",
    "EmpireState":    "empirestate-ifvg-smt-si-vs-gc",
}


def load_bars(parquet_path, date_from, date_to, tick):
    df = pd.read_parquet(parquet_path)
    from_ts = pd.Timestamp(date_from, tz="UTC")
    to_ts = pd.Timestamp(date_to, tz="UTC") + pd.Timedelta(days=1)
    mask = (df["ts"] >= from_ts) & (df["ts"] < to_ts)
    df = df.loc[mask]
    bars = {}
    for _, row in df.iterrows():
        ts = int(row["ts"].timestamp())
        bars[ts] = {"open": row["open"], "high": row["high"], "low": row["low"], "close": row["close"]}
    print(f"[load] {len(bars)} bars from {parquet_path}", file=sys.stderr)
    return bars


def load_events(event_type):
    rel_h, rel_m = EVENT_RELEASE_TIME[event_type]
    expected_time = f"{rel_h:02d}:{rel_m:02d}"
    from_dt = pd.Timestamp(DATE_FROM).date()
    to_dt = pd.Timestamp(DATE_TO).date()
    events = []
    with open(NEWS_CSV, newline="") as f:
        for row in csv.DictReader(f):
            if row["event_type"] != event_type:
                continue
            if row["time_et"] != expected_time:
                continue
            try:
                d = datetime.strptime(row["date"], "%Y-%m-%d").date()
            except ValueError:
                continue
            if d < from_dt or d > to_dt:
                continue
            if event_type == "GDP" and d.month not in (1,4,7,10):
                continue
            et_dt = datetime(d.year, d.month, d.day, rel_h, rel_m, tzinfo=ET)
            utc_dt = et_dt.astimezone(timezone.utc)
            events.append({
                "date": d.strftime("%Y-%m-%d"),
                "t0_utc": int(utc_dt.timestamp()),
                "et_date": d.strftime("%Y-%m-%d"),
                "event_type": event_type,
            })
    events.sort(key=lambda x: x["t0_utc"])
    return events


def find_fvg(a, b, c, sweep_dir):
    if (b["ts"] - a["ts"] != 60) or (c["ts"] - b["ts"] != 60):
        return None
    if sweep_dir == "UP":
        if b["low"] > max(a["high"], c["high"]):
            return {"zone_high": b["low"], "zone_low": max(a["high"], c["high"]), "break_level": max(a["high"], c["high"])}
    else:
        if b["high"] < min(a["low"], c["low"]):
            return {"zone_high": min(a["low"], c["low"]), "zone_low": b["high"], "break_level": min(a["low"], c["low"])}
    return None


def detect_setup(event, bars_idx, tick):
    t0 = event["t0_utc"]
    et_date = event["et_date"]
    event_type = event["event_type"]
    out = {"date": event["date"], "et_date": et_date, "year": et_date[:4], "t0_utc": t0}

    release_bar = bars_idx.get(t0)
    if release_bar is None:
        out["status"] = "SKIP_NO_PRE"; return out
    pre_high = release_bar["high"]
    pre_low = release_bar["low"]

    release_h, release_m = EVENT_RELEASE_TIME[event_type]
    sweep_h = release_h + EVENT_SWEEP_HOURS[event_type]
    resolve_h = sweep_h + 1

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(sweep_h, 0), tzinfo=ET)
    sweep_deadline_ts = int(deadline_et.timestamp())
    resolve_dl_ts = int(deadline_et.replace(hour=resolve_h).timestamp())

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
                sweep_ts = cur; break
            if up:
                sweep_dir, sweep_price, sweep_ts = "UP", b["high"], cur; break
            if dn:
                sweep_dir, sweep_price, sweep_ts = "DOWN", b["low"], cur; break
        cur += 60

    if sweep_dir is None:
        out["status"] = "SKIP_NO_SWEEP"; return out

    side = "SHORT" if sweep_dir == "UP" else "LONG"
    tp = pre_low if sweep_dir == "UP" else pre_high

    scan_bars = []
    cur = sweep_ts
    while cur <= resolve_dl_ts:
        b = bars_idx.get(cur)
        if b is not None:
            scan_bars.append({"ts": cur, **b})
        cur += 60

    if len(scan_bars) < 3:
        out["status"] = "SKIP_NO_SCAN_BARS"; return out

    opp_level_low = pre_low - tick
    opp_level_high = pre_high + tick
    pending_fvgs = []
    entry_ts = entry_price = None
    triggering_fvg = None
    both_swept = False

    for n, bar in enumerate(scan_bars):
        if n > 0:
            if sweep_dir == "UP" and bar["low"] <= opp_level_low:
                both_swept = True; break
            if sweep_dir == "DOWN" and bar["high"] >= opp_level_high:
                both_swept = True; break
        for fvg in pending_fvgs:
            if sweep_dir == "UP":
                if bar["close"] < fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]
                    triggering_fvg = fvg; break
            else:
                if bar["close"] > fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]
                    triggering_fvg = fvg; break
        if entry_ts is not None:
            break
        if n >= 2:
            a = scan_bars[n-2]; b = scan_bars[n-1]; c = scan_bars[n]
            fvg = find_fvg(a, b, c, sweep_dir)
            if fvg is not None:
                fvg["formation_ts"] = c["ts"]
                pending_fvgs.append(fvg)

    if both_swept:
        out["status"] = "SKIP_BOTH_SIDES_SWEPT"
        out.update({"sweep_dir": sweep_dir, "sweep_ts": sweep_ts, "pre_high": pre_high, "pre_low": pre_low})
        return out

    if entry_ts is None:
        out["status"] = "SKIP_NO_IFVG"; return out

    # SL fix: range sweep_ts → entry_ts (inclusive) ± 1 tick
    disp_bars = [b for b in scan_bars if sweep_ts <= b["ts"] <= entry_ts]
    if not disp_bars:
        out["status"] = "SKIP_NO_SWEEP_DISP"; return out
    if sweep_dir == "UP":
        sl = max(b["high"] for b in disp_bars) + tick
    else:
        sl = min(b["low"] for b in disp_bars) - tick

    if side == "SHORT":
        if entry_price >= sl or entry_price <= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out
    else:
        if entry_price <= sl or entry_price >= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out

    out["status"] = "OK"
    out["side"] = side; out["sweep_dir"] = sweep_dir; out["sweep_ts"] = sweep_ts
    out["pre_high"] = pre_high; out["pre_low"] = pre_low
    out["entry_ts"] = entry_ts; out["entry_price"] = entry_price
    out["sl"] = sl; out["tp"] = tp; out["resolve_deadline_ts"] = resolve_dl_ts
    if triggering_fvg:
        out["ifvg_top"] = triggering_fvg["zone_high"]
        out["ifvg_bottom"] = triggering_fvg["zone_low"]
        out["ifvg_formation_ts"] = triggering_fvg["formation_ts"]
    return out


def compute_smt_relative(event, anchor_bars, pair_bars, side, tick, pair_tick):
    """SMT via rolling 10-min relative DOL levels. Simplifié: vérifie que le pair 
    a aussi sweep au-delà de ses propres pre-high/pre-low dans la même fenêtre."""
    t0 = event["t0_utc"]
    et_date = event["et_date"]
    event_type = event["event_type"]

    pair_release = pair_bars.get(t0)
    if pair_release is None:
        return False

    pair_pre_high = pair_release["high"]
    pair_pre_low = pair_release["low"]

    release_h, release_m = EVENT_RELEASE_TIME[event_type]
    sweep_h = release_h + EVENT_SWEEP_HOURS[event_type]
    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(sweep_h, 0), tzinfo=ET)
    deadline_ts = int(deadline_et.timestamp())

    pair_high_swept = False
    pair_low_swept = False
    cur = t0 + 60
    while cur <= deadline_ts:
        b = pair_bars.get(cur)
        if b is not None:
            if b["high"] > pair_pre_high:
                pair_high_swept = True
            if b["low"] < pair_pre_low:
                pair_low_swept = True
        cur += 60

    if side == "SHORT":
        return pair_low_swept
    else:
        return pair_high_swept


def simulate_variant(setup, variant, bars_idx):
    """Clone of simulate_variant from run_news_830_variants.py, tick-agnostic."""
    entry_price = setup["entry_price"]
    sl = setup["sl"]
    tp = setup["tp"]
    side = setup["side"]
    entry_ts = setup["entry_ts"]
    resolve_dl = setup["resolve_deadline_ts"]

    tp_dist = abs(tp - entry_price)
    be_level = entry_price
    half_idx = None

    if variant == "be_50":
        be_level = entry_price
    elif variant == "tp1_be":
        half_idx = 0.5

    is_long = (side == "LONG")
    half_closed = False
    be_armed = False

    cur = entry_ts + 60
    while cur <= resolve_dl:
        b = bars_idx.get(cur)
        if b is None:
            cur += 60; continue

        for px in ["high", "low", "open", "close"]:
            price = b[px]
            if is_long:
                mfe_pct = (price - entry_price) / tp_dist if tp_dist > 0 else 0
            else:
                mfe_pct = (entry_price - price) / tp_dist if tp_dist > 0 else 0

            if (is_long and price >= tp) or (not is_long and price <= tp):
                if half_idx and not half_closed:
                    half_closed = True
                    partial_pts = (price - entry_price) if is_long else (entry_price - price)
                    partial_pts *= half_idx
                    be_armed = True
                    continue
                final_pts = (price - entry_price) if is_long else (entry_price - price)
                if half_closed:
                    final_pts = partial_pts + final_pts * (1 - half_idx)
                return {"result": "WIN", "pts": round(final_pts, 4), "exit_ts": cur, "exit_price": price}

            if be_armed and ((is_long and price <= be_level) or (not is_long and price >= be_level)):
                if half_closed:
                    return {"result": "BE_HALF", "pts": round(partial_pts, 4), "exit_ts": cur, "exit_price": price}
                return {"result": "BE", "pts": 0.0, "exit_ts": cur, "exit_price": price}

            if (is_long and price <= sl) or (not is_long and price >= sl):
                loss_pts = (price - entry_price) if is_long else (entry_price - price)
                if half_closed:
                    loss_pts = partial_pts + loss_pts * (1 - half_idx)
                    return {"result": "LOSS_HALF", "pts": round(loss_pts, 4), "exit_ts": cur, "exit_price": price}
                return {"result": "LOSS", "pts": round(loss_pts, 4), "exit_ts": cur, "exit_price": price}

            if mfe_pct >= 0.5 and not be_armed:
                be_armed = True

        cur += 60

    final_price = bars_idx[resolve_dl]["close"] if resolve_dl in bars_idx else entry_price
    timeout_pts = (final_price - entry_price) if is_long else (entry_price - final_price)
    return {"result": "TIMEOUT", "pts": round(timeout_pts, 4), "exit_ts": resolve_dl, "exit_price": final_price}


def aggregate_rows(trades, cost_pts=0.0):
    """Takes trade_db records (with pts, result) and computes KPI. cost_pts reduces net."""
    n = len(trades)
    if n == 0:
        return {"n": 0, "w": 0, "l": 0, "be": 0, "wr": 0.0, "pf": 0.0,
                "net_pts": 0.0, "avg_win": 0.0, "avg_loss": 0.0}
    outcomes = [outcome_from_result(t["result"], t["pts"]) for t in trades]
    w = sum(1 for o in outcomes if o == "win")
    l = sum(1 for o in outcomes if o == "loss")
    be = n - w - l
    wr = w / n if n > 0 else 0.0
    winners = [t["pts"] for t in trades if t["pts"] > 0]
    losers = [t["pts"] for t in trades if t["pts"] < 0]
    gross_win = sum(winners)
    gross_loss = sum(abs(l) for l in losers)
    pf = gross_win / gross_loss if gross_loss > 0 else (99.0 if gross_win > 0 else 0.0)
    net_pts = round(sum(t["pts"] for t in trades) - cost_pts * n, 2)
    if cost_pts > 0:
        net_win = [t["pts"] - cost_pts for t in trades if t["pts"] - cost_pts > 0]
        net_loss = [t["pts"] - cost_pts for t in trades if t["pts"] - cost_pts < 0]
        sum_win_net = sum(net_win) if net_win else 0
        sum_loss_net = sum(net_loss) if net_loss else 0
        pf_net = sum_win_net / abs(sum_loss_net) if sum_loss_net < 0 else (None if sum_win_net > 0 else 0.0)
        pf = round(pf_net, 3) if pf_net is not None else None
        avg_win = round(sum_win_net / len(net_win), 3) if net_win else 0.0
        avg_loss = round(sum_loss_net / len(net_loss), 3) if net_loss else 0.0
    else:
        avg_win = round(gross_win / len(winners), 3) if winners else 0.0
        avg_loss = round(gross_loss / len(losers), 3) if losers else 0.0
        pf = round(pf, 3)
    return {"n": n, "w": w, "l": l, "be": be, "wr": round(wr, 4), "pf": pf,
            "net_pts": net_pts, "avg_win": avg_win, "avg_loss": avg_loss}


def outcome_from_result(result, pts):
    if result in ("WIN", "WIN_FULL"): return "win"
    if result in ("LOSS", "LOSS_HALF"): return "loss"
    if result == "BE": return "be"
    if result in ("TIMEOUT", "TIMEOUT_HALF"): return "timeout"
    if result == "LOSS_HALF_BE":
        return "win" if pts > 0.001 else ("loss" if pts < -0.001 else "be")
    if result == "BE_HALF":
        return "win" if pts > 0.001 else "be"
    return "loss"


def build_rows(trade_db):
    rows = []
    for variant in VARIANTS:
        for smt in [False, True]:
            for side in SIDES:
                for year in YEARS + ["ALL"]:
                    sub = [t for t in trade_db
                           if t["variant"] == variant
                           and (side == "BOTH" or t["side"] == side)
                           and (year == "ALL" or t["year"] == year)
                           and (not smt or t["smt_target"])]
                    agg = aggregate_rows(sub, cost_pts=cost_per_trade("SI"))
                    rows.append({"year": year, "variant": variant, "smt": smt, "side": side, **agg})
    return rows


def build_trades(trade_db):
    trades = []
    for t in trade_db:
        ts_str = datetime.fromtimestamp(t["t0_utc"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        trades.append({
            "ts": ts_str, "year": int(t["year"]), "variant": t["variant"],
            "smt": t["smt_target"], "side": t["side"].lower(),
            "pnl_pts": t["pts"], "outcome": outcome_from_result(t["result"], t["pts"]),
        })
    trades.sort(key=lambda x: x["ts"])
    return trades


def find_row(rows, year, variant, smt, side):
    for r in rows:
        if r["year"] == year and r["variant"] == variant and r["smt"] == smt and r["side"] == side:
            return r
    return None


def main():
    t_start = _time.time()
    print(f"[setup] loading SI anchor + GC pair bars ({DATE_FROM}..{DATE_TO})...", file=sys.stderr)
    si_idx = load_bars("/Users/angelo/backtesting/ict/data/metals/SI_1m_10y_real.parquet", DATE_FROM, DATE_TO, SI_TICK)
    gc_idx = load_bars("/Users/angelo/backtesting/ict/data/metals/GC_1m_10y_ffill.parquet", DATE_FROM, DATE_TO, GC_TICK)

    out_dir = "/Users/angelo/jacktradesnq-site-costs/public/data"
    os.makedirs(out_dir, exist_ok=True)

    summary_lines = []
    per_event_results = {}

    for event_type in EVENTS:
        print(f"\n[run ] {event_type}", file=sys.stderr)
        events = load_events(event_type)
        if not events:
            summary_lines.append(f"{event_type:22s} SKIP: 0 CSV events")
            continue

        trade_db = []
        n_ok = 0
        for ev in events:
            s = detect_setup(ev, si_idx, SI_TICK)
            if s["status"] != "OK":
                continue
            n_ok += 1
            smt_target = compute_smt_relative(ev, si_idx, gc_idx, s["side"], SI_TICK, GC_TICK)
            for variant in VARIANTS:
                sim = simulate_variant(s, variant, si_idx)
                if sim["result"] == "SKIP_NO_RESOLVE":
                    continue
                trade_db.append({
                    "year":       s["year"],
                    "t0_utc":     ev["t0_utc"],
                    "side":       s["side"],
                    "smt_target": smt_target,
                    "variant":    variant,
                    "result":     sim["result"],
                    "pts":        sim["pts"],
                    "entry_ts":   s["entry_ts"], "entry_price": s["entry_price"],
                    "sl_price":   s["sl"], "tp_price": s["tp"],
                    "exit_ts":    sim.get("exit_ts"), "exit_price": sim.get("exit_price"),
                    "data_high":  s["pre_high"], "data_low": s["pre_low"],
                    "sweep_ts":   s["sweep_ts"], "sweep_side": s["sweep_dir"],
                    "ifvg_top":   s.get("ifvg_top"), "ifvg_bottom": s.get("ifvg_bottom"),
                    "ifvg_formation_ts": s.get("ifvg_formation_ts"),
                })

        ev_rows = build_rows(trade_db)
        ev_trades = build_trades(trade_db)
        per_event_results[event_type] = {
            "rows": ev_rows, "trades": ev_trades, "trade_db": trade_db,
            "n_events_total": n_ok, "n_csv_events": len(events),
        }

        r = find_row(ev_rows, "ALL", "no_be", True, "BOTH")
        if r:
            pf = r["pf"] if r["pf"] != float("inf") else float("inf")
            pf_str = f"{pf:.2f}" if isinstance(pf, (int,float)) and pf != float("inf") else "inf"
            wr_pct = int(round(r["wr"]*100))
            summary_lines.append(
                f"{event_type:22s} n={r['n']:3d}  WR={wr_pct:2d}%  PF={pf_str:>5s}  "
                f"net={r['net_pts']:+.1f}  setups_ok={n_ok}/{len(events)}"
            )
        else:
            summary_lines.append(f"{event_type:22s} ROW MISSING")

        # Write per-event JSON
        slug = EVENT_SLUG[event_type]
        ev_out = {
            "meta": {
                "source": f"SI_1m_10y_real.parquet (bbo-1m, 2016-2026) + GC_1m_10y_ffill (SMT pair)",
                "date_from": DATE_FROM, "date_to": DATE_TO,
                "n_events_total": n_ok, "n_csv_events": len(events),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "event_filter": event_type, "csv": NEWS_CSV,
                "tick": f"SI_TICK={SI_TICK} (SL fix: range sweep_ts→entry_ts), GC_TICK={GC_TICK} (SMT pair)",
            },
            "rows": ev_rows, "trades": ev_trades,
        }
        # GC-pair convention: main data file uses _gc.json (lib resolves -gc suffix to _gc.json)
        data_slug = slug[:-3] + "_gc" if slug.endswith("-gc") else slug
        ev_path = os.path.join(out_dir, f"{data_slug}.json")
        with open(ev_path, "w") as f:
            json.dump(ev_out, f, indent=2, default=str)
        print(f"[out ] {ev_path}  rows={len(ev_rows)} trades={len(ev_trades)}", file=sys.stderr)

        # Trade prices overlay
        prices = []
        for t in trade_db:
            prices.append({
                "ts": datetime.fromtimestamp(t["t0_utc"], tz=timezone.utc).isoformat(),
                "entry_ts": datetime.fromtimestamp(t["entry_ts"], tz=timezone.utc).isoformat() if t.get("entry_ts") else None,
                "variant": t["variant"], "smt": t["smt_target"], "side": t["side"].lower(),
                "entry_price": t["entry_price"], "sl_price": t["sl_price"], "tp_price": t["tp_price"],
                "exit_ts": datetime.fromtimestamp(t["exit_ts"], tz=timezone.utc).isoformat() if t.get("exit_ts") else None,
                "exit_price": t["exit_price"],
                "data_high": t["data_high"], "data_low": t["data_low"],
                "sweep_ts": datetime.fromtimestamp(t["sweep_ts"], tz=timezone.utc).isoformat() if t.get("sweep_ts") else None,
                "sweep_side": t["sweep_side"],
                "ifvg_top": t.get("ifvg_top"), "ifvg_bottom": t.get("ifvg_bottom"),
                "ifvg_formation_ts": datetime.fromtimestamp(t["ifvg_formation_ts"], tz=timezone.utc).isoformat() if t.get("ifvg_formation_ts") else None,
            })
        tp_path = os.path.join(out_dir, f"{slug}-trade-prices.json")
        with open(tp_path, "w") as f:
            json.dump({"generated_at": datetime.now(timezone.utc).isoformat(), "source": "run_si_10y_all_events.py",
                       "event": event_type, "asset": "SI", "prices": prices}, f, indent=2, default=str)

    elapsed = _time.time() - t_start
    print(f"\n=== per-event summary (no_be, smt=True, BOTH) ===", file=sys.stderr)
    for ln in summary_lines:
        print(ln, file=sys.stderr)
    print(f"\n=== run time: {elapsed:.1f}s ===", file=sys.stderr)


if __name__ == "__main__":
    main()

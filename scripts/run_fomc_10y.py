"""FOMC 14:00 ET IFVG runner — 1 event × 3 exit variants × 2-way SMT × 3 sides × 11 year buckets.

Canonical version (in monfxreplay-python-news830/) — uses the detect_setup
that exposes data_high/data_low/sweep_ts/sweep_side/ifvg_top/ifvg_bottom/ifvg_formation_ts.

Loads NQ + ES parquet for 2016-04-19 -> 2026-05-09, processes FOMC statements
(from news_official_2016_2026.csv at 14:00 ET), emits schema-identical files to CPI/NFP:

    /Users/angelo/jtnq-hub-v3/public/data/fomc-ifvg-smt.json
    /Users/angelo/jtnq-hub-v3/public/data/fomc-ifvg-smt-trade-prices.json

Logic identical to run_nq_10y_all_events.py, with:
  - t0 = 14:00 ET (FOMC release) instead of 8:30 ET
  - TIMEOUT_SWEEP_HOUR_ET monkey-patched 11 -> 17 (14:00 + 150 min ≈ 16:30; round to 17)
  - TIMEOUT_RESOLVE_HOUR_ET monkey-patched 16 -> 21 (resolve by 20:00 ET, leave margin)

Usage:
    uv run python run_fomc_10y.py
"""
from __future__ import annotations
import csv
import json
import os
import sys
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from data import load_bars

# Monkey-patch module-level constants in run_nfp_be50 BEFORE importing run_news_830_variants
import run_nfp_be50 as _nfp_mod
_nfp_mod.TIMEOUT_SWEEP_HOUR_ET = 17    # FOMC 14:00 ET + ~150min sweep window
_nfp_mod.TIMEOUT_RESOLVE_HOUR_ET = 21  # resolve by 21:00 ET

import run_news_830_variants as _v_mod
_v_mod.TIMEOUT_SWEEP_HOUR_ET = 17  # rebind: this module had `from run_nfp_be50 import TIMEOUT_SWEEP_HOUR_ET`

from run_news_830_variants import (
    detect_setup,
    simulate_variant,
    compute_es_smt,
    aggregate_rows,
    SIDES,
    VARIANTS,
)

sys.path.insert(0, "/Users/angelo/monfxreplay-python")
from costs import cost_per_trade

NEWS_CSV = "/Users/angelo/news-cal-official/news_official_2016_2026.csv"
ET = ZoneInfo("America/New_York")

DATE_FROM = "2016-04-19"
DATE_TO = "2026-05-09"
EVENT_TYPE = "FOMC"

YEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]


def index_bars_window(symbol: str) -> dict[int, dict]:
    print(f"[load] {symbol} 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    rows = load_bars(symbol, DATE_FROM, DATE_TO)
    bars_idx = {int(r["ts"]): {"open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"]} for r in rows}
    print(f"[load] {symbol} {len(bars_idx)} bars indexed", file=sys.stderr)
    return bars_idx


def load_fomc_events() -> list[dict]:
    from_dt = datetime.strptime(DATE_FROM, "%Y-%m-%d").date()
    to_dt = datetime.strptime(DATE_TO, "%Y-%m-%d").date()
    events: list[dict] = []
    with open(NEWS_CSV, newline="") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            if row["event_type"] != EVENT_TYPE:
                continue
            if row["time_et"] != "14:00":
                continue
            try:
                d = datetime.strptime(row["date"], "%Y-%m-%d").date()
            except ValueError:
                continue
            if d < from_dt or d > to_dt:
                continue
            et_dt = datetime(d.year, d.month, d.day, 14, 0, tzinfo=ET)
            utc_dt = et_dt.astimezone(timezone.utc)
            date_str = d.strftime("%Y-%m-%d")
            events.append({
                "date": date_str,
                "t0_utc": int(utc_dt.timestamp()),
                "et_date": date_str,
                "event_type": EVENT_TYPE,
                "event_raw": f"FOMC (CSV {row['source']})",
            })
    events.sort(key=lambda x: x["t0_utc"])
    print(f"[load] {len(events)} FOMC events in {DATE_FROM}..{DATE_TO}", file=sys.stderr)
    return events


def _result_to_outcome(result: str, pts: float) -> str:
    # Label by realized PnL sign, not result string.
    # LOSS_HALF (TP1 hit then SL on remainder) can be net positive when
    # half_TP_dist > half_SL_dist, so the string label is unreliable.
    if pts > 0:
        return "win"
    if pts < 0:
        return "loss"
    return "be"


def run_fomc(nq_idx: dict, es_idx: dict) -> dict:
    events = load_fomc_events()
    if not events:
        return {"n_events_total": 0, "n_csv_events": 0, "rows": [], "trades": [], "trade_db": []}

    trade_db = []
    n_ok = 0
    for ev in events:
        s = detect_setup(ev, nq_idx)
        if s["status"] != "OK":
            continue
        n_ok += 1
        smt_target = compute_es_smt(ev, es_idx, s["side"])
        ts_iso = datetime.fromtimestamp(s["t0_utc"], tz=timezone.utc).isoformat()
        entry_ts_iso = datetime.fromtimestamp(s["entry_ts"], tz=timezone.utc).isoformat()
        sweep_ts_iso = datetime.fromtimestamp(s["sweep_ts"], tz=timezone.utc).isoformat() if s.get("sweep_ts") else None
        ifvg_form_ts_iso = datetime.fromtimestamp(s["ifvg_formation_ts"], tz=timezone.utc).isoformat() if s.get("ifvg_formation_ts") else None
        for variant in VARIANTS:
            sim = simulate_variant(s, variant, nq_idx)
            if sim["result"] == "SKIP_NO_RESOLVE":
                continue
            exit_ts_raw = sim.get("exit_ts")
            exit_ts_iso = (
                datetime.fromtimestamp(exit_ts_raw, tz=timezone.utc).isoformat()
                if exit_ts_raw is not None else None
            )
            trade_db.append({
                "ts": ts_iso,
                "entry_ts": entry_ts_iso,
                "year": s["year"],
                "side": s["side"].lower(),
                "smt_target": smt_target,
                "variant": variant,
                "result": sim["result"],
                "pts": sim["pts"],
                "entry_price": s["entry_price"],
                "sl_price": s["sl"],
                "tp_price": s["tp"],
                "exit_ts": exit_ts_iso,
                "exit_price": sim.get("exit_price"),
                "data_high": s["data_high"],
                "data_low": s["data_low"],
                "sweep_ts": sweep_ts_iso,
                "sweep_side": s["sweep_side"],
                "ifvg_top": s.get("ifvg_top"),
                "ifvg_bottom": s.get("ifvg_bottom"),
                "ifvg_formation_ts": ifvg_form_ts_iso,
            })

    rows = []
    for variant in VARIANTS:
        for smt in [False, True]:
            for side in SIDES:
                for year in YEARS + ["ALL"]:
                    sub = []
                    for t in trade_db:
                        if t["variant"] != variant:
                            continue
                        if side != "BOTH" and t["side"].upper() != side:
                            continue
                        if year != "ALL" and t["year"] != year:
                            continue
                        if smt and not t["smt_target"]:
                            continue
                        sub.append(t)
                    agg = aggregate_rows(sub, cost_pts=cost_per_trade("NQ"))
                    rows.append({
                        "year": year,
                        "variant": variant,
                        "smt": smt,
                        "side": side,
                        **agg,
                    })

    trades = []
    for t in trade_db:
        trades.append({
            "ts": t["ts"],
            "year": int(t["year"]),
            "variant": t["variant"],
            "smt": t["smt_target"],
            "side": t["side"],
            "pnl_pts": t["pts"],
            "outcome": _result_to_outcome(t["result"], t["pts"]),
        })

    return {"n_events_total": n_ok, "n_csv_events": len(events), "rows": rows, "trades": trades, "trade_db": trade_db}


def find_row(rows, year, variant, smt, side):
    for r in rows:
        if r["year"] == year and r["variant"] == variant and r["smt"] == smt and r["side"] == side:
            return r
    return None


def main():
    nq_idx = index_bars_window("NQ")
    es_idx = index_bars_window("ES")

    res = run_fomc(nq_idx, es_idx)

    out = {
        "meta": {
            "source": "NQ.c.0 (Databento, 10y, 2016-04-19→2026-05-09) + ES.c.0 (SMT)",
            "date_from": DATE_FROM,
            "date_to": DATE_TO,
            "n_events_total": res["n_events_total"],
            "n_csv_events": res["n_csv_events"],
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "event_filter": EVENT_TYPE,
            "csv": NEWS_CSV,
            "variants": {
                "no_be": "Pure SL/TP/timeout, no breakeven move",
                "be_50": "MFE>=50% TP-dist arms BE; bar touching entry exits flat",
                "tp1_be": "MFE>=50% closes half at +50% TP-dist AND moves stop to BE on remainder",
            },
            "smt": {
                "false": "no SMT filter",
                "true": "ES took its OPPOSITE-side pre-news liquidity (NQ short → ES low<pre_low; NQ long → ES high>pre_high)",
            },
            "release_time_et": "14:00",
            "sweep_window_et": "14:01-17:00",
            "resolve_deadline_et": "21:00",
        },
        "rows": res["rows"],
        "trades": res["trades"],
    }
    out_path = "/Users/angelo/jtnq-hub-v3/public/data/fomc-ifvg-smt.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"[done] wrote {out_path}", file=sys.stderr)

    prices_payload = [
        {
            "ts": t["ts"],
            "entry_ts": t["entry_ts"],
            "variant": t["variant"],
            "smt": t["smt_target"],
            "side": t["side"],
            "entry_price": t["entry_price"],
            "sl_price": t["sl_price"],
            "tp_price": t["tp_price"],
            "exit_ts": t["exit_ts"],
            "exit_price": t["exit_price"],
            "data_high": t["data_high"],
            "data_low": t["data_low"],
            "sweep_ts": t["sweep_ts"],
            "sweep_side": t["sweep_side"],
            "ifvg_top": t["ifvg_top"],
            "ifvg_bottom": t["ifvg_bottom"],
            "ifvg_formation_ts": t["ifvg_formation_ts"],
        }
        for t in res["trade_db"]
    ]
    prices_out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "run_fomc_10y.py",
        "event": EVENT_TYPE,
        "asset": "NQ",
        "prices": prices_payload,
    }
    prices_path = "/Users/angelo/jtnq-hub-v3/public/data/fomc-ifvg-smt-trade-prices.json"
    with open(prices_path, "w") as f:
        json.dump(prices_out, f, indent=2, default=str)
    print(f"[done] wrote {prices_path}", file=sys.stderr)

    # Summary
    print(f"\n=== FOMC NQ 10y — tp1_be / BOTH / ALL ===")
    for smt in [False, True]:
        r = find_row(res["rows"], "ALL", "tp1_be", smt, "BOTH")
        if r is None:
            print(f"  smt={smt}: ROW MISSING")
            continue
        pf = r["pf"] if r["pf"] is not None else float("inf")
        pf_str = f"{pf:.2f}" if isinstance(pf, (int, float)) and pf != float("inf") else "inf"
        wr_pct = int(round(r["wr"] * 100))
        print(f"  smt={smt:5} n={r['n']:3d}  WR={wr_pct:2d}%  PF={pf_str:>5s}  net={r['net_pts']:+8.1f}")

    print(f"\n=== FOMC — all variants / BOTH / ALL / smt=true ===")
    for variant in VARIANTS:
        r = find_row(res["rows"], "ALL", variant, True, "BOTH")
        if r is None:
            print(f"  {variant}: ROW MISSING")
            continue
        pf = r["pf"] if r["pf"] is not None else float("inf")
        pf_str = f"{pf:.2f}" if isinstance(pf, (int, float)) and pf != float("inf") else "inf"
        wr_pct = int(round(r["wr"] * 100))
        print(f"  {variant:8s}  n={r['n']:3d}  WR={wr_pct:2d}%  PF={pf_str:>5s}  net={r['net_pts']:+8.1f}")

    print(f"\nsetups_ok={res['n_events_total']} / csv_events={res['n_csv_events']}")


if __name__ == "__main__":
    main()

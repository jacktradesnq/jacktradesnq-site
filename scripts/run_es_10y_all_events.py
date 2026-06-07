"""ES 10y 8:30 ET news IFVG runner — 17 events × 3 exit variants × 2-way NQ SMT × 3 sides × 11 year buckets.

Loads ES + NQ parquet ONCE for the full 10y window (2016-01-04 → 2026-05-11), then loops
over 17 event types. Output schema matches the existing site Explorer (same as NQ/GC runners).

ES-specific notes:
- Tick size: ES = 0.25 pt (NQ = 0.25 pt, GC = 0.10 pt). simulate_variant and aggregate_rows
  are reused unmodified — they only care about entry/sl/tp prices, not tick size.
- ES parquet: forward-filled continuous ~3.5M bars, ts in America/New_York ns.
- NQ parquet (sister): continuous ~3.6M bars, ts in America/New_York ns.
- SMT semantics: ES SHORT (sweep UP) → NQ low < NQ pre_low; ES LONG (sweep DOWN) → NQ high > NQ pre_high.

Usage:
    /Users/angelo/monfxreplay-python/.venv/bin/python run_es_10y_all_events.py
"""
from __future__ import annotations
import csv
import json
import os
import sys
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo

import polars as pl

sys.path.insert(0, os.path.dirname(__file__))
from run_news_830_variants import (
    simulate_variant,
    aggregate_rows,
    SIDES,
    VARIANTS,
)
from run_news_830_v2 import find_3bar_fvg, scan_bars_last_close

sys.path.insert(0, "/Users/angelo/monfxreplay-python")
from costs import cost_per_trade

NEWS_CSV = "/Users/angelo/news-cal-official/news_official_2016_2026.csv"
ET = ZoneInfo("America/New_York")

DATE_FROM = "2016-01-04"
DATE_TO = "2026-05-11"

ES_TICK = 0.25

TIMEOUT_SWEEP_HOUR_ET = 11
TIMEOUT_RESOLVE_HOUR_ET = 16

YEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]

EVENTS = [
    "CPI",
    "NFP",
    "PPI",
    "RetailSales",
    "PCE",
    "GDP",
    "JoblessClaims",
    "EmpireState",
    "EmploymentCostIndex",
    "FOMC",
    "ADP",
    "JOLTS",
    "ISMMfg",
    "ISMServices",
    "CBConfidence",
    "PhillyFed",
    "DurableGoods",
]

EVENT_SLUG: dict[str, str] = {
    "CPI":                  "cpi-ifvg-smt-es",
    "NFP":                  "nfp-ifvg-smt-es",
    "PPI":                  "ppi-ifvg-smt-es",
    "RetailSales":          "retailsales-ifvg-smt-es",
    "PCE":                  "pce-ifvg-smt-es",
    "GDP":                  "gdp-ifvg-smt-es",
    "JoblessClaims":        "joblessclaims-ifvg-smt-es",
    "EmpireState":          "empirestate-ifvg-smt-es",
    "EmploymentCostIndex":  "employmentcostindex-ifvg-smt-es",
    "FOMC":                 "fomc-ifvg-smt-es",
    "ADP":                  "adp-ifvg-smt-es",
    "JOLTS":                "jolts-ifvg-smt-es",
    "ISMMfg":               "ism-mfg-ifvg-smt-es",
    "ISMServices":          "ism-services-ifvg-smt-es",
    "CBConfidence":         "cb-confidence-ifvg-smt-es",
    "PhillyFed":            "philly-fed-ifvg-smt-es",
    "DurableGoods":         "durable-goods-ifvg-smt-es",
}


EVENT_RELEASE_TIME: dict[str, tuple[int, int]] = {
    "CPI": (8, 30), "NFP": (8, 30), "PPI": (8, 30), "RetailSales": (8, 30),
    "PCE": (8, 30), "GDP": (8, 30), "JoblessClaims": (8, 30),
    "EmpireState": (8, 30), "EmploymentCostIndex": (8, 30),
    "FOMC": (14, 0),
    "ADP": (8, 15),
    "JOLTS": (10, 0),
    "ISMMfg": (10, 0),
    "ISMServices": (10, 0),
    "CBConfidence": (10, 0),
    "PhillyFed": (8, 30),
    "DurableGoods": (8, 30),
}

EVENT_SWEEP_HOURS: dict[str, int] = {
    "CPI": 3, "NFP": 3, "PPI": 3, "RetailSales": 3,
    "PCE": 3, "GDP": 3, "JoblessClaims": 3,
    "EmpireState": 3, "EmploymentCostIndex": 3,
    "FOMC": 3,
    "ADP": 3,
    "JOLTS": 2,
    "ISMMfg": 2,
    "ISMServices": 2,
    "CBConfidence": 2,
    "PhillyFed": 3,
    "DurableGoods": 3,
}


# ---------------------------------------------------------------------------
# Parquet loaders
# ---------------------------------------------------------------------------

def load_es_bars() -> dict[int, dict]:
    """Load ES parquet → bar dict keyed by unix seconds (int)."""
    print(f"[load] ES 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    df = pl.read_parquet("/Users/angelo/winning-day-algo/data/ES_1m_10y_concat.parquet")
    from_ts = int(datetime.strptime(DATE_FROM, "%Y-%m-%d").replace(tzinfo=ET).astimezone(timezone.utc).timestamp())
    to_ts   = int(datetime.strptime(DATE_TO,   "%Y-%m-%d").replace(tzinfo=ET).astimezone(timezone.utc).timestamp()) + 86400
    df = df.filter(
        (pl.col("ts").dt.epoch(time_unit="s") >= from_ts) &
        (pl.col("ts").dt.epoch(time_unit="s") <  to_ts)
    )
    bars = {
        int(row[0]): {"open": row[1], "high": row[2], "low": row[3], "close": row[4]}
        for row in df.select(
            pl.col("ts").dt.epoch(time_unit="s"),
            "open", "high", "low", "close"
        ).iter_rows()
    }
    print(f"[load] ES {len(bars)} bars indexed", file=sys.stderr)
    return bars


def load_nq_bars() -> dict[int, dict]:
    """Load NQ parquet → bar dict keyed by unix seconds (int)."""
    print(f"[load] NQ 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    df = pl.read_parquet("/Users/angelo/winning-day-algo/data/NQ_1m_10y_concat.parquet")
    from_ts = int(datetime.strptime(DATE_FROM, "%Y-%m-%d").replace(tzinfo=ET).astimezone(timezone.utc).timestamp())
    to_ts   = int(datetime.strptime(DATE_TO,   "%Y-%m-%d").replace(tzinfo=ET).astimezone(timezone.utc).timestamp()) + 86400
    df = df.filter(
        (pl.col("ts").dt.epoch(time_unit="s") >= from_ts) &
        (pl.col("ts").dt.epoch(time_unit="s") <  to_ts)
    )
    bars = {
        int(row[0]): {"open": row[1], "high": row[2], "low": row[3], "close": row[4]}
        for row in df.select(
            pl.col("ts").dt.epoch(time_unit="s"),
            "open", "high", "low", "close"
        ).iter_rows()
    }
    print(f"[load] NQ {len(bars)} bars indexed", file=sys.stderr)
    return bars


# ---------------------------------------------------------------------------
# Event loader
# ---------------------------------------------------------------------------

def load_events(event_type: str) -> list[dict]:
    """Read NEWS_CSV; keep rows with event_type==X and matching release time inside window."""
    rel_h, rel_m = EVENT_RELEASE_TIME[event_type]
    expected_time = f"{rel_h:02d}:{rel_m:02d}"
    from_dt = datetime.strptime(DATE_FROM, "%Y-%m-%d").date()
    to_dt   = datetime.strptime(DATE_TO,   "%Y-%m-%d").date()

    events: list[dict] = []
    with open(NEWS_CSV, newline="") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
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
            if event_type == "GDP" and d.month not in (1, 4, 7, 10):
                continue
            et_dt  = datetime(d.year, d.month, d.day, rel_h, rel_m, tzinfo=ET)
            utc_dt = et_dt.astimezone(timezone.utc)
            date_str = d.strftime("%Y-%m-%d")
            events.append({
                "date": date_str,
                "t0_utc": int(utc_dt.timestamp()),
                "et_date": date_str,
                "event_type": event_type,
                "event_raw": f"{event_type} (CSV {row['source']})",
            })
    # Defensive guard: NFP is exactly 1 release per calendar month. A 2nd NFP in
    # the same month = source-CSV drift (benchmark revision / dup row) → phantom
    # event. Fail loud rather than silently injecting it (cf taskLesson 2026-05-08).
    if event_type == "NFP":
        from collections import Counter
        dupes = {m: c for m, c in Counter(e["date"][:7] for e in events).items() if c > 1}
        if dupes:
            raise ValueError(f"NFP calendar drift: >1 event in month(s) {dupes} — clean {NEWS_CSV}")
    events.sort(key=lambda x: x["t0_utc"])
    return events


# ---------------------------------------------------------------------------
# ES detect_setup (ES_TICK = 0.25)
# ---------------------------------------------------------------------------

def detect_setup_es(ev: dict, bars_idx: dict[int, dict]) -> dict:
    """Sweep + IFVG entry detection for ES (tick = ES_TICK = 0.25)."""
    event_type = ev["event_type"]
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]
    out = {
        "date": ev["date"],
        "et_date": et_date,
        "year": et_date[:4],
        "t0_utc": t0,
    }

    release_h, release_m = EVENT_RELEASE_TIME[event_type]
    sweep_offset = EVENT_SWEEP_HOURS[event_type]
    sweep_h = release_h + sweep_offset
    resolve_h = sweep_h + 1

    release_bar = bars_idx.get(t0)
    if release_bar is None:
        out["status"] = "SKIP_NO_PRE"
        return out
    pre_high = release_bar["high"]
    pre_low  = release_bar["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(sweep_h, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts   = int(deadline_et.timestamp())
    resolve_deadline_ts = int(deadline_et.replace(hour=resolve_h).timestamp())

    sweep_dir = sweep_price = sweep_ts = None
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            up = b["high"] > pre_high
            dn = b["low"]  < pre_low
            if up and dn:
                if (b["high"] - pre_high) >= (pre_low - b["low"]):
                    sweep_dir, sweep_price = "UP", b["high"]
                else:
                    sweep_dir, sweep_price = "DOWN", b["low"]
                sweep_ts = cur
                break
            if up:
                sweep_dir, sweep_price, sweep_ts = "UP",   b["high"], cur; break
            if dn:
                sweep_dir, sweep_price, sweep_ts = "DOWN", b["low"],  cur; break
        cur += 60

    if sweep_dir is None:
        out["status"] = "SKIP_NO_SWEEP"
        return out

    side = "SHORT" if sweep_dir == "UP" else "LONG"
    # SL computed AFTER IFVG matched (lowest low / highest high between sweep_ts and entry_ts).
    # Placeholder here to keep variable defined until matched_fvg / entry_ts known. ES_TICK = 0.25.
    sl = None
    tp = pre_low if sweep_dir == "UP" else pre_high

    scan_bars = []
    cur = sweep_ts
    while cur <= resolve_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            scan_bars.append({"ts": cur, **b})
        cur += 60
    if len(scan_bars) < 3:
        out["status"] = "SKIP_NO_SCAN_BARS"
        return out

    opp_level_low  = pre_low  - ES_TICK
    opp_level_high = pre_high + ES_TICK

    pending_fvgs: list[dict] = []
    entry_ts = entry_price = None
    triggering_fvg: dict | None = None
    both_sides_swept = False
    for n, bar in enumerate(scan_bars):
        if n > 0:
            if sweep_dir == "UP"   and bar["low"]  <= opp_level_low:
                both_sides_swept = True; break
            if sweep_dir == "DOWN" and bar["high"] >= opp_level_high:
                both_sides_swept = True; break
        for fvg in pending_fvgs:
            if sweep_dir == "UP":
                if bar["close"] < fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]
                    triggering_fvg = fvg
                    break
            else:
                if bar["close"] > fvg["break_level"]:
                    entry_ts = bar["ts"]; entry_price = bar["close"]
                    triggering_fvg = fvg
                    break
        if entry_ts is not None:
            break
        if n >= 2:
            a  = scan_bars[n - 2]
            b_ = scan_bars[n - 1]
            c  = scan_bars[n]
            if (b_["ts"] - a["ts"] == 60) and (c["ts"] - b_["ts"] == 60):
                fvg = find_3bar_fvg(a, b_, c, sweep_dir)
                if fvg is not None:
                    fvg = {**fvg, "formation_ts": c["ts"]}
                    pending_fvgs.append(fvg)

    if both_sides_swept:
        out["status"] = "SKIP_BOTH_SIDES_SWEPT"
        out["sweep_dir"]  = sweep_dir
        out["sweep_ts"]   = sweep_ts
        out["pre_high"]   = pre_high
        out["pre_low"]    = pre_low
        return out

    if entry_ts is None:
        out["status"] = "SKIP_NO_IFVG"
        return out

    # SL = full sweep displacement extreme (between sweep_ts and entry_ts inclusive) + 1 tick padding.
    # Includes the bars after IFVG formation that may have wicked deeper before invalidation.
    sweep_disp_bars = [b for b in scan_bars if sweep_ts <= b["ts"] <= entry_ts]
    if not sweep_disp_bars:
        out["status"] = "SKIP_NO_SWEEP_DISP"; return out
    if sweep_dir == "UP":
        sl = max(b["high"] for b in sweep_disp_bars) + ES_TICK
    else:
        sl = min(b["low"] for b in sweep_disp_bars) - ES_TICK

    if side == "SHORT":
        if entry_price >= sl or entry_price <= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out
    else:
        if entry_price <= sl or entry_price >= tp:
            out["status"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out

    out["status"]               = "OK"
    out["side"]                 = side
    out["sweep_dir"]            = sweep_dir
    out["sweep_ts"]             = sweep_ts
    out["pre_high"]             = pre_high
    out["pre_low"]              = pre_low
    out["entry_ts"]             = entry_ts
    out["entry_price"]          = entry_price
    out["sl"]                   = sl
    out["tp"]                   = tp
    out["resolve_deadline_ts"]  = resolve_deadline_ts
    if triggering_fvg is not None:
        out["ifvg_top"]            = triggering_fvg["zone_high"]
        out["ifvg_bottom"]         = triggering_fvg["zone_low"]
        out["ifvg_formation_ts"]   = triggering_fvg["formation_ts"]
    return out


# ---------------------------------------------------------------------------
# NQ SMT detection (sister index for ES)
# ---------------------------------------------------------------------------

def compute_nq_smt(ev: dict, nq_idx: dict[int, dict], side: str) -> bool:
    """Did NQ take its target during release→sweep_deadline window?
    ES SHORT (ES swept UP) → NQ low < NQ pre_low.
    ES LONG  (ES swept DOWN) → NQ high > NQ pre_high.
    """
    event_type = ev["event_type"]
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]

    release_h, release_m = EVENT_RELEASE_TIME[event_type]
    sweep_h = release_h + EVENT_SWEEP_HOURS[event_type]

    nq_release = nq_idx.get(t0)
    if nq_release is None:
        return False
    nq_pre_high = nq_release["high"]
    nq_pre_low  = nq_release["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(sweep_h, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())

    nq_high_swept = False
    nq_low_swept  = False
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = nq_idx.get(cur)
        if b is not None:
            if b["high"] > nq_pre_high:
                nq_high_swept = True
            if b["low"] < nq_pre_low:
                nq_low_swept = True
        cur += 60

    if side == "SHORT":
        return nq_low_swept
    else:
        return nq_high_swept


# ---------------------------------------------------------------------------
# Outcome helper
# ---------------------------------------------------------------------------

def _outcome_from_result(result: str, pts: float) -> str:
    if result in ("WIN", "WIN_FULL"):
        return "win"
    if result in ("LOSS", "LOSS_HALF"):
        return "loss"
    if result == "BE":
        return "be"
    if result in ("TIMEOUT", "TIMEOUT_HALF"):
        return "timeout"
    if result == "LOSS_HALF_BE":
        if pts > 0.001:   return "win"
        if pts < -0.001:  return "loss"
        return "be"
    if result == "BE_HALF":
        if pts > 0.001:   return "win"
        return "be"
    return "loss"


# ---------------------------------------------------------------------------
# Per-event runner
# ---------------------------------------------------------------------------

def collect_trade_db(event_type: str, es_idx: dict, nq_idx: dict) -> dict:
    """Run engine for one event_type. Returns {n_events_total, n_csv_events, trade_db}."""
    events = load_events(event_type)
    if not events:
        return {"n_events_total": 0, "n_csv_events": 0, "trade_db": []}

    trade_db = []
    n_ok = 0
    for ev in events:
        s = detect_setup_es(ev, es_idx)
        if s["status"] != "OK":
            continue
        n_ok += 1
        smt_target = compute_nq_smt(ev, nq_idx, s["side"])
        for variant in VARIANTS:
            sim = simulate_variant(s, variant, es_idx)
            if sim["result"] == "SKIP_NO_RESOLVE":
                continue
            exit_ts_raw = sim.get("exit_ts")
            trade_db.append({
                "year":              s["year"],
                "t0_utc":            ev["t0_utc"],
                "side":              s["side"],
                "smt_target":        smt_target,
                "variant":           variant,
                "result":            sim["result"],
                "pts":               sim["pts"],
                "entry_ts":          s["entry_ts"],
                "entry_price":       s["entry_price"],
                "sl_price":          s["sl"],
                "tp_price":          s["tp"],
                "exit_ts":           exit_ts_raw,
                "exit_price":        sim.get("exit_price"),
                "data_high":         s["pre_high"],
                "data_low":          s["pre_low"],
                "sweep_ts":          s["sweep_ts"],
                "sweep_side":        s["sweep_dir"],
                "ifvg_top":          s.get("ifvg_top"),
                "ifvg_bottom":       s.get("ifvg_bottom"),
                "ifvg_formation_ts": s.get("ifvg_formation_ts"),
            })

    return {"n_events_total": n_ok, "n_csv_events": len(events), "trade_db": trade_db}


def build_rows_and_trades(trade_db: list[dict]) -> tuple[list[dict], list[dict]]:
    """Build 216-row schema + trades list from a combined trade_db."""
    rows = []
    for variant in VARIANTS:
        for smt in [False, True]:
            for side in SIDES:
                for year in YEARS + ["ALL"]:
                    sub = [
                        t for t in trade_db
                        if t["variant"] == variant
                        and (side == "BOTH" or t["side"] == side)
                        and (year == "ALL"  or t["year"] == year)
                        and (not smt or t["smt_target"])
                    ]
                    agg = aggregate_rows(sub, cost_pts=cost_per_trade("ES"))
                    rows.append({"year": year, "variant": variant, "smt": smt, "side": side, **agg})

    trades = []
    for t in trade_db:
        ts_str = datetime.fromtimestamp(t["t0_utc"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        trades.append({
            "ts":      ts_str,
            "year":    int(t["year"]),
            "variant": t["variant"],
            "smt":     t["smt_target"],
            "side":    t["side"].lower(),
            "pnl_pts": t["pts"],
            "outcome": _outcome_from_result(t["result"], t["pts"]),
        })
    trades.sort(key=lambda x: x["ts"])
    return rows, trades


def find_row(rows, year, variant, smt, side):
    for r in rows:
        if r["year"] == year and r["variant"] == variant and r["smt"] == smt and r["side"] == side:
            return r
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import time as _time
    t_start = _time.time()

    print(f"[setup] loading ES + NQ bars once ({DATE_FROM}..{DATE_TO})...", file=sys.stderr)
    es_idx = load_es_bars()
    nq_idx = load_nq_bars()

    all_trade_db: list[dict] = []
    n_events_total_all = 0
    n_csv_events_all   = 0
    summary_lines      = []
    per_event_results: dict[str, dict] = {}

    for event_type in EVENTS:
        print(f"\n[run ] {event_type}", file=sys.stderr)
        res = collect_trade_db(event_type, es_idx, nq_idx)

        if res["n_csv_events"] == 0:
            summary_lines.append(f"{event_type:22s} SKIP: 0 CSV events")
            continue

        n_events_total_all += res["n_events_total"]
        n_csv_events_all   += res["n_csv_events"]
        all_trade_db.extend(res["trade_db"])

        ev_rows, ev_trades = build_rows_and_trades(res["trade_db"])
        per_event_results[event_type] = {
            "rows":           ev_rows,
            "trades":         ev_trades,
            "trade_db":       res["trade_db"],
            "n_events_total": res["n_events_total"],
            "n_csv_events":   res["n_csv_events"],
        }
        r = find_row(ev_rows, "ALL", "no_be", True, "BOTH")
        if r is None:
            summary_lines.append(f"{event_type:22s} ROW MISSING")
            continue
        pf = r["pf"] if r["pf"] is not None else float("inf")
        pf_str = f"{pf:.2f}" if isinstance(pf, (int, float)) and pf != float("inf") else "inf"
        wr_pct = int(round(r["wr"] * 100))
        summary_lines.append(
            f"{event_type:22s} n={r['n']:3d}  WR={wr_pct:2d}%  PF={pf_str:>5s}  "
            f"net={r['net_pts']:+8.1f}  setups_ok={res['n_events_total']}/{res['n_csv_events']}"
        )

    if len(all_trade_db) < 100:
        print(f"[ERROR] Only {len(all_trade_db)} raw trade records — check bar lookup!", file=sys.stderr)
        sys.exit(1)

    out_dir = "/Users/angelo/jtnq-hub-v3-es/public/data"
    os.makedirs(out_dir, exist_ok=True)
    per_event_paths = []
    for event_type, evr in per_event_results.items():
        slug = EVENT_SLUG[event_type]
        ev_out = {
            "meta": {
                "source": (
                    "ES (S&P 500 futures, winning-day-algo, 10y, 2016-01-04…2026-05-11)"
                    " + NQ (SMT partner)"
                ),
                "date_from": DATE_FROM,
                "date_to":   DATE_TO,
                "n_events_total": evr["n_events_total"],
                "n_csv_events":   evr["n_csv_events"],
                "generated_at":   datetime.now(timezone.utc).isoformat(),
                "event_filter":   event_type,
                "csv":            NEWS_CSV,
                "variants": {
                    "no_be":   "Pure SL/TP/timeout, no breakeven move",
                    "be_50":   "MFE>=50% TP-dist arms BE; bar touching entry exits flat",
                    "tp1_be":  "MFE>=50% closes half at +50% TP-dist AND moves stop to BE on remainder",
                },
                "smt": {
                    "false": "no SMT filter",
                    "true":  "NQ took its OPPOSITE-side pre-news liquidity (ES short → NQ low<pre_low; ES long → NQ high>pre_high)",
                },
                "tick": "ES_TICK=0.25 (S&P 500 futures)",
            },
            "rows":   evr["rows"],
            "trades": evr["trades"],
        }
        ev_path = os.path.join(out_dir, f"{slug}.json")
        with open(ev_path, "w") as f:
            json.dump(ev_out, f, indent=2, default=str)
        per_event_paths.append(ev_path)
        print(f"[out ] {ev_path}  rows={len(evr['rows'])} trades={len(evr['trades'])}", file=sys.stderr)

        prices_payload = []
        for t in evr["trade_db"]:
            ts_iso         = datetime.fromtimestamp(t["t0_utc"],   tz=timezone.utc).isoformat()
            entry_ts_iso   = datetime.fromtimestamp(t["entry_ts"], tz=timezone.utc).isoformat() if t["entry_ts"] is not None else None
            exit_ts_iso    = datetime.fromtimestamp(t["exit_ts"],  tz=timezone.utc).isoformat() if t["exit_ts"]  is not None else None
            sweep_ts_iso   = datetime.fromtimestamp(t["sweep_ts"], tz=timezone.utc).isoformat() if t["sweep_ts"] is not None else None
            form_ts_iso    = datetime.fromtimestamp(t["ifvg_formation_ts"], tz=timezone.utc).isoformat() if t.get("ifvg_formation_ts") is not None else None
            prices_payload.append({
                "ts":                ts_iso,
                "entry_ts":          entry_ts_iso,
                "variant":           t["variant"],
                "smt":               t["smt_target"],
                "side":              t["side"].lower(),
                "entry_price":       t["entry_price"],
                "sl_price":          t["sl_price"],
                "tp_price":          t["tp_price"],
                "exit_ts":           exit_ts_iso,
                "exit_price":        t["exit_price"],
                "data_high":         t["data_high"],
                "data_low":          t["data_low"],
                "sweep_ts":          sweep_ts_iso,
                "sweep_side":        t["sweep_side"],
                "ifvg_top":          t.get("ifvg_top"),
                "ifvg_bottom":       t.get("ifvg_bottom"),
                "ifvg_formation_ts": form_ts_iso,
            })
        prices_out = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source":       "run_es_10y_all_events.py",
            "event":        event_type,
            "asset":        "ES",
            "prices":       prices_payload,
        }
        prices_path = os.path.join(out_dir, f"{slug}-trade-prices.json")
        with open(prices_path, "w") as f:
            json.dump(prices_out, f, indent=2, default=str)
        per_event_paths.append(prices_path)
        print(f"[out ] {prices_path}  prices={len(prices_payload)}", file=sys.stderr)

    combined_rows, all_trades = build_rows_and_trades(all_trade_db)

    out = {
        "meta": {
            "source": (
                "ES (S&P 500 futures, winning-day-algo, 10y, 2016-01-04…2026-05-11)"
                " + NQ (SMT partner)"
            ),
            "date_from": DATE_FROM,
            "date_to":   DATE_TO,
            "n_events_total": n_events_total_all,
            "n_csv_events":   n_csv_events_all,
            "generated_at":   datetime.now(timezone.utc).isoformat(),
            "event_filter":   "ALL_17_EVENTS",
            "csv":            NEWS_CSV,
            "events":         EVENTS,
            "variants": {
                "no_be":   "Pure SL/TP/timeout, no breakeven move",
                "be_50":   "MFE>=50% TP-dist arms BE; bar touching entry exits flat",
                "tp1_be":  "MFE>=50% closes half at +50% TP-dist AND moves stop to BE on remainder",
            },
            "smt": {
                "false": "no SMT filter",
                "true":  "NQ took its OPPOSITE-side pre-news liquidity (ES short → NQ low<pre_low; ES long → NQ high>pre_high)",
            },
            "tick": "ES_TICK=0.25 (S&P 500 futures)",
        },
        "rows":   combined_rows,
        "trades": all_trades,
    }

    out_path = "/Users/angelo/jtnq-hub-v3-es/public/data/es-ifvg-smt.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)

    elapsed = _time.time() - t_start

    r_headline = find_row(combined_rows, "ALL", "no_be", True, "BOTH")
    print(f"\n=== no_be / BOTH / ALL / smt=true (target) — ES 10y ALL 17 EVENTS ===")
    if r_headline:
        pf = r_headline["pf"] if r_headline["pf"] is not None else float("inf")
        pf_str = f"{pf:.2f}" if isinstance(pf, (int, float)) and pf != float("inf") else "inf"
        print(f"  n={r_headline['n']}  WR={int(round(r_headline['wr']*100))}%  PF={pf_str}  net={r_headline['net_pts']:+.1f} pts")
    print(f"\n=== per-event summary (smt=True target) ===")
    for ln in summary_lines:
        print(ln)
    print(f"\n=== output ===")
    print(f"  {out_path}  (combined)")
    for p in per_event_paths:
        sz = os.path.getsize(p)
        print(f"  {p}  ({sz//1024}KB)")
    print(f"  combined rows: {len(combined_rows)} | trades: {len(all_trades)}")
    print(f"\n=== run time: {elapsed:.1f}s ===")


if __name__ == "__main__":
    main()

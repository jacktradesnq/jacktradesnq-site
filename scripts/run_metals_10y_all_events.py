"""GC 10y 8:30 ET news IFVG runner — 17 events × 3 exit variants × 2-way SI SMT × 3 sides × 11 year buckets.

Loads GC + SI parquet ONCE for the full 10y window (2016-01-04 → 2026-05-11), then loops
over 17 event types. Output schema matches the existing site Explorer (same as NQ runner).

GC-specific notes:
- Tick size: GC = 0.10 pt (NQ = 0.25 pt). detect_setup_metals is a local clone of
  detect_setup from run_news_830_variants.py with GC_TICK = 0.10 substituted. simulate_variant
  and aggregate_rows are reused unmodified — they only care about entry/sl/tp prices, not tick size.
- GC parquet: forward-filled continuous 5.44M bars, ts in UTC ns, no tz gap.
- SI parquet: sparse 63k bars, ts in America/New_York ns. Sparse is intentional — silent minutes
  can't produce new extremes, so missing bars naturally return SMT=False (no edge bias).
- SMT semantics: GC SHORT (sweep UP) → SI low < SI pre_low; GC LONG (sweep DOWN) → SI high > SI pre_high.

Usage:
    uv run python run_metals_10y_all_events.py
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

# GC tick = 0.10 pt (Comex gold). NQ tick = 0.25 (unused here).
# simulate_variant and aggregate_rows are tick-agnostic: they operate on raw price pts.
GC_TICK = 0.10

TIMEOUT_SWEEP_HOUR_ET = 11   # sweep window: 8:30 → 11:00 ET
TIMEOUT_RESOLVE_HOUR_ET = 16  # resolve timeout: 16:00 ET

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

# Mapping event_type → site slug (used to generate per-event _gc.json files)
EVENT_SLUG: dict[str, str] = {
    "CPI":                  "cpi-ifvg-smt",
    "NFP":                  "nfp-ifvg-smt",
    "PPI":                  "ppi-ifvg-smt",
    "RetailSales":          "retailsales-ifvg-smt",
    "PCE":                  "pce-ifvg-smt",
    "GDP":                  "gdp-ifvg-smt",
    "JoblessClaims":        "joblessclaims-ifvg-smt",
    "EmpireState":          "empirestate-ifvg-smt",
    "EmploymentCostIndex":  "employmentcostindex-ifvg-smt",
    "FOMC":                 "fomc-ifvg-smt",
    "ADP":                  "adp-ifvg-smt",
    "JOLTS":                "jolts-ifvg-smt",
    "ISMMfg":               "ism-mfg-ifvg-smt",
    "ISMServices":          "ism-services-ifvg-smt",
    "CBConfidence":         "cb-confidence-ifvg-smt",
    "PhillyFed":            "philly-fed-ifvg-smt",
    "DurableGoods":         "durable-goods-ifvg-smt",
}


# Release time (hour, minute) per event type, Eastern time
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

# Sweep window: release hour + N hours offset per event type
EVENT_SWEEP_HOURS: dict[str, int] = {
    "CPI": 3, "NFP": 3, "PPI": 3, "RetailSales": 3,
    "PCE": 3, "GDP": 3, "JoblessClaims": 3,
    "EmpireState": 3, "EmploymentCostIndex": 3,
    "FOMC": 3,
    "ADP": 3,  # sweep window 8:16 → 11:15 ET (release_h + 3)
    "JOLTS": 2,  # sweep window 10:01 → 12:00 ET (release_h + 2)
    "ISMMfg": 2,  # sweep window 10:01 → 12:00 ET (release_h + 2)
    "ISMServices": 2,  # sweep window 10:01 → 12:00 ET (release_h + 2)
    "CBConfidence": 2,  # sweep window 10:01 → 12:00 ET (release_h + 2)
    "PhillyFed": 3,  # sweep window 8:31 → 11:30 ET (release_h + 3)
    "DurableGoods": 3,  # sweep window 8:31 → 11:30 ET (release_h + 3)
}


# ---------------------------------------------------------------------------
# Parquet loaders — direct polars, bypassing data.py (which only knows NQ/ES)
# ---------------------------------------------------------------------------

def load_gc_bars() -> dict[int, dict]:
    """Load GC forward-filled parquet → bar dict keyed by unix seconds (int)."""
    print(f"[load] GC 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    df = pl.read_parquet("/Users/angelo/backtesting/ict/data/metals/GC_1m_10y_ffill.parquet")
    # ts is datetime[ns, UTC] — convert to int seconds
    from_ts = int(datetime.strptime(DATE_FROM, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    to_ts   = int(datetime.strptime(DATE_TO,   "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()) + 86400
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
    print(f"[load] GC {len(bars)} bars indexed", file=sys.stderr)
    return bars


def load_si_bars() -> dict[int, dict]:
    """Load SI parquets from backtesting-data/metals-fresh/SI_1m_part*.parquet (UTC ts_event).
    SI is sparse intraday; missing minute → compute_si_smt returns False naturally.
    """
    import glob
    files = sorted(glob.glob("/Users/angelo/backtesting-data/metals-fresh/SI_1m_part*.parquet"))
    if not files:
        print("[warn] SI parquet not found — smt=true rows will be 0", file=sys.stderr)
        return {}
    print(f"[load] SI 1m bars {DATE_FROM}..{DATE_TO} ({len(files)} parts)...", file=sys.stderr)
    df = pl.concat([pl.read_parquet(f) for f in files])
    from_ts = int(datetime.strptime(DATE_FROM, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    to_ts   = int(datetime.strptime(DATE_TO,   "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()) + 86400
    df = df.filter(
        (pl.col("ts_event").dt.epoch(time_unit="s") >= from_ts) &
        (pl.col("ts_event").dt.epoch(time_unit="s") <  to_ts)
    )
    bars = {
        int(row[0]): {"open": row[1], "high": row[2], "low": row[3], "close": row[4]}
        for row in df.select(
            pl.col("ts_event").dt.epoch(time_unit="s"),
            "open", "high", "low", "close"
        ).iter_rows()
    }
    print(f"[load] SI {len(bars)} bars indexed", file=sys.stderr)
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
            # GDP advance-only filter: keep only Q1/Q2/Q3/Q4 release months
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
    events.sort(key=lambda x: x["t0_utc"])
    return events


# ---------------------------------------------------------------------------
# GC-specific detect_setup (clone of detect_setup from run_news_830_variants.py
# with GC_TICK substituted for NQ TICK=0.25)
# ---------------------------------------------------------------------------

def detect_setup_metals(ev: dict, bars_idx: dict[int, dict]) -> dict:
    """Sweep + IFVG entry detection for GC (tick = GC_TICK = 0.10).

    Structurally identical to detect_setup in run_news_830_variants.py.
    Cloned locally because TICK is hardcoded at module level in that file as 0.25 (NQ).
    Sweep/resolve windows are per-event-type (FOMC=14:00 release uses 17:00/18:00).
    """
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
    resolve_h = sweep_h + 1  # resolve = sweep + 1h

    # Release-bar range: single release-time ET 1m candle at t0
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

    # Sweep watch starts at t0+1 (8:31), AFTER the release bar closes
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
    # Placeholder here to keep variable defined until matched_fvg / entry_ts known. GC_TICK = 0.10.
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

    # Both-sides-swept invalidation (GC_TICK used here too)
    opp_level_low  = pre_low  - GC_TICK   # used when sweep_dir == "UP"
    opp_level_high = pre_high + GC_TICK   # used when sweep_dir == "DOWN"

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
                    # Track formation timestamp = c (the third bar closing the FVG pattern)
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
        sl = max(b["high"] for b in sweep_disp_bars) + GC_TICK
    else:
        sl = min(b["low"] for b in sweep_disp_bars) - GC_TICK

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
    # Triggering FVG (the one whose break_level the entry bar closed through)
    if triggering_fvg is not None:
        out["ifvg_top"]            = triggering_fvg["zone_high"]
        out["ifvg_bottom"]         = triggering_fvg["zone_low"]
        out["ifvg_formation_ts"]   = triggering_fvg["formation_ts"]
    return out


# ---------------------------------------------------------------------------
# SI SMT detection (same logic as compute_es_smt, adapted for SI/GC)
# ---------------------------------------------------------------------------

def compute_si_smt(ev: dict, si_idx: dict[int, dict], side: str) -> bool:
    """Did SI take its target during release→sweep_deadline window?
    GC SHORT (GC swept UP) → SI low < SI pre_low.
    GC LONG  (GC swept DOWN) → SI high > SI pre_high.
    SI is sparse: missing release bar → return False (no confirmation, not a disqualifier).
    """
    event_type = ev["event_type"]
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]

    release_h, release_m = EVENT_RELEASE_TIME[event_type]
    sweep_h = release_h + EVENT_SWEEP_HOURS[event_type]

    si_release = si_idx.get(t0)
    if si_release is None:
        return False
    si_pre_high = si_release["high"]
    si_pre_low  = si_release["low"]

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(sweep_h, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())

    si_high_swept = False
    si_low_swept  = False
    cur = t0 + 60
    while cur <= sweep_deadline_ts:
        b = si_idx.get(cur)
        if b is not None:
            if b["high"] > si_pre_high:
                si_high_swept = True
            if b["low"] < si_pre_low:
                si_low_swept = True
        cur += 60

    if side == "SHORT":
        return si_low_swept
    else:
        return si_high_swept


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

def collect_trade_db(event_type: str, gc_idx: dict, si_idx: dict) -> dict:
    """Run engine for one event_type. Returns {n_events_total, n_csv_events, trade_db}."""
    events = load_events(event_type)
    if not events:
        return {"n_events_total": 0, "n_csv_events": 0, "trade_db": []}

    trade_db = []
    n_ok = 0
    for ev in events:
        s = detect_setup_metals(ev, gc_idx)
        if s["status"] != "OK":
            continue
        n_ok += 1
        smt_target = compute_si_smt(ev, si_idx, s["side"])
        for variant in VARIANTS:
            sim = simulate_variant(s, variant, gc_idx)
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
                # Overlay fields (entry/sl/tp/exit prices + ts + IFVG + sweep + data H/L)
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
                    agg = aggregate_rows(sub, cost_pts=cost_per_trade("GC"))
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

    print(f"[setup] loading GC + SI bars once ({DATE_FROM}..{DATE_TO})...", file=sys.stderr)
    gc_idx = load_gc_bars()
    si_idx = load_si_bars()

    all_trade_db: list[dict] = []
    n_events_total_all = 0
    n_csv_events_all   = 0
    summary_lines      = []
    # keyed by event_type → (ev_rows, ev_trades, res metadata)
    per_event_results: dict[str, dict] = {}

    for event_type in EVENTS:
        print(f"\n[run ] {event_type}", file=sys.stderr)
        res = collect_trade_db(event_type, gc_idx, si_idx)

        if res["n_csv_events"] == 0:
            summary_lines.append(f"{event_type:22s} SKIP: 0 CSV events")
            continue

        n_events_total_all += res["n_events_total"]
        n_csv_events_all   += res["n_csv_events"]
        all_trade_db.extend(res["trade_db"])

        # Per-event summary: build quick rows for this event only
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

    # Sanity gate
    if len(all_trade_db) < 100:
        print(f"[ERROR] Only {len(all_trade_db)} raw trade records — check bar lookup!", file=sys.stderr)
        sys.exit(1)

    # Emit per-event GC JSONs (same schema as NQ per-event JSONs on the site)
    # Write directly to jtnq-hub-v3 public/data (overwrite existing files)
    out_dir = "/Users/angelo/jacktradesnq-site-costs/public/data"
    os.makedirs(out_dir, exist_ok=True)
    per_event_paths = []
    for event_type, evr in per_event_results.items():
        slug = EVENT_SLUG[event_type]
        ev_out = {
            "meta": {
                "source": (
                    "GC.n.0 (Databento, 10y forward-filled, 2016-01-04…2026-05-11)"
                    " + SI.n.0 (SMT partner, sparse)"
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
                    "true":  "SI took its OPPOSITE-side pre-news liquidity (GC short → SI low<pre_low; GC long → SI high>pre_high)",
                },
                "tick": "GC_TICK=0.10 (Comex gold); detect_setup_metals is a local clone of detect_setup with this substitution",
            },
            "rows":   evr["rows"],
            "trades": evr["trades"],
        }
        ev_path = os.path.join(out_dir, f"{slug}_gc.json")
        with open(ev_path, "w") as f:
            json.dump(ev_out, f, indent=2, default=str)
        per_event_paths.append(ev_path)
        print(f"[out ] {ev_path}  rows={len(evr['rows'])} trades={len(evr['trades'])}", file=sys.stderr)

        # Per-trade overlay file: <slug>-gc-trade-prices.json (consumed by V3Tabs chart)
        # Slug rule: study slug is `<event>-ifvg-smt-gc`, filename is `<study-slug>-trade-prices.json`.
        # EVENT_SLUG[event_type] gives `<event>-ifvg-smt` so we just append `-gc-trade-prices.json`.
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
            "source":       "run_metals_10y_all_events.py",
            "event":        event_type,
            "asset":        "GC",
            "prices":       prices_payload,
        }
        prices_path = os.path.join(out_dir, f"{slug}-gc-trade-prices.json")
        with open(prices_path, "w") as f:
            json.dump(prices_out, f, indent=2, default=str)
        per_event_paths.append(prices_path)
        print(f"[out ] {prices_path}  prices={len(prices_payload)}", file=sys.stderr)

    # Build combined 216 rows + trades from all 17 events
    combined_rows, all_trades = build_rows_and_trades(all_trade_db)

    out = {
        "meta": {
            "source": (
                "GC.n.0 (Databento, 10y forward-filled, 2016-01-04…2026-05-11)"
                " + SI.n.0 (SMT partner, sparse)"
                " (SMT filter skipped — SI parquet unavailable)"
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
                "true":  "SI took its OPPOSITE-side pre-news liquidity (GC short → SI low<pre_low; GC long → SI high>pre_high)",
            },
            "tick": "GC_TICK=0.10 (Comex gold); detect_setup_metals is a local clone of detect_setup with this substitution",
        },
        "rows":   combined_rows,
        "trades": all_trades,
    }

    out_path = "/Users/angelo/jacktradesnq-site-costs/public/data/gc-ifvg-smt.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)

    elapsed = _time.time() - t_start

    r_headline = find_row(combined_rows, "ALL", "no_be", True, "BOTH")
    print(f"\n=== no_be / BOTH / ALL / smt=true (target) — GC 10y ALL 17 EVENTS ===")
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

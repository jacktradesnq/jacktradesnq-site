"""NFP-only news 8:30 ET IFVG with BE move @50% TP distance.

Adapted from run_news_830_v2.py:
- Filter: event_type == "NFP" only.
- Window: 2022-09-01 → 2026-05-09.
- Sweep window 150 min (TIMEOUT_SWEEP_HOUR_ET = 11 ET keeps that).
- BE move: when MFE >= 50% of |TP - entry|, arm BE; if price returns to entry → exit RESULT_BE pts=0.
- Same-bar SL hit before BE retest → SL still wins (worst-case honest).

Output: results/nfp_be50.json + summary stdout.
"""
from __future__ import annotations
import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from data import load_bars
from run_news_830_v2 import (
    classify,
    event_priority_rank,
    EVENT_PRIORITY,
    find_3bar_fvg,
    scan_bars_last_close,
)

NEWS_CSV = "/Users/angelo/jtnq-hub/data/news_red_folder_full.csv"
ET = ZoneInfo("America/New_York")
TICK = 0.25
PRE_LOOKBACK_MIN = 5
TIMEOUT_SWEEP_HOUR_ET = 11   # 8:30 ET + 150 min = 11:00 ET
TIMEOUT_RESOLVE_HOUR_ET = 16

DATE_FROM = "2019-05-05"
DATE_TO = "2026-05-09"
SYMBOL = "MNQ"

RESULT_BE = "BE"


def load_nfp_events() -> list[dict]:
    """Load NFP-only High events at 8:30 ET in [DATE_FROM, DATE_TO]."""
    by_key: dict[tuple, dict] = {}
    with open(NEWS_CSV, newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get("impact", "").strip() != "High":
                continue
            time_str = r.get("time", "").strip()
            if time_str not in ("12:30", "13:30"):
                continue
            date_str = r.get("date", "").strip()
            if not (DATE_FROM <= date_str <= DATE_TO):
                continue
            try:
                hh, mm = time_str.split(":")
                naive_utc = datetime(
                    int(date_str[:4]), int(date_str[5:7]), int(date_str[8:10]),
                    int(hh), int(mm), tzinfo=timezone.utc,
                )
            except Exception:
                continue
            et_dt = naive_utc.astimezone(ET)
            if et_dt.time() != time(8, 30):
                continue
            label = classify(r["event"].strip())
            if label != "NFP":
                continue
            key = (date_str, time_str)
            if key in by_key:
                continue
            by_key[key] = {
                "date": date_str,
                "t0_utc": int(naive_utc.timestamp()),
                "et_date": et_dt.strftime("%Y-%m-%d"),
                "event_type": label,
                "event_raw": r["event"].strip(),
            }
    out = sorted(by_key.values(), key=lambda x: x["t0_utc"])
    print(f"[load] {len(out)} NFP events in {DATE_FROM}..{DATE_TO}", file=sys.stderr)
    return out


def process_event(ev: dict, bars_idx: dict[int, dict]) -> dict:
    t0 = ev["t0_utc"]
    et_date = ev["et_date"]
    out = {
        "date": ev["date"],
        "et_date": et_date,
        "event_type": ev["event_type"],
        "t0_utc": t0,
        "year": et_date[:4],
    }
    pre_bars = []
    for i in range(PRE_LOOKBACK_MIN, 0, -1):
        b = bars_idx.get(t0 - i * 60)
        if b is not None:
            pre_bars.append(b)
    if len(pre_bars) < 3:
        out["result"] = "SKIP_NO_PRE"; return out
    pre_high = max(b["high"] for b in pre_bars)
    pre_low = min(b["low"] for b in pre_bars)
    out["pre_high"] = pre_high
    out["pre_low"] = pre_low

    deadline_et = datetime.combine(
        datetime.strptime(et_date, "%Y-%m-%d").date(),
        time(TIMEOUT_SWEEP_HOUR_ET, 0),
        tzinfo=ET,
    )
    sweep_deadline_ts = int(deadline_et.timestamp())
    resolve_deadline_ts = int(deadline_et.replace(hour=TIMEOUT_RESOLVE_HOUR_ET).timestamp())

    sweep_dir = None
    sweep_price = None
    sweep_ts = None
    cur = t0
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
                sweep_dir, sweep_price, sweep_ts = "UP", b["high"], cur
                break
            if dn:
                sweep_dir, sweep_price, sweep_ts = "DOWN", b["low"], cur
                break
        cur += 60
    if sweep_dir is None:
        out["result"] = "SKIP_NO_SWEEP"; return out
    out["sweep_dir"] = sweep_dir
    out["sweep_price"] = sweep_price
    out["sweep_minute_off"] = (sweep_ts - t0) // 60

    side = "SHORT" if sweep_dir == "UP" else "LONG"
    out["side"] = side
    sl = sweep_price + TICK if sweep_dir == "UP" else sweep_price - TICK
    tp = pre_low if sweep_dir == "UP" else pre_high
    out["sl"] = sl
    out["tp"] = tp

    scan_bars = []
    cur = sweep_ts
    while cur <= resolve_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            scan_bars.append({"ts": cur, **b})
        cur += 60
    if len(scan_bars) < 3:
        out["result"] = "SKIP_NO_SCAN_BARS"; return out

    pending_fvgs: list[dict] = []
    entry_ts = None
    entry_price = None
    ifvg_zone = None
    for n, bar in enumerate(scan_bars):
        for fvg in pending_fvgs:
            if sweep_dir == "UP":
                if bar["close"] < fvg["break_level"]:
                    entry_ts = bar["ts"]
                    entry_price = bar["close"]
                    ifvg_zone = (fvg["zone_low"], fvg["zone_high"])
                    break
            else:
                if bar["close"] > fvg["break_level"]:
                    entry_ts = bar["ts"]
                    entry_price = bar["close"]
                    ifvg_zone = (fvg["zone_low"], fvg["zone_high"])
                    break
        if entry_ts is not None:
            break
        if n >= 2:
            a = scan_bars[n - 2]; b_ = scan_bars[n - 1]; c = scan_bars[n]
            if (b_["ts"] - a["ts"] == 60) and (c["ts"] - b_["ts"] == 60):
                fvg = find_3bar_fvg(a, b_, c, sweep_dir)
                if fvg is not None:
                    pending_fvgs.append(fvg)

    if entry_ts is None:
        out["result"] = "SKIP_NO_IFVG"; return out

    if side == "SHORT":
        if entry_price >= sl or entry_price <= tp:
            out["result"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out
    else:
        if entry_price <= sl or entry_price >= tp:
            out["result"] = "SKIP_ENTRY_OUT_OF_RANGE"; return out

    out["entry_ts"] = entry_ts
    out["entry_price"] = entry_price
    out["ifvg_zone_low"] = ifvg_zone[0]
    out["ifvg_zone_high"] = ifvg_zone[1]
    out["entry_minute_off"] = (entry_ts - t0) // 60
    out["risk_pts"] = abs(entry_price - sl)
    out["reward_pts"] = abs(entry_price - tp)
    out["rr_planned"] = out["reward_pts"] / out["risk_pts"] if out["risk_pts"] > 0 else None

    # BE config: arm when MFE >= 50% of TP distance.
    be_threshold = 0.5 * abs(tp - entry_price)
    be_active = False
    out["be_threshold"] = round(be_threshold, 2)

    cur = entry_ts + 60
    mfe = 0.0
    mae = 0.0
    exit_ts = None
    exit_price = None
    result = None
    while cur <= resolve_deadline_ts:
        b = bars_idx.get(cur)
        if b is not None:
            if side == "SHORT":
                fav = entry_price - b["low"]
                adv = b["high"] - entry_price
                if fav > mfe: mfe = fav
                if adv > mae: mae = adv
                hit_sl = b["high"] >= sl
                hit_tp = b["low"] <= tp
                hit_be = be_active and (b["high"] >= entry_price)
                # SL takes priority over BE retest on same bar (worst-case honest).
                if hit_sl and hit_tp:
                    result, exit_price = "LOSS", sl
                elif hit_sl:
                    result, exit_price = "LOSS", sl
                elif hit_tp:
                    result, exit_price = "WIN", tp
                elif hit_be:
                    result, exit_price = RESULT_BE, entry_price
                # If not yet armed, check if THIS bar arms BE (after exit checks above
                # since SL/TP/BE evaluated for current bar with prior arm state).
                if result is None and not be_active and mfe >= be_threshold:
                    be_active = True
            else:
                fav = b["high"] - entry_price
                adv = entry_price - b["low"]
                if fav > mfe: mfe = fav
                if adv > mae: mae = adv
                hit_sl = b["low"] <= sl
                hit_tp = b["high"] >= tp
                hit_be = be_active and (b["low"] <= entry_price)
                if hit_sl and hit_tp:
                    result, exit_price = "LOSS", sl
                elif hit_sl:
                    result, exit_price = "LOSS", sl
                elif hit_tp:
                    result, exit_price = "WIN", tp
                elif hit_be:
                    result, exit_price = RESULT_BE, entry_price
                if result is None and not be_active and mfe >= be_threshold:
                    be_active = True
            if result is not None:
                exit_ts = cur
                break
        cur += 60
    if result is None:
        last = scan_bars_last_close(bars_idx, resolve_deadline_ts, entry_ts)
        if last is None:
            out["result"] = "SKIP_NO_RESOLVE"; return out
        exit_ts, exit_price = last
        result = "TIMEOUT"

    if result == RESULT_BE:
        pts = 0.0
    else:
        pts = (entry_price - exit_price) if side == "SHORT" else (exit_price - entry_price)
    out["exit_ts"] = exit_ts
    out["exit_price"] = exit_price
    out["result"] = result
    out["pts"] = round(pts, 2)
    out["mfe_pts"] = round(mfe, 2)
    out["mae_pts"] = round(mae, 2)
    out["be_active_at_exit"] = be_active
    out["duration_min"] = (exit_ts - entry_ts) // 60
    return out


def aggregate(events: list[dict]) -> dict:
    res = defaultdict(int)
    pts_win = pts_loss = pts_be = pts_to = 0.0
    wins_pts: list[float] = []
    losses_pts: list[float] = []
    for e in events:
        r = e.get("result", "?")
        res[r] += 1
        if r == "WIN":
            pts_win += e["pts"]; wins_pts.append(e["pts"])
        elif r == "LOSS":
            pts_loss += e["pts"]; losses_pts.append(e["pts"])
        elif r == RESULT_BE:
            pts_be += e["pts"]
        elif r == "TIMEOUT":
            pts_to += e["pts"]

    n_total = sum(res.values())
    n_traded = res["WIN"] + res["LOSS"] + res[RESULT_BE] + res["TIMEOUT"]
    n_skip = (
        res["SKIP_NO_PRE"] + res["SKIP_NO_SWEEP"] + res["SKIP_NO_IFVG"]
        + res["SKIP_ENTRY_OUT_OF_RANGE"] + res["SKIP_NO_SCAN_BARS"] + res["SKIP_NO_RESOLVE"]
    )
    pf = pts_win / abs(pts_loss) if pts_loss < 0 else (float("inf") if pts_win > 0 else 0)
    wl_total = res["WIN"] + res["LOSS"]
    return {
        "n_total": n_total,
        "n_traded": n_traded,
        "wins": res["WIN"],
        "losses": res["LOSS"],
        "be": res[RESULT_BE],
        "timeouts": res["TIMEOUT"],
        "skips": n_skip,
        "skip_no_pre": res["SKIP_NO_PRE"],
        "skip_no_sweep": res["SKIP_NO_SWEEP"],
        "skip_no_ifvg": res["SKIP_NO_IFVG"],
        "skip_entry_oor": res["SKIP_ENTRY_OUT_OF_RANGE"],
        "skip_no_scan": res["SKIP_NO_SCAN_BARS"],
        "skip_no_resolve": res["SKIP_NO_RESOLVE"],
        "wr": (res["WIN"] / wl_total) if wl_total else 0,
        "wr_inc_be": (res["WIN"] / n_traded) if n_traded else 0,
        "pf": round(pf, 3) if pf != float("inf") else "inf",
        "total_pts": round(pts_win + pts_loss + pts_be + pts_to, 2),
        "avg_win": round(pts_win / res["WIN"], 2) if res["WIN"] else 0,
        "avg_loss": round(pts_loss / res["LOSS"], 2) if res["LOSS"] else 0,
        "pts_win_sum": round(pts_win, 2),
        "pts_loss_sum": round(pts_loss, 2),
        "pts_be_sum": round(pts_be, 2),
        "pts_timeout_sum": round(pts_to, 2),
    }


def main():
    events = load_nfp_events()
    print(f"[main] loading {SYMBOL} 1m bars {DATE_FROM}..{DATE_TO}...", file=sys.stderr)
    bars_raw = load_bars(SYMBOL, DATE_FROM, DATE_TO)
    if hasattr(bars_raw, "iter_rows"):
        bars_idx = {int(r["ts"]): {k: r[k] for k in ("open","high","low","close")} for r in bars_raw.iter_rows(named=True)}
    else:
        bars_idx = {int(r["ts"]): {k: r[k] for k in ("open","high","low","close")} for r in bars_raw}
    print(f"[main] {len(bars_idx)} 1m bars indexed", file=sys.stderr)

    results = [process_event(ev, bars_idx) for ev in events]
    summary = aggregate(results)

    by_year = {}
    for yr in sorted(set(r["year"] for r in results)):
        sub = [r for r in results if r["year"] == yr]
        by_year[yr] = aggregate(sub)

    out = {
        "params": {
            "tick_size": TICK,
            "pre_lookback_min": PRE_LOOKBACK_MIN,
            "timeout_sweep_et": TIMEOUT_SWEEP_HOUR_ET,
            "timeout_resolve_et": TIMEOUT_RESOLVE_HOUR_ET,
            "date_from": DATE_FROM,
            "date_to": DATE_TO,
            "event_filter": "NFP",
            "be_rule": "MFE>=50% TP-dist arms BE; bar touching entry exits flat (SL priority on same bar)",
        },
        "summary": summary,
        "by_year": by_year,
        "events": results,
    }
    out_path = "results/nfp_be50.json"
    os.makedirs("results", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"[done] wrote {out_path}", file=sys.stderr)
    print(json.dumps(summary, indent=2))
    print("\n=== BY YEAR ===")
    print(f"{'Year':>6} {'n':>4} {'W':>3} {'L':>3} {'BE':>3} {'T':>3} {'Skip':>4} {'WR':>7} {'PF':>7} {'TotPts':>9}")
    for yr, s in by_year.items():
        pf_s = f"{s['pf']:>7}" if isinstance(s['pf'], str) else f"{s['pf']:>7.2f}"
        print(f"{yr:>6} {s['n_total']:>4} {s['wins']:>3} {s['losses']:>3} {s['be']:>3} {s['timeouts']:>3} "
              f"{s['skips']:>4} {s['wr']:>7.2%} {pf_s} {s['total_pts']:>+9.1f}")


if __name__ == "__main__":
    main()

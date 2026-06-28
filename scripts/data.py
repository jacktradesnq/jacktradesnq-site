import os
import time
import argparse
import polars as pl
from datetime import datetime
from zoneinfo import ZoneInfo

DATA_PATH = os.environ.get("DATA_PATH") or os.path.expanduser("~/backtesting/ict/data")

FILE_MANIFEST = {
    "NQ": [
        {"file": "NQ_1m_6y_part1.parquet", "from": "2016-04-19", "to": "2018-04-20"},
        {"file": "NQ_1m_6y_part2.parquet", "from": "2018-04-19", "to": "2020-04-20"},
        {"file": "NQ_1m_6y_part3.parquet", "from": "2020-04-19", "to": "2022-04-20"},
        {"file": "NQ_1m_2y_older.parquet", "from": "2022-04-20", "to": "2024-04-20"},
        {"file": "NQ_1m_2y.parquet", "from": "2024-04-21", "to": "2026-12-31"},
    ],
    "ES": [
        {"file": "ES_1m_6y_part1.parquet", "from": "2016-04-19", "to": "2018-04-20"},
        {"file": "ES_1m_6y_part2.parquet", "from": "2018-04-19", "to": "2020-04-20"},
        {"file": "ES_1m_6y_part3.parquet", "from": "2020-04-19", "to": "2022-04-20"},
        {"file": "ES_1m_2y_older.parquet", "from": "2022-04-20", "to": "2024-04-20"},
        {"file": "ES_1m_2y.parquet", "from": "2024-04-21", "to": "2026-12-31"},
    ],
    "MNQ": [
        {"file": "MNQ_1m_full.parquet", "from": "2019-05-05", "to": "2026-12-31"},
    ],
}

# MNQ kept as its own first-class symbol now that we have native MNQ bars.
# MES still aliases to ES (no native MES parquet yet).
SYMBOL_MAP = {"MES": "ES"}


def load_bars(symbol: str, from_date: str, to_date: str | None = None) -> list[dict]:
    base = SYMBOL_MAP.get(symbol.upper(), symbol.upper())
    if base not in FILE_MANIFEST:
        raise ValueError(f"invalid symbol: {symbol} (must be NQ, ES, MNQ, or MES)")

    from_dt = datetime.strptime(from_date, "%Y-%m-%d")
    to_dt = datetime.strptime(to_date, "%Y-%m-%d") if to_date else None

    manifest_files = []
    for entry in FILE_MANIFEST[base]:
        entry_from = datetime.strptime(entry["from"], "%Y-%m-%d")
        entry_to = datetime.strptime(entry["to"], "%Y-%m-%d")
        if entry_from <= (to_dt or datetime(2026, 12, 31)) and entry_to >= from_dt:
            manifest_files.append(entry)

    if not manifest_files:
        return []

    frames = []
    for entry in manifest_files:
        fpath = os.path.join(DATA_PATH, entry["file"])
        df = pl.read_parquet(fpath, columns=["ts", "open", "high", "low", "close", "volume"])

        t0 = datetime(from_dt.year, from_dt.month, from_dt.day, tzinfo=ZoneInfo("America/New_York"))
        mask = pl.col("ts") >= t0
        if to_dt:
            t1 = datetime(to_dt.year, to_dt.month, to_dt.day, 23, 59, 59, tzinfo=ZoneInfo("America/New_York"))
            mask = mask & (pl.col("ts") <= t1)
        df = df.filter(mask)
        frames.append(df)

    if not frames:
        return []

    # `vertical_relaxed` coerces a mismatched column dtype to the common supertype
    # (NQ_1m_2y.parquet has volume=Float64, the older fragments UInt64) so the
    # cross-fragment concat doesn't raise a SchemaError. Values are unchanged.
    result = pl.concat(frames, how="vertical_relaxed").with_columns(
        pl.col("ts").dt.epoch("s").cast(pl.Int64).alias("ts")
    )

    return result.to_dicts()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--from", dest="from_date", required=True)
    parser.add_argument("--to", default=None)
    args = parser.parse_args()

    t0 = time.time()
    bars = load_bars(args.symbol, args.from_date, args.to)
    elapsed = time.time() - t0

    n = len(bars)
    first_ts = bars[0]["ts"] if bars else "N/A"
    last_ts = bars[-1]["ts"] if bars else "N/A"
    print(f"{n} bars loaded in {elapsed:.2f}s, first={first_ts}, last={last_ts}")

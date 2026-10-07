import fs from 'fs';
import path from 'path';

import type { TradeRow } from './strategy-stats';

const dataDir = path.join(process.cwd(), 'public', 'data');

// ── Straddle trades, all combos (for the 5-asset straddle explorer) ──────────

interface StraddleTrade {
  date: string;
  ts: string;
  entry_price: number;
  X: number;
  Y: number;
  buy_stop: number;
  sell_stop: number;
  tp_buy: number;
  tp_sell: number;
  filled_side: string | null;
  fill_ts: string | null;
  fill_price: number | null;
  exit_ts: string | null;
  exit_price: number | null;
  pnl: number;
  outcome: string;
}

interface StraddleTradesJson {
  event: string;
  generated_at: string;
  combos: Array<{
    X: number;
    Y: number;
    trades: StraddleTrade[];
  }>;
}

export function getStraddleAllTrades(slug: string, asset: string): TradeRow[] {
  const dataKey = slug === 'cpi-day-stats' ? 'cpi' : slug;
  const suffix = asset === 'nq' ? '' : `-${asset}`;
  const fp = path.join(dataDir, `${dataKey}-straddle-trades${suffix}.json`);
  if (!fs.existsSync(fp)) return [];

  let json: StraddleTradesJson;
  try {
    json = JSON.parse(fs.readFileSync(fp, 'utf-8')) as StraddleTradesJson;
  } catch {
    return [];
  }

  const allTrades: TradeRow[] = [];
  for (const combo of json.combos) {
    for (const t of combo.trades) {
      if (!t.filled_side) continue;
      const ts = t.fill_ts || t.ts;
      const tpPrice = t.filled_side === 'long' ? t.tp_buy : t.filled_side === 'short' ? t.tp_sell : undefined;
      allTrades.push({
        ts,
        year: new Date(t.ts).getUTCFullYear(),
        side: t.filled_side,
        pnl_pts: Math.round(t.pnl * 100) / 100,
        outcome: (() => {
          const o = t.outcome ?? '';
          if (o === 'tp_hit') return 'win';
          if (o === 'sl_hit') return 'loss';
          if (o.startsWith('expired')) return t.pnl > 0 ? 'win' : t.pnl < 0 ? 'expired' : 'flat';
          return o;
        })(),
        x_stop: combo.X,
        y_tp: combo.Y,
        entry_price: t.fill_price ?? t.entry_price,
        sl_price: undefined,
        tp_price: tpPrice,
        entry_ts: t.fill_ts || undefined,
        exit_ts: t.exit_ts || undefined,
        exit_price: t.exit_price ?? undefined,
      });
    }
  }

  return allTrades.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

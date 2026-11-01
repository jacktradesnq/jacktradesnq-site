// The comparator's columns, one list per family. Angelo, 01/11/2026: the columns of
// PropFirmMatch's challenge pages, without Popularity, Loyalty pts and ROI Index; futures and
// perps in two tables, each its own columns. The perps list was read on
// propfirmmatch.com/perpetuals/prop-firm-challenges on 01/11/2026: Firm, Account size, Steps,
// Pairs count, Leverage (BTC+ETH), Profit target, Daily loss, Max loss, Max loss type, PT:DD,
// Profit split, Payout freq., Price. PT:DD left out (Angelo, 01/11/2026: « flemme de le mettre retire »). Plus, on every row, the date the firm was last checked.
//
// Firm, Price and the link are drawn by ComparePanel itself; every other column reads
// row.cells[id]. A column no plan has a value for is left out, the way /prop-firms drops a
// rule nobody has (CLAUDE.md, Angelo 21/10/2026: « pourquoi mettre un truc qui n'existe pas ? »).

import type { Family } from '../firm-view';

export type Column = {
  id: string;
  label: string;
  // Firm and Price are always shown: Customize does not list them.
  fixed?: boolean;
  // Text sits left, figures centre.
  align?: 'left';
};

const FIRM: Column = { id: 'firm', label: 'Firm', fixed: true, align: 'left' };
const PRICE: Column = { id: 'price', label: 'Price', fixed: true };
const CHECKED: Column = { id: 'checked', label: 'Last checked' };

export const COLUMNS: Record<Family, Column[]> = {
  futures: [
    FIRM,
    { id: 'size', label: 'Account size' },
    { id: 'steps', label: 'Steps' },
    { id: 'activation', label: 'Activation fee' },
    { id: 'contracts', label: 'Max contracts' },
    { id: 'target', label: 'Profit target' },
    { id: 'maxLoss', label: 'Max loss' },
    { id: 'lossType', label: 'Max loss type' },
    { id: 'split', label: 'Profit split' },
    { id: 'maxPayout', label: 'Max payout' },
    { id: 'minPayout', label: 'Min payout' },
    { id: 'consistency', label: 'Consistency (eval / funded)' },
    { id: 'payoutFreq', label: 'Payout frequency' },
    PRICE,
    CHECKED,
  ],
  perps: [
    FIRM,
    { id: 'size', label: 'Account size' },
    { id: 'steps', label: 'Steps' },
    { id: 'pairs', label: 'Pairs count' },
    { id: 'leverage', label: 'Leverage' },
    { id: 'target', label: 'Profit target' },
    { id: 'dailyLoss', label: 'Daily loss' },
    { id: 'maxLoss', label: 'Max loss' },
    { id: 'lossType', label: 'Max loss type' },
    { id: 'split', label: 'Profit split' },
    { id: 'payoutFreq', label: 'Payout frequency' },
    PRICE,
    CHECKED,
  ],
};

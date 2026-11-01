// The comparator's words, one function per column (Angelo, 01/11/2026: « je préfère que les mêmes
// appellations soient le même mot », for the whole comparator). The data keeps each firm's own
// words; the cell shows one shared format per meaning, and the firm's whole sentence stays on
// hover (`title`) wherever the cell drops part of it. Two different rules never share a word.
// app/prop-firms/firm-view.ts (cellVal) turns these into cells, for futures and perps alike.

import { firstNumber } from './compare-order.mjs';

/** @typedef {{ text: string; title?: string }} Words */

/**
 * @param {string} raw
 * @param {string} text
 * @returns {Words}
 */
const keep = (raw, text) => (text === raw ? { text } : { text, title: raw });

// ---------------------------------------------------------------------------------------------
// A sentence that lists one value per account size, the sizes written at its end by the firm:
// « $250 / $500 / $1,000 / $1,500 (25K / 50K / 100K / 150K) ». A row is one size, so it shows
// its own value (the 50K row: « $500 »). Only when the firm writes the sizes and every list in
// the sentence has exactly one value per size; otherwise the sentence stays whole (never a
// guessed match). Lists of dollar amounts only: « $100 / $150 / $200 / $250 » with no sizes
// written after it stays as is.

const SIZES_AT_END = /\s*\((\d+K(?: \/ \d+K)+)\)$/;
const MONEY_LIST = /\$\d[\d,]*(?: \/ \$\d[\d,]*)+/g;

/**
 * @param {string} raw
 * @param {number} size  account size in dollars (50000)
 * @returns {string}  the sentence with each list cut to the value of `size`, or `raw` untouched
 */
export function valueForSize(raw, size) {
  const m = SIZES_AT_END.exec(raw);
  if (!m) return raw;
  const sizes = m[1].split(' / ').map((s) => Number(s.slice(0, -1)) * 1000);
  const at = sizes.indexOf(size);
  if (at < 0) return raw;
  const body = raw.slice(0, m.index);
  const lists = body.match(MONEY_LIST) ?? [];
  if (!lists.length || lists.some((l) => l.split(' / ').length !== sizes.length)) return raw;
  return body.replace(MONEY_LIST, (l) => l.split(' / ')[at]);
}

// « $1,000 / 1,000 / 1,250 / 1,250 » (E8's caps by payout) -> the $ on every amount. Only a cell
// that is nothing but that list (« … to you at 60 / 80 / 90% » is not money).
const dollarsEverywhere = (/** @type {string} */ t) =>
  /^\$\d[\d,]*(?: \/ \$?\d[\d,]*)+$/.test(t) ? t.replace(/ \/ (?=\d)/g, ' / $') : t;

// One cap per payout (E8: « $1,250 / $1,250 / $2,000 / $2,000 », its row « Payout caps 1 / 2 / 3 /
// 4 ») written as Lucid and Tradeify write theirs, « Payout 1: $2,000; Payout 2+: $2,500 » (Angelo,
// 01/11/2026, « ok » to one format for both): equal caps next to each other grouped,
// « Payouts 1-2: $1,250; Payouts 3-4: $2,000 ».
function capsByPayout(/** @type {string} */ t) {
  if (!/^\$\d[\d,]*(?: \/ \$\d[\d,]*)+$/.test(t)) return t;
  const caps = t.split(' / ');
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < caps.length; ) {
    let j = i;
    while (j + 1 < caps.length && caps[j + 1] === caps[i]) j++;
    out.push(i === j ? `Payout ${i + 1}: ${caps[i]}` : `Payouts ${i + 1}-${j + 1}: ${caps[i]}`);
    i = j + 1;
  }
  return out.join('; ');
}

/**
 * Max payout and Min payout: the row's own size, the $ on every amount, and a cap counted over
 * a rolling 7 days said the same way everywhere (BluSky: « $2,500 in any 7 days », the Instant
 * accounts' own words, also for the caps read in its « Payout cap, rolling 7 days » table).
 * @param {string} raw
 * @param {number} size
 * @param {string} [label]  where the value was read (a funded rules row), shown on hover
 * @returns {Words}
 */
export function payoutWords(raw, size, label) {
  // « 50% of profit up to $2,500 » (Tradeify Select Flex) written as Lucid Flex's « 50% of profit, up to $2,000 ».
  let text = dollarsEverywhere(valueForSize(raw, size)).replace(/(\d+% of profit) up to\b/g, '$1, up to');
  if (label && /^Payout caps 1 \/ 2\b/.test(label)) text = capsByPayout(text);
  if (label && /rolling 7 days/i.test(label) && !/7 days/.test(text)) text = `${text} in any 7 days`;
  if (label) return { text, title: label };
  return keep(raw, text);
}

// ---------------------------------------------------------------------------------------------

/**
 * Max contracts: « X minis or Y micros » (« 1 mini »), whether the firm writes « or » or « / ».
 * « 5 micros » alone stays.
 * @param {string} raw
 * @returns {Words}
 */
export function contractsWords(raw) {
  const m = /^(\d+) minis? (?:\/|or) (\d+) micros?$/i.exec(raw.trim());
  if (!m) return { text: raw };
  const n = Number(m[1]);
  const u = Number(m[2]);
  return { text: `${n} mini${n === 1 ? '' : 's'} or ${u} micro${u === 1 ? '' : 's'}` };
}

/**
 * Profit split: the main split, then what the account is also sold at, in brackets: « 80% (90%
 * option) ». Vest writes « 80% / 90% » for the same thing (its 1-Step is sold at 80% or, dearer,
 * at 90%: the second price of the row). E8 One « 80% / 90% / 100% »: « 80% (90%, 100% option) ».
 * @param {string} raw
 * @returns {Words}
 */
export function splitWords(raw) {
  const parts = raw.trim().split(' / ');
  if (parts.length < 2 || !parts.every((x) => /^\d+%$/.test(x))) return { text: raw };
  return { text: `${parts[0]} (${parts.slice(1).join(', ')} option)` };
}

/**
 * Daily loss of a plan sold with and without one: the limits first, « or none » last: « 3% or
 * none » (MFP Elite, written « None / 3% »), « 3%, 4% or none » (Vest 1-Step).
 * @param {string} raw
 * @returns {Words}
 */
export function dailyLossWords(raw) {
  const parts = raw.split(/\s*(?:\/|,|\bor\b)\s*/i).filter(Boolean);
  const none = parts.some((x) => /^none$/i.test(x));
  const some = parts.filter((x) => !/^none$/i.test(x));
  if (!none || !some.length) return { text: raw };
  return { text: `${some.join(', ')} or none` };
}

/**
 * Consistency: a bare percentage, « best day » dropped (every consistency rule of the comparator
 * is the best day's share of the profit), kept on hover.
 * @param {string} raw
 * @returns {Words}
 */
export function consistencyWords(raw) {
  return keep(raw, raw.replace(/(\d+%) best day\b/gi, '$1'));
}

// Payout frequency, one word per meaning (Angelo, 01/11/2026, on « Daily » next to « Every day »):
// « Daily » for once a day, « On demand » for any time, « N winning days » for N days above a
// minimum before each payout, « Every N days » for one payout every N days (Tradeify Lightning,
// its card « Payout Frequency 5 Days », no winning-day rule). A winning day of $100 (Tradeify) and
// a $100 minimum per day (Lucid) are written the same: « ($100 / … minimum per day) ». A long sentence (Lucid, Tradeify)
// only has its start rewritten, when it means the same thing; « 5 days to payout », a wait before
// the first payout, stays.
const PAYOUT_WORDS = /** @type {[RegExp, string][]} */ ([
  [/^(?:daily|every day|once (?:per|a) day)(?=$|[\s,;(])/i, 'Daily'],
  [/^(?:any ?time|on[- ]?demand)(?=$|[\s,;(])/i, 'On demand'],
  // Tradeify Growth « 5 Days (5 winning days of $100 / … ) », Lucid Flex « 5 profitable days per
  // cycle ($100 / … minimum per day) ».
  [/^(\d+) Days \(\1 winning days of ([^()]+)\)/i, '$1 winning days ($2 minimum per day)'],
  [/^(\d+) profitable days per cycle(?= \()/i, '$1 winning days'],
  [/^(\d+) days$/i, 'Every $1 days'],
]);

/**
 * @param {string} raw
 * @returns {Words}
 */
export function payoutFreqWords(raw) {
  const rule = PAYOUT_WORDS.find(([re]) => re.test(raw));
  let text = rule ? raw.replace(rule[0], rule[1]) : raw;
  // « Daily, from day one » / « Any time, no cap »: the condition after the comma goes to the hover.
  const cond = /^(Daily|On demand),/.exec(text);
  if (cond) text = cond[1];
  // The same words inside a sentence too: Lucid « On Demand Payouts », Tradeify Select « 5 days
  // (Select Flex, 5 winning days of $100 / … ) ».
  text = text
    .replace(/\bOn Demand Payouts\b/g, 'On demand payouts')
    .replace(/\bOn Demand\b/g, 'On demand')
    .replace(/\b(\d+) days \(([^,()]+), \1 winning days of ([^()]+)\)/gi, '$1 winning days ($2, $3 minimum per day)');
  return keep(raw, text);
}

/**
 * The figure a payout cell sorts by: its first dollar amount (« Payout 1: $2,000 » -> 2000),
 * else its first number.
 * @param {string} text
 * @returns {number | null}
 */
export function moneyFirst(text) {
  const m = /\$(\d[\d,]*(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1].replace(/,/g, '')) : firstNumber(text);
}

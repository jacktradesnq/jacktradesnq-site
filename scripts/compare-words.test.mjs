import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consistencyWords, contractsWords, dailyLossWords, moneyFirst, payoutFreqWords, payoutWords, splitWords, valueForSize,
} from '../lib/compare-words.mjs';

const text = (w) => w.text;

test('max contracts: one format, « X minis or Y micros », « 1 mini »', () => {
  assert.equal(text(contractsWords('2 minis / 20 micros')), '2 minis or 20 micros');
  assert.equal(text(contractsWords('5 minis or 50 micros')), '5 minis or 50 micros');
  assert.equal(text(contractsWords('1 mini / 10 micros')), '1 mini or 10 micros');
  assert.equal(text(contractsWords('2 minis or 25 micros')), '2 minis or 25 micros');
  assert.equal(text(contractsWords('5 micros')), '5 micros');
  assert.equal(contractsWords('2 minis / 20 micros').title, undefined);
});

test('a sentence listing every size: the row shows its own size', () => {
  const s = '$250 / $500 / $1,000 / $1,500 (25K / 50K / 100K / 150K)';
  assert.equal(valueForSize(s, 25000), '$250');
  assert.equal(valueForSize(s, 50000), '$500');
  assert.equal(valueForSize(s, 150000), '$1,500');
  // A size the firm did not write: whole sentence.
  assert.equal(valueForSize(s, 200000), s);
  assert.equal(
    valueForSize('Payout 1: $1,000 / $2,000 / $2,500 / $3,000; Payout 2+: $1,500 / $2,500 / $3,000 / $3,500 (25K / 50K / 100K / 150K)', 50000),
    'Payout 1: $2,000; Payout 2+: $2,500',
  );
  assert.equal(
    valueForSize('50% of profit, up to $1,000 / $2,000 / $2,500 / $3,000 per request (25K / 50K / 100K / 150K)', 100000),
    '50% of profit, up to $2,500 per request',
  );
  assert.equal(
    valueForSize(
      'Select Daily: $600 / $1,250 / $1,750 / $2,500 (up to 2x the profit since the last payout); Select Flex: 50% of profit up to $1,250 / $2,500 / $3,500 / $4,500 (25K / 50K / 100K / 150K)',
      25000,
    ),
    'Select Daily: $600 (up to 2x the profit since the last payout); Select Flex: 50% of profit up to $1,250',
  );
});

test('a sentence that cannot be cut safely stays whole', () => {
  // No sizes written by the firm.
  const lucidDaily = 'No per-request cap: any profit above the buffer (buffer = max loss + $100). Max daily profit $6,000 / $8,000 / $10,000 / $12,000 (reaching it moves the account live)';
  assert.equal(valueForSize(lucidDaily, 50000), lucidDaily);
  // A list that does not have one value per size.
  const odd = '$250 / $500 / $1,000 (25K / 50K / 100K / 150K)';
  assert.equal(valueForSize(odd, 50000), odd);
  // No list of amounts at all.
  assert.equal(valueForSize('$500', 50000), '$500');
});

test('max / min payout: caps per payout as « Payouts 1-2: … », the $ everywhere, the full sentence on hover, rolling 7 days said once', () => {
  assert.deepEqual(payoutWords('$1,000 / 1,000 / 1,250 / 1,250', 25000, 'Payout caps 1 / 2 / 3 / 4'), {
    text: 'Payouts 1-2: $1,000; Payouts 3-4: $1,250',
    title: 'Payout caps 1 / 2 / 3 / 4',
  });
  assert.equal(payoutWords('$1,000 / 1,250 / 1,250 / 2,000', 25000, 'Payout caps 1 / 2 / 3 / 4').text,
    'Payout 1: $1,000; Payouts 2-3: $1,250; Payout 4: $2,000');
  assert.deepEqual(payoutWords('$250 / $500 / $1,000 / $1,500 (25K / 50K / 100K / 150K)', 50000), {
    text: '$500',
    title: '$250 / $500 / $1,000 / $1,500 (25K / 50K / 100K / 150K)',
  });
  assert.deepEqual(payoutWords('$2,500', 50000, 'Payout cap, rolling 7 days'), {
    text: '$2,500 in any 7 days',
    title: 'Payout cap, rolling 7 days',
  });
  assert.deepEqual(payoutWords('$3,000 in any 7 days', 3500), { text: '$3,000 in any 7 days' });
  // Not money: untouched.
  const tl = '$200 profit before your split ($120 / $160 / $180 to you at 60 / 80 / 90%)';
  assert.deepEqual(payoutWords(tl, 50000), { text: tl });
  assert.deepEqual(payoutWords('$1,500', 25000, 'Payout cap'), { text: '$1,500', title: 'Payout cap' });
  assert.equal(
    payoutWords('Select Daily: $600 / $1,250 / $1,750 / $2,500 (up to 2x the profit since the last payout); Select Flex: 50% of profit up to $1,250 / $2,500 / $3,500 / $4,500 (25K / 50K / 100K / 150K)', 50000).text,
    'Select Daily: $1,250 (up to 2x the profit since the last payout); Select Flex: 50% of profit, up to $2,500',
  );
});

test('profit split: « 80% / 90% » is the 90% option', () => {
  assert.equal(text(splitWords('80% / 90%')), '80% (90% option)');
  assert.equal(text(splitWords('80% / 100%')), '80% (100% option)');
  assert.equal(text(splitWords('80% / 90% / 100%')), '80% (90%, 100% option)');
  assert.equal(text(splitWords('80% (90% option)')), '80% (90% option)');
  assert.equal(text(splitWords('50% for 30 trading days, then 80%')), '50% for 30 trading days, then 80%');
});

test('daily loss: limits first, « or none » last', () => {
  assert.equal(text(dailyLossWords('None / 3%')), '3% or none');
  assert.equal(text(dailyLossWords('3%, 4% or none')), '3%, 4% or none');
  assert.equal(text(dailyLossWords('3%')), '3%');
  assert.equal(text(dailyLossWords('None')), 'None');
});

test('consistency: a bare percentage, « best day » on hover', () => {
  assert.deepEqual(consistencyWords('None / 35% best day'), { text: 'None / 35%', title: 'None / 35% best day' });
  assert.deepEqual(consistencyWords('None / 35%'), { text: 'None / 35%' });
  assert.equal(text(consistencyWords('40% (50% with add-on) / None')), '40% (50% with add-on) / None');
});

test('payout frequency: one word per meaning, two meanings never share one', () => {
  assert.deepEqual(payoutFreqWords('Every day'), { text: 'Daily', title: 'Every day' });
  assert.deepEqual(payoutFreqWords('Once per day'), { text: 'Daily', title: 'Once per day' });
  assert.deepEqual(payoutFreqWords('Daily, from day one'), { text: 'Daily', title: 'Daily, from day one' });
  assert.equal(text(payoutFreqWords('On-demand')), 'On demand');
  assert.equal(text(payoutFreqWords('Any time, with no open position')), 'On demand');
  assert.deepEqual(payoutFreqWords('5 Days'), { text: 'Every 5 days', title: '5 Days' });
  assert.equal(text(payoutFreqWords('Every 3 trading days')), 'Every 3 trading days');
  assert.equal(
    text(payoutFreqWords('5 Days (5 winning days of $100 / $150 / $200 / $250)')),
    '5 winning days ($100 / $150 / $200 / $250 minimum per day)',
  );
  assert.equal(
    text(payoutFreqWords('Chosen after passing: Daily (Select Daily) or 5 days (Select Flex, 5 winning days of $100 / $150 / $200 / $250)')),
    'Chosen after passing: Daily (Select Daily) or 5 winning days (Select Flex, $100 / $150 / $200 / $250 minimum per day)',
  );
  assert.equal(
    text(payoutFreqWords('5 profitable days per cycle ($100 / $150 / $200 / $250 minimum per day); On Demand Payouts with the Daily Loss Limit ON')),
    '5 winning days ($100 / $150 / $200 / $250 minimum per day); On demand payouts with the Daily Loss Limit ON',
  );
  // A wait before the first payout keeps its words.
  assert.match(text(payoutFreqWords('5 days to payout; On Demand Payouts on 50K')), /^5 days to payout; On demand payouts/);
});

test('payout cells sort by their first dollar amount', () => {
  assert.equal(moneyFirst('Payout 1: $2,000; Payout 2+: $2,500'), 2000);
  assert.equal(moneyFirst('50% of profit, up to $2,500 per request'), 2500);
  assert.equal(moneyFirst('None'), null);
});

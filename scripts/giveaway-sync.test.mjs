import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNewGiveaways, endedGiveaways } from '../lib/giveaway-sync.mjs';

const bot = (timestamp, content) => ({ timestamp, content, author: { bot: true } });
const human = (timestamp, content) => ({ timestamp, content, author: { bot: false } });

// The formats seen in #giveaways, ids replaced.
const TL = bot('2026-12-01T16:40:00.000+00:00', 'Congratulations, <@1>, <@2>! You won **Traders Launch 100k 80% Profit split**!');
const TL_OUR_BOT = bot('2026-12-01T16:44:00.000+00:00', 'Congratulations, <@3>, <@4>! You won **Traders Launch 100k 80% Profit split**!');
const OLD_BOT = bot('2026-12-03T17:50:00.000+00:00', 'Congratulations <@5>! You won the **$25K Traders Launch Static Account (80% profit split)**!');
const OLD_REROLL = bot('2026-12-03T20:46:00.000+00:00', '<@9> rerolled the giveaway! Congratulations <@6>! [↗](https://discord.com/x)');
const PAST = [{ date: '2026-10-31', prize: 'Old one', winners: 1 }];
const CURSOR = '2026-10-31T23:59:59.000Z';

test('two bots announcing one giveaway make one giveaway, the first date, its winners counted', () => {
  assert.deepEqual(endedGiveaways([TL_OUR_BOT, TL]), [{ prize: 'Traders Launch 100k 80% Profit split', winners: 2, at: TL.timestamp }]);
});

test('a reroll, a human and a bot talking are not giveaways', () => {
  assert.deepEqual(endedGiveaways([OLD_REROLL, human(TL.timestamp, TL.content), bot(TL.timestamp, 'GIVEAWAY ENDED')]), []);
});

test('new giveaways go on top, the cursor moves, winners are never kept', () => {
  const r = addNewGiveaways(PAST, CURSOR, [OLD_BOT, TL, TL_OUR_BOT]);
  assert.equal(r.added, 2);
  assert.deepEqual(r.past, [
    { date: '2026-12-03', prize: '$25K Traders Launch Static Account (80% profit split)', winners: 1 },
    { date: '2026-12-01', prize: 'Traders Launch 100k 80% Profit split', winners: 2 },
    PAST[0],
  ]);
  assert.equal(r.cursor, OLD_BOT.timestamp);
  assert.doesNotMatch(JSON.stringify(r.past), /<@/);
});

test('reading twice adds nothing, a late announcement of a listed lot neither', () => {
  const once = addNewGiveaways(PAST, CURSOR, [TL]);
  assert.equal(addNewGiveaways(once.past, once.cursor, [TL]).added, 0);
  assert.equal(addNewGiveaways(once.past, once.cursor, [TL_OUR_BOT]).added, 0);
});

test('messages older than the cursor change nothing, the same lot weeks later is a new giveaway', () => {
  const r = addNewGiveaways(PAST, '2026-12-31T00:00:00.000Z', [TL, OLD_BOT]);
  assert.deepEqual(r, { past: PAST, cursor: '2026-12-31T00:00:00.000Z', added: 0 });
  const later = bot('2027-02-01T10:00:00.000+00:00', TL.content);
  const first = addNewGiveaways(PAST, CURSOR, [TL]);
  assert.equal(addNewGiveaways(first.past, first.cursor, [later]).added, 1);
});

test('an unreadable cursor is an error, not an empty answer', () => {
  assert.throws(() => addNewGiveaways(PAST, 'nope', [TL]), /curseur illisible/);
});

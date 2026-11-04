import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../content/giveaways/giveaways.json', import.meta.url), 'utf8'));

test('past giveaways: newest first, each with a date, a prize and its winners', () => {
  assert.ok(data.past.length > 0);
  data.past.forEach((g, i) => {
    assert.match(g.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(g.prize.trim());
    assert.ok(g.winners > 0);
    if (i) assert.ok(data.past[i - 1].date >= g.date);
  });
});

test('the page says how to enter and what a winner must do', () => {
  assert.equal(data.howToEnter.length, 3);
  assert.ok(data.ifYouWin.some((s) => s.includes('48 hours')));
  assert.match(data.discordUrl, /^https:\/\/discord\.gg\//);
});

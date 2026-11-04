import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discountWords } from '../lib/discount-words.mjs';

test('one rate for every plan is said plainly', () => {
  assert.equal(discountWords([20, 20.000000000000004, 19.9999]), '20% off');
});

test('different rates give the best one, with « Up to »', () => {
  assert.equal(discountWords([25, 34.6, 34.4]), 'Up to 35% off');
  assert.equal(discountWords([35, 30]), 'Up to 35% off');
});

test('no discount prints nothing', () => {
  assert.equal(discountWords([]), null);
  assert.equal(discountWords([null, undefined, 0]), null);
});

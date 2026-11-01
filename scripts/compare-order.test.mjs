import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultOrder, filterRows, firstNumber, sortBy } from '../lib/compare-order.mjs';

const rows = [
  { key: 'v50', firmName: 'Vest Markets', firmId: 'vest', size: 50000, steps: '1 Step', price: 400 },
  { key: 'b100', firmName: 'BluSky', firmId: 'blusky', size: 100000, steps: 'Evaluation', price: 59 },
  { key: 'b50', firmName: 'BluSky', firmId: 'blusky', size: 50000, steps: 'Evaluation', price: 49 },
  { key: 'b50i', firmName: 'BluSky', firmId: 'blusky', size: 50000, steps: 'Instant', price: null },
  { key: 'e25', firmName: 'E8 Markets', firmId: 'e8', size: 25000, steps: 'Evaluation', price: 90 },
];
const keys = (rs) => rs.map((r) => r.key);

test('default order: firm A to Z, then size, ties keep the source order', () => {
  assert.deepEqual(keys(defaultOrder(rows)), ['b50', 'b50i', 'b100', 'e25', 'v50']);
});

test('sorting a column never leaves the empty cells on top', () => {
  const ordered = defaultOrder(rows);
  assert.deepEqual(keys(sortBy(ordered, (r) => r.price, 'asc')), ['b50', 'b100', 'e25', 'v50', 'b50i']);
  assert.deepEqual(keys(sortBy(ordered, (r) => r.price, 'desc')), ['v50', 'e25', 'b100', 'b50', 'b50i']);
  assert.deepEqual(keys(sortBy(ordered, (r) => r.steps, 'asc')), ['v50', 'b50', 'b100', 'e25', 'b50i']);
});

test('filters: firm, size, steps, budget against the price shown', () => {
  const price = (r) => r.price;
  assert.deepEqual(keys(filterRows(rows, { firmId: 'blusky' }, price)), ['b100', 'b50', 'b50i']);
  assert.deepEqual(keys(filterRows(rows, { size: 50000 }, price)), ['v50', 'b50', 'b50i']);
  assert.deepEqual(keys(filterRows(rows, { steps: 'Instant' }, price)), ['b50i']);
  // A plan with no price (coming soon) is not "under budget".
  assert.deepEqual(keys(filterRows(rows, { maxPrice: 90 }, price)), ['b100', 'b50', 'e25']);
  assert.equal(filterRows(rows, { firmId: 'blusky', maxPrice: 10 }, price).length, 0);
});

test('firstNumber reads the figure a word cell starts with', () => {
  assert.equal(firstNumber('2 minis or 20 micros'), 2);
  assert.equal(firstNumber('$1,250 / 1,000'), 1250);
  assert.equal(firstNumber('40% / None'), 40);
  assert.equal(firstNumber('None'), null);
  assert.equal(firstNumber(undefined), null);
});

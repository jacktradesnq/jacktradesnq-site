// Run: node --test functions/_shared/subscribers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isEmail,
  normalizeEmail,
  makeToken,
  rateLimited,
  addPending,
  confirm,
  unsubscribe,
  listConfirmed,
  RATE_LIMIT_PER_DAY,
} from './subscribers.js';

import { fakeKv } from './test-kv.mjs';

const NOW = '2026-08-20T06:30:00.000Z';
let counter = 0;
const token = () => makeToken({ randomUUID: () => `0000000${counter++}-0000-0000-0000-000000000000` });

test('email validation accepts real addresses and rejects the usual junk', () => {
  for (const ok of ['a@b.co', 'Angelo+deals@Gmail.com', 'x.y@sub.domain.io']) {
    assert.ok(isEmail(ok), `rejected ${ok}`);
  }
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@@b.com', 'a@b..com', '.a@b.co', 'a@b.co.', 'a@b..com'.repeat(40)]) {
    assert.ok(!isEmail(bad), `accepted ${bad}`);
  }
  assert.equal(normalizeEmail('  Angelo@Gmail.COM '), 'angelo@gmail.com');
});

test('signing up twice while pending keeps the first confirmation link alive', async () => {
  const kv = fakeKv();
  const first = await addPending(kv, 'a@b.co', { now: NOW, token: token() });
  const second = await addPending(kv, 'a@b.co', { now: NOW, token: token() });
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'pending');
  assert.equal(second.token, first.token);
});

test('a pending signup is not on the send list until it confirms', async () => {
  const kv = fakeKv();
  const t = token();
  await addPending(kv, 'a@b.co', { now: NOW, token: t });
  assert.deepEqual(await listConfirmed(kv), []);

  const res = await confirm(kv, t, { now: NOW });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyConfirmed, false);
  assert.deepEqual(await listConfirmed(kv), [{ email: 'a@b.co', token: t }]);
});

test('confirming twice is harmless, and an unknown token is refused', async () => {
  const kv = fakeKv();
  const t = token();
  await addPending(kv, 'a@b.co', { now: NOW, token: t });
  await confirm(kv, t, { now: NOW });
  const again = await confirm(kv, t, { now: NOW });
  assert.equal(again.alreadyConfirmed, true);
  assert.equal((await confirm(kv, 'deadbeef', { now: NOW })).ok, false);
});

test('unsubscribe removes the record and the token, and cannot be replayed', async () => {
  const kv = fakeKv();
  const t = token();
  await addPending(kv, 'a@b.co', { now: NOW, token: t });
  await confirm(kv, t, { now: NOW });

  assert.equal((await unsubscribe(kv, t)).ok, true);
  assert.deepEqual(await listConfirmed(kv), []);
  assert.equal((await unsubscribe(kv, t)).ok, false);
});

test('an already confirmed address cannot be reset to pending by re-signing up', async () => {
  const kv = fakeKv();
  const t = token();
  await addPending(kv, 'a@b.co', { now: NOW, token: t });
  await confirm(kv, t, { now: NOW });
  const again = await addPending(kv, 'a@b.co', { now: NOW, token: token() });
  assert.equal(again.status, 'already');
  assert.equal((await listConfirmed(kv)).length, 1);
});

test('one IP cannot sign up the whole internet', async () => {
  const kv = fakeKv();
  for (let i = 0; i < RATE_LIMIT_PER_DAY; i++) {
    assert.equal(await rateLimited(kv, '1.2.3.4', '2026-08-20'), false, `blocked at ${i}`);
  }
  assert.equal(await rateLimited(kv, '1.2.3.4', '2026-08-20'), true);
  assert.equal(await rateLimited(kv, '1.2.3.4', '2026-08-21'), false, 'new day, new counter');
});

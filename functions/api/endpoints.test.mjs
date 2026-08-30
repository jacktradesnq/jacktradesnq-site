// End-to-end tests for the newsletter Pages Functions, with a fake KV and a
// stubbed fetch. No network call leaves this process: the stub records what
// would have been posted to Resend.
//
// Run: node --test functions/api/endpoints.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fakeKv } from '../_shared/test-kv.mjs';
import { onRequestPost as subscribe } from './subscribe.js';
import { onRequestGet as confirmGet } from './newsletter/confirm.js';
import { onRequestGet as unsubscribeGet } from './newsletter/unsubscribe.js';
import { onRequestPost as send } from './newsletter/send.js';

const realFetch = globalThis.fetch;
let calls = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'stub' }), { status: 200 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const envWith = (kv, extra = {}) => ({
  NEWSLETTER: kv,
  RESEND_API_KEY: 're_test',
  NEWSLETTER_FROM: 'JackTradesNQ <deals@jacktradesnq.com>',
  SITE_ORIGIN: 'https://jacktradesnq.com',
  NEWSLETTER_SEND_KEY: 'sendkey-0123456789',
  ...extra,
});

const post = (body, headers = {}) =>
  new Request('https://jacktradesnq.com/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });

// ── subscribe ────────────────────────────────────────────────────────────────

test('a bad address is refused and nothing is emailed', async () => {
  const kv = fakeKv();
  const res = await subscribe({ request: post({ email: 'nope' }), env: envWith(kv) });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
  assert.equal(kv.store.size, 0);
});

test('a signup is stored as pending and gets one confirmation email', async () => {
  const kv = fakeKv();
  const res = await subscribe({ request: post({ email: 'Trader@Gmail.com' }), env: envWith(kv) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: 'pending' });

  const record = JSON.parse(kv.store.get('sub:trader@gmail.com'));
  assert.equal(record.status, 'pending');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(calls[0].body.to, ['trader@gmail.com']);
  assert.match(calls[0].body.html, new RegExp(`confirm\\?t=${record.token}`));
});

test('a filled honeypot looks like success and stores nothing', async () => {
  const kv = fakeKv();
  const res = await subscribe({
    request: post({ email: 'bot@spam.io', company: 'Acme' }),
    env: envWith(kv),
  });
  assert.equal(res.status, 200);
  assert.equal(kv.store.size, 0);
  assert.equal(calls.length, 0);
});

test('an address already on the list gets the same answer and no second email', async () => {
  const kv = fakeKv();
  await subscribe({ request: post({ email: 'a@b.co' }), env: envWith(kv) });
  const token = JSON.parse(kv.store.get('sub:a@b.co')).token;
  await confirmGet({
    request: new Request(`https://jacktradesnq.com/api/newsletter/confirm?t=${token}`),
    env: envWith(kv),
  });
  calls = [];

  const res = await subscribe({ request: post({ email: 'a@b.co' }), env: envWith(kv) });
  assert.deepEqual(await res.json(), { ok: true, status: 'pending' }, 'must not leak membership');
  assert.equal(calls.length, 0, 'a confirmed address must not be re-emailed');
});

test('one IP hammering the form gets a 429', async () => {
  const kv = fakeKv();
  for (let i = 0; i < 5; i++) {
    const res = await subscribe({ request: post({ email: `a${i}@b.co` }), env: envWith(kv) });
    assert.equal(res.status, 200, `blocked too early at ${i}`);
  }
  const res = await subscribe({ request: post({ email: 'a6@b.co' }), env: envWith(kv) });
  assert.equal(res.status, 429);
});

// ── confirm / unsubscribe ────────────────────────────────────────────────────

test('the confirm link flips the record and a dead link says so', async () => {
  const kv = fakeKv();
  await subscribe({ request: post({ email: 'a@b.co' }), env: envWith(kv) });
  const token = JSON.parse(kv.store.get('sub:a@b.co')).token;

  const ok = await confirmGet({
    request: new Request(`https://jacktradesnq.com/api/newsletter/confirm?t=${token}`),
    env: envWith(kv),
  });
  assert.match(await ok.text(), /You are in/);
  assert.equal(JSON.parse(kv.store.get('sub:a@b.co')).status, 'confirmed');

  const dead = await confirmGet({
    request: new Request('https://jacktradesnq.com/api/newsletter/confirm?t=nope'),
    env: envWith(kv),
  });
  assert.match(await dead.text(), /dead/i);
});

test('unsubscribe empties the record, twice in a row is fine', async () => {
  const kv = fakeKv();
  await subscribe({ request: post({ email: 'a@b.co' }), env: envWith(kv) });
  const token = JSON.parse(kv.store.get('sub:a@b.co')).token;

  const res = await unsubscribeGet({
    request: new Request(`https://jacktradesnq.com/api/newsletter/unsubscribe?t=${token}`),
    env: envWith(kv),
  });
  assert.match(await res.text(), /You are out/);
  assert.equal(kv.store.get('sub:a@b.co'), undefined);

  const again = await unsubscribeGet({
    request: new Request(`https://jacktradesnq.com/api/newsletter/unsubscribe?t=${token}`),
    env: envWith(kv),
  });
  assert.equal(again.status, 200);
});

// ── send ─────────────────────────────────────────────────────────────────────

const sendReq = (body, key) =>
  new Request('https://jacktradesnq.com/api/newsletter/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-jtnq-key': key } : {}) },
    body: JSON.stringify(body),
  });

const CONTENT = {
  subject: 'FundedSeat: 50K Daily at $104.95',
  html: '<p>deal</p><a href="{{unsubscribe_url}}">out</a>',
  text: 'deal\nUnsubscribe: {{unsubscribe_url}}',
};

async function seedConfirmed(kv, email) {
  await subscribe({ request: post({ email }), env: envWith(kv) });
  const token = JSON.parse(kv.store.get(`sub:${email}`)).token;
  await confirmGet({
    request: new Request(`https://jacktradesnq.com/api/newsletter/confirm?t=${token}`),
    env: envWith(kv),
  });
  calls = [];
  return token;
}

test('no key, no send', async () => {
  const kv = fakeKv();
  const res = await send({ request: sendReq({ ...CONTENT, mode: 'send' }), env: envWith(kv) });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);

  const wrong = await send({
    request: sendReq({ ...CONTENT, mode: 'send' }, 'sendkey-9999999999'),
    env: envWith(kv),
  });
  assert.equal(wrong.status, 401);
  assert.equal(calls.length, 0);
});

test('anything other than mode:send is a dry run that mails nobody', async () => {
  const kv = fakeKv();
  await seedConfirmed(kv, 'a@b.co');

  for (const body of [CONTENT, { ...CONTENT, mode: 'preview' }, { ...CONTENT, mode: 'SEND' }]) {
    const res = await send({ request: sendReq(body, 'sendkey-0123456789'), env: envWith(kv) });
    assert.deepEqual(await res.json(), {
      ok: true,
      dryRun: true,
      recipients: 1,
      subject: CONTENT.subject,
    });
    assert.equal(calls.length, 0, `mode ${body.mode} actually sent`);
  }
});

test('content without an unsubscribe slot is refused', async () => {
  const kv = fakeKv();
  await seedConfirmed(kv, 'a@b.co');
  const res = await send({
    request: sendReq({ subject: 's', html: '<p>x</p>', text: 'x', mode: 'send' }, 'sendkey-0123456789'),
    env: envWith(kv),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'missing-unsubscribe-slot');
  assert.equal(calls.length, 0);
});

test('a real send goes only to confirmed addresses, each with its own opt-out', async () => {
  const kv = fakeKv();
  const tokenA = await seedConfirmed(kv, 'a@b.co');
  await subscribe({ request: post({ email: 'pending@b.co' }), env: envWith(kv) }); // never confirms
  calls = [];

  const res = await send({
    request: sendReq({ ...CONTENT, mode: 'send' }, 'sendkey-0123456789'),
    env: envWith(kv),
  });
  assert.deepEqual(await res.json(), { ok: true, sent: 1, recipients: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails/batch');

  const [message] = calls[0].body;
  assert.deepEqual(message.to, ['a@b.co']);
  const unsub = `https://jacktradesnq.com/api/newsletter/unsubscribe?t=${tokenA}`;
  assert.ok(message.html.includes(unsub), 'unsubscribe url not substituted');
  assert.ok(!message.html.includes('{{unsubscribe_url}}'), 'placeholder left in the html');
  assert.equal(message.headers['List-Unsubscribe'], `<${unsub}>`);
});

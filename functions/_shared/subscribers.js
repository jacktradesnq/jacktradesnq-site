// Subscriber storage for the daily deal newsletter.
//
// Backed by a Cloudflare KV namespace bound as env.NEWSLETTER. Keys:
//   sub:<email>      -> { email, status, token, createdAt, confirmedAt }
//   token:<token>    -> <email>            (confirm + unsubscribe lookups)
//   rate:<ip>:<day>  -> signup count       (expires on its own)
//
// Everything here is a plain function over a KV-shaped object so it can be
// tested without a Worker: see functions/_shared/subscribers.test.mjs.

export const RATE_LIMIT_PER_DAY = 5;
const RATE_TTL_S = 86400;

export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

// Deliberately strict but short: one @, a dotted domain, no spaces, and no
// empty label anywhere (".." or a leading/trailing dot).
export function isEmail(raw) {
  const email = normalizeEmail(raw);
  if (email.length < 6 || email.length > 254) return false;
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  return /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email);
}

export function makeToken(random = crypto) {
  return random.randomUUID().replace(/-/g, '');
}

export async function rateLimited(kv, ip, day) {
  if (!ip) return false;
  const key = `rate:${ip}:${day}`;
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= RATE_LIMIT_PER_DAY) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_TTL_S });
  return false;
}

// Returns { status, token } where status is 'created' | 'pending' | 'already'.
// A second signup while still pending hands back the SAME token, so the first
// confirmation link a subscriber received keeps working.
export async function addPending(kv, email, { now, token }) {
  const key = `sub:${email}`;
  const existing = JSON.parse((await kv.get(key)) ?? 'null');
  if (existing?.status === 'confirmed') return { status: 'already', token: existing.token };
  if (existing?.status === 'pending') return { status: 'pending', token: existing.token };

  const record = { email, status: 'pending', token, createdAt: now, confirmedAt: null };
  await kv.put(key, JSON.stringify(record));
  await kv.put(`token:${token}`, email);
  return { status: 'created', token };
}

export async function confirm(kv, token, { now }) {
  const email = await kv.get(`token:${token}`);
  if (!email) return { ok: false, reason: 'unknown-token' };
  const key = `sub:${email}`;
  const record = JSON.parse((await kv.get(key)) ?? 'null');
  if (!record) return { ok: false, reason: 'unknown-token' };
  if (record.status === 'confirmed') return { ok: true, email, alreadyConfirmed: true };

  await kv.put(key, JSON.stringify({ ...record, status: 'confirmed', confirmedAt: now }));
  return { ok: true, email, alreadyConfirmed: false };
}

export async function unsubscribe(kv, token) {
  const email = await kv.get(`token:${token}`);
  if (!email) return { ok: false, reason: 'unknown-token' };
  await kv.delete(`sub:${email}`);
  await kv.delete(`token:${token}`);
  return { ok: true, email };
}

// Confirmed subscribers only: a pending signup never gets a deal email.
export async function listConfirmed(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const record = JSON.parse((await kv.get(name)) ?? 'null');
      if (record?.status === 'confirmed') out.push({ email: record.email, token: record.token });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

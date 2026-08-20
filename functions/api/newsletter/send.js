// POST /api/newsletter/send
//   header  x-jtnq-key: <NEWSLETTER_SEND_KEY>
//   body    { subject, html, text, mode }
//
// The rendering lives in scripts/lib/deal-of-day.mjs and runs in the daily
// GitHub Action; this endpoint only fans the finished email out to confirmed
// subscribers, so the list never leaves Cloudflare.
//
// mode must be exactly "send" to actually send. Anything else (including a
// missing field) is a dry run that reports the recipient count and sends
// nothing: an accidental call cannot mail the list.

import { listConfirmed } from '../../_shared/subscribers.js';
import { sendBatch } from '../../_shared/resend.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Length-independent compare, so a wrong key cannot be found byte by byte.
function secretMatches(given, expected) {
  if (!expected || !given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!secretMatches(request.headers.get('x-jtnq-key') ?? '', env.NEWSLETTER_SEND_KEY ?? '')) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'bad-request' }, 400);
  }

  const { subject, html, text, mode } = payload ?? {};
  if (!subject || !html || !text) return json({ ok: false, error: 'missing-content' }, 400);
  if (!html.includes('{{unsubscribe_url}}') || !text.includes('{{unsubscribe_url}}')) {
    return json({ ok: false, error: 'missing-unsubscribe-slot' }, 400);
  }

  const subscribers = await listConfirmed(env.NEWSLETTER);
  if (mode !== 'send') {
    return json({ ok: true, dryRun: true, recipients: subscribers.length, subject });
  }
  if (subscribers.length === 0) return json({ ok: true, sent: 0, recipients: 0 });

  const origin = env.SITE_ORIGIN ?? new URL(request.url).origin;
  const messages = subscribers.map(({ email, token }) => {
    const unsub = `${origin}/api/newsletter/unsubscribe?t=${token}`;
    return {
      to: email,
      subject,
      html: html.replaceAll('{{unsubscribe_url}}', unsub),
      text: text.replaceAll('{{unsubscribe_url}}', unsub),
      headers: {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  });

  try {
    const sent = await sendBatch(env, messages);
    return json({ ok: true, sent: sent.length, recipients: subscribers.length });
  } catch (err) {
    return json({ ok: false, error: 'send-failed', detail: String(err).slice(0, 200) }, 502);
  }
}

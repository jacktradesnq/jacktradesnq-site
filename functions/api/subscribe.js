// POST /api/subscribe  { email }
//
// Double opt-in: the address is stored as pending and only a click on the
// emailed link puts it on the send list. Nothing is ever emailed to an address
// that did not confirm.
//
// Bindings expected on the Pages project:
//   NEWSLETTER          KV namespace
//   RESEND_API_KEY      secret
//   NEWSLETTER_FROM     e.g. "JackTradesNQ <deals@jacktradesnq.com>"
//   SITE_ORIGIN         e.g. "https://jacktradesnq.com"

import { isEmail, normalizeEmail, makeToken, addPending, rateLimited } from '../_shared/subscribers.js';
import { sendOne } from '../_shared/resend.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function confirmEmail(origin, token) {
  const url = `${origin}/api/newsletter/confirm?t=${token}`;
  return {
    subject: 'Confirm your daily prop firm deal',
    text: `One click and you are in: ${url}\n\nOne email a day at most, only when a firm actually drops its price. Unsubscribe is in every email.`,
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#02130C;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#071C13;border:1px solid #1C3329;border-radius:12px;">
      <tr><td style="padding:32px;font:500 16px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#839180;">
        <p style="margin:0 0 20px;font:400 10px ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#839180;">Almost done</p>
        <p style="margin:0 0 24px;font:italic 400 28px/1.15 Georgia,serif;color:#F3EFDC;">One click and you are in<span style="color:#E9B44B;">.</span></p>
        <p style="margin:0 0 28px;">You will get the day's prop firm deal: the price, the rules that matter, and the catch. One email a day at most, and only when a firm actually moves its price.</p>
        <a href="${url}" style="display:inline-block;background:#E9B44B;color:#02130C;font:700 16px 'Helvetica Neue',Helvetica,Arial,sans-serif;text-decoration:none;padding:14px 30px;border-radius:999px;">Confirm my email</a>
        <p style="margin:28px 0 0;font:400 13px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#839180;">If you did not ask for this, ignore this email and nothing happens.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let email = '';
  let honeypot = '';
  try {
    const type = request.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const body = await request.json();
      email = body?.email ?? '';
      honeypot = body?.company ?? '';
    } else {
      const form = await request.formData();
      email = form.get('email') ?? '';
      honeypot = form.get('company') ?? '';
    }
  } catch {
    return json({ ok: false, error: 'bad-request' }, 400);
  }

  // Bots fill every field they find; humans never see this one.
  if (String(honeypot).trim() !== '') return json({ ok: true, status: 'pending' });

  if (!isEmail(email)) return json({ ok: false, error: 'invalid-email' }, 400);
  email = normalizeEmail(email);

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  if (await rateLimited(env.NEWSLETTER, ip, day)) {
    return json({ ok: false, error: 'too-many-signups' }, 429);
  }

  const { status, token } = await addPending(env.NEWSLETTER, email, {
    now: new Date().toISOString(),
    token: makeToken(),
  });

  // Already confirmed: say the same thing either way, so this endpoint cannot
  // be used to test whether an address is on the list.
  if (status === 'already') return json({ ok: true, status: 'pending' });

  const origin = env.SITE_ORIGIN ?? new URL(request.url).origin;
  try {
    await sendOne(env, { to: email, ...confirmEmail(origin, token) });
  } catch (err) {
    return json({ ok: false, error: 'send-failed', detail: String(err).slice(0, 120) }, 502);
  }
  return json({ ok: true, status: 'pending' });
}

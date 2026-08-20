// Thin Resend client. Free tier: 3,000 emails a month, 100 a day, so the
// caller batches and the daily job stays inside that until the list outgrows it.
// Verified 2026-08-20 on https://resend.com/pricing.

const API = 'https://api.resend.com';
export const BATCH_MAX = 100;

export async function sendOne(env, { to, subject, html, text }) {
  const res = await fetch(`${API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.NEWSLETTER_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// One request per 100 recipients, each with its own body (the unsubscribe link
// differs per subscriber, so this is not a single mail to a big to: list).
export async function sendBatch(env, messages) {
  const sent = [];
  for (let i = 0; i < messages.length; i += BATCH_MAX) {
    const chunk = messages.slice(i, i + BATCH_MAX).map((m) => ({
      from: env.NEWSLETTER_FROM,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      // One-click unsubscribe in the mail client's own UI: the single biggest
      // thing keeping a daily list out of the spam folder.
      ...(m.headers ? { headers: m.headers } : {}),
    }));
    const res = await fetch(`${API}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`resend batch ${res.status}: ${(await res.text()).slice(0, 200)}`);
    sent.push(...chunk.map((c) => c.to[0]));
  }
  return sent;
}

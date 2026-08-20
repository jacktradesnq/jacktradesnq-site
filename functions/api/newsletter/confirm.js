// GET /api/newsletter/confirm?t=<token>
// The click that puts an address on the send list.

import { confirm } from '../../_shared/subscribers.js';

const page = (title, body) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#02130C;color:#F3EFDC;
       font:500 17px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;padding:24px;}
  .card{max-width:520px;background:#071C13;border:1px solid #1C3329;border-radius:12px;padding:32px;}
  h1{margin:0 0 12px;font:italic 400 30px/1.15 Georgia,serif;}
  .dot{color:#E9B44B}
  p{margin:0;color:#839180}
  a{color:#E9B44B}
</style>
<div class="card"><h1>${title}<span class="dot">.</span></h1><p>${body}</p></div>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

export async function onRequestGet(context) {
  const token = new URL(context.request.url).searchParams.get('t') ?? '';
  const res = await confirm(context.env.NEWSLETTER, token, { now: new Date().toISOString() });

  if (!res.ok) {
    return page(
      'That link is dead',
      'It was already used, or it expired. Sign up again on <a href="/prop-firms/">the prop firm page</a> and you will get a fresh one.'
    );
  }
  return page(
    res.alreadyConfirmed ? 'You were already in' : 'You are in',
    'The next deal lands in your inbox. One email a day at most, and only when a firm actually moves its price. Every email has an unsubscribe link.'
  );
}

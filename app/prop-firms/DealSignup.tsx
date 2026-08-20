'use client';

import { useState } from 'react';

// Email capture for the daily deal. Posts to /api/subscribe (Cloudflare Pages
// Function): the address is stored as pending until the emailed link is clicked.
type State = 'idle' | 'sending' | 'done' | 'error';

export function DealSignup() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot, hidden from humans
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setState('done');
        return;
      }
      setState('error');
      setMessage(
        body.error === 'invalid-email'
          ? 'That address does not look right.'
          : body.error === 'too-many-signups'
            ? 'Too many signups from here today. Try again tomorrow.'
            : 'Something broke on my side. Try again in a minute.',
      );
    } catch {
      setState('error');
      setMessage('Something broke on my side. Try again in a minute.');
    }
  }

  return (
    <section className="signup" aria-labelledby="signup-title">
      <div className="signup-card">
        <p className="signup-eyebrow">Daily deal</p>
        <h2 className="signup-title" id="signup-title">
          The best offer of the day, in your inbox
          <span className="dot">.</span>
        </h2>
        <p className="signup-copy">
          One firm a day: the real price after discount, the rules that matter, and the catch. Only
          when a firm actually moves its price, never a rerun of yesterday.
        </p>

        {state === 'done' ? (
          <p className="signup-done" role="status">
            Check your inbox and click the link. Nothing gets sent until you do.
          </p>
        ) : (
          <form className="signup-form" onSubmit={submit} noValidate>
            <label className="signup-label" htmlFor="signup-email">
              Email
            </label>
            <div className="signup-row">
              <input
                id="signup-email"
                className="signup-input"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="signup-btn" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending' : 'Get the deals'}
              </button>
            </div>
            <input
              className="signup-trap"
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            {state === 'error' && (
              <p className="signup-error" role="alert">
                {message}
              </p>
            )}
          </form>
        )}

        <p className="signup-fine">
          Affiliate links, your price does not change. One click to unsubscribe, in every email.
        </p>
      </div>
    </section>
  );
}

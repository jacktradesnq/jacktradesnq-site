'use client';

// /giveaways: how to enter, what a winner must do, the past giveaways (Angelo, 04/11/2026, idea seen
// on fredvshapes.com/giveaways, written his way). Words and history come from his Discord
// (content/giveaways/giveaways.json); the giveaways themselves stay on Discord. The list is updated
// by hand: nothing reads Discord at build time.

import data from '@/content/giveaways/giveaways.json';
import { Arrow } from '../prop-firms/FirmTable';
import { humanDate } from '../prop-firms/firm-view';
import { BackBar, CSS, META, SiteFooter, useBodyBackground } from '../prop-firms/shared';

const GIVEAWAYS_CSS = `
.jtnq-cmp .gw{ max-width: 720px; margin: 0 auto; padding: 32px var(--pad-x) 96px; display: grid; gap: 64px; }
.jtnq-cmp .gw-h{ font-family: var(--f-sans); font-weight: 500; font-size: 24px; letter-spacing: -0.01em; margin: 0 0 24px; color: var(--c-text); }
.jtnq-cmp .gw-steps, .jtnq-cmp .gw-rules, .jtnq-cmp .gw-past{ list-style: none; margin: 0; padding: 0; }
.jtnq-cmp .gw-steps{ counter-reset: gw; display: grid; gap: 16px; }
.jtnq-cmp .gw-steps li{ counter-increment: gw; display: grid; grid-template-columns: 32px 1fr; gap: 12px; font-size: 16px; line-height: 1.5; color: var(--c-text-soft); }
.jtnq-cmp .gw-steps li::before{ content: counter(gw); font-size: 16px; line-height: 1.5; color: var(--c-accent); }
.jtnq-cmp .gw-cta{ margin-top: 32px; }
.jtnq-cmp .gw-rules{ display: grid; gap: 12px; }
.jtnq-cmp .gw-rules li{ font-size: 16px; line-height: 1.5; color: var(--c-text-soft); }
.jtnq-cmp .gw-past li{
  display: grid; grid-template-columns: 112px 1fr auto; gap: 16px; align-items: baseline;
  padding: 16px 0; border-top: 1px solid var(--c-line-soft); font-size: 16px; line-height: 1.5;
}
.jtnq-cmp .gw-past li:last-child{ border-bottom: 1px solid var(--c-line-soft); }
.jtnq-cmp .gw-date, .jtnq-cmp .gw-won{ font-size: 14px; color: var(--c-text-soft); white-space: nowrap; }
.jtnq-cmp .gw-prize{ color: var(--c-text); }
@media (max-width: 560px){
  .jtnq-cmp .gw-past li{ grid-template-columns: 1fr auto; gap: 4px 16px; }
  .jtnq-cmp .gw-prize{ grid-column: 1 / -1; grid-row: 1; }
}
`;

export default function Giveaways() {
  useBodyBackground();
  return (
    <div className="jtnq-cmp">
      <style>{CSS}</style>
      <style>{GIVEAWAYS_CSS}</style>

      <main>
        <section className="hero">
          <BackBar />
          <h1 className="wordmark">
            Giveaways
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{data.phrase}</p>
        </section>

        <div className="gw">
          <section aria-labelledby="gw-enter">
            <h2 className="gw-h" id="gw-enter">How to enter a giveaway</h2>
            <ol className="gw-steps">
              {data.howToEnter.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="gw-cta">
              <a className="row-cta" href={data.discordUrl} target="_blank" rel="noopener">
                Join the server
                <Arrow />
              </a>
            </p>
          </section>

          <section aria-labelledby="gw-win">
            <h2 className="gw-h" id="gw-win">If you win</h2>
            <ul className="gw-rules">
              {data.ifYouWin.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="gw-past">
            <h2 className="gw-h" id="gw-past">Past giveaways</h2>
            <ul className="gw-past">
              {data.past.map((g) => (
                <li key={`${g.date} ${g.prize}`}>
                  <span className="gw-date">{humanDate(g.date)}</span>
                  <span className="gw-prize">{g.prize}</span>
                  <span className="gw-won">
                    {g.winners} winner{g.winners > 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter disclaimer={META.legal.adviceNotice} />
    </div>
  );
}

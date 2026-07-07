'use client';

import { useEffect, useState } from 'react';

const N = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'OFFICIAL PARTNER',
    title: 'Nefarious',
    phrase: 'The free trading community that actually delivers — live, transparent, every day.',
  },
  what: ['LIVE TRADING ROOM', 'DAILY SIGNALS', 'OPTIONS & FUTURES', '100% FREE'],
  testimonials: [
    { quote: 'Consistent, transparent, and actually profitable. Enick and Johnny are great at what they do and live stream it everyday for absolutely free. 10/10 group', author: 'os' },
    { quote: 'Johnny is probably the best in business. Excellent stock picks with clear insights and timely alerts have been consistently profitable. One of the most reliable services I’ve used', author: 'roz' },
    { quote: 'Very generous server! Imagine getting an options level for free and live trade for free?? What more can you ask for! -Chae', author: 'Paul' },
    { quote: 'Enick is goated at futures', author: 'hitheretrial' },
    { quote: 'Goated all free there is nothing to lose. Johnny is him', author: 'Chickie Smalls' },
  ],
  cta: { label: 'Join Nefarious', url: 'https://discord.com/invite/Xug73qenBq', note: 'FREE · NO CATCH' },
  closer: { lead: 'Drop in, lurk, ask anything. It costs nothing.' },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice.',
  },
};

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function Nefarious() {
  const [members, setMembers] = useState<number>(5091);

  useEffect(() => {
    fetch('/api/community')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.members === 'number' && d.members > 0) setMembers(d.members);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  return (
    <div className="jtnq-nef">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={N.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{N.backToHome.label}</span>
            </a>
            <a className="back-join" href={N.cta.url} target="_blank" rel="noopener">
              Join
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <div className="eyebrow">{N.hero.eyebrow}</div>
          <h1 className="wordmark">
            {N.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{N.hero.phrase}</p>
        </section>

        <section className="what">
          {N.what.map((w, i) => (
            <span key={w} style={{ display: 'contents' }}>
              {i > 0 && (
                <span className="sep" aria-hidden="true">
                  ·
                </span>
              )}
              <span className="item">{w}</span>
            </span>
          ))}
        </section>

        <section className="testimonials">
          <div className="section-head">
            <h2>From the community</h2>
            <span className="count">{members.toLocaleString('en-US')} Discord members</span>
          </div>
          <div className="testi-grid">
            {N.testimonials.map((t, i) => (
              <div className={wordCount(t.quote) <= 6 ? 'testi is-short' : 'testi'} key={i}>
                <p className="quote">{t.quote}</p>
                <div className="author">
                  <span className="dot" />
                  <span>{t.author}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="closer">
          <p className="lead">{N.closer.lead}</p>
          <a className="cta" href={N.cta.url} target="_blank" rel="noopener">
            <span>{N.cta.label}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
          <div className="note">
            <span className="gold">·</span>
            <span>FREE</span>
            <span className="gold">·</span>
            <span>NO CATCH</span>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {N.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={N.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={N.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{N.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{N.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

const CSS = `
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal;
  font-weight:400 500;
  font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
.jtnq-nef{
  --c-bg: oklch(0.13 0.028 165);
  --c-bg-raise: oklch(0.17 0.032 165);
  --c-bg-deep: oklch(0.11 0.025 165);
  --c-text: oklch(0.95 0.025 95);
  --c-text-soft: oklch(0.78 0.025 120);
  --c-text-mute: oklch(0.55 0.025 140);
  --c-text-deep: oklch(0.38 0.02 150);
  --c-accent: oklch(0.78 0.14 75);
  --c-line: oklch(0.27 0.032 165);
  --c-line-soft: oklch(0.22 0.028 165);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
  --maxw: 1200px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.jtnq-nef a{ color: inherit; text-decoration: none; }
.jtnq-nef ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-nef .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-nef .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-nef .back .arr{ width: 14px; height: 14px; }
.jtnq-nef .back:hover{ color: var(--c-accent); gap: 12px; }
.jtnq-nef .back-join{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 7px 16px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 7px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-nef .back-join svg{ width: 11px; height: 11px; }
.jtnq-nef .back-join:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-nef .hero{
  position: relative; padding: clamp(130px, 16vh, 180px) var(--pad-x) clamp(72px, 9vw, 104px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-nef .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 16%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-nef .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px;
  margin-bottom: clamp(28px, 4vw, 44px);
}
.jtnq-nef .eyebrow::before, .jtnq-nef .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-nef .wordmark{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(72px, 13vw, 200px); line-height: .88; letter-spacing: -0.035em; margin: 0; color: var(--c-text);
}
.jtnq-nef .wordmark .dot{ color: var(--c-accent); }
.jtnq-nef .phrase{
  margin: clamp(28px, 4vw, 44px) auto 0; max-width: 36ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(20px, 2.3vw, 28px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft);
  text-wrap: balance;
}

.jtnq-nef .what{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(36px, 5vw, 56px) var(--pad-x);
  border-top: 1px solid var(--c-line-soft); border-bottom: 1px solid var(--c-line-soft);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: clamp(14px, 2vw, 24px) clamp(18px, 3vw, 36px); text-align: center;
  font-family: var(--f-mono); font-size: clamp(11px, 1.05vw, 13px); letter-spacing: .24em;
  text-transform: uppercase; color: var(--c-text);
}
.jtnq-nef .what .item{ display: inline-block; }
.jtnq-nef .what .sep{ color: var(--c-accent); opacity: .9; font-size: 14px; line-height: 0; transform: translateY(-1px); display: inline-block; }

.jtnq-nef .testimonials{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(64px, 8vw, 96px) var(--pad-x) clamp(48px, 7vw, 80px);
}
.jtnq-nef .section-head{
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  margin-bottom: clamp(32px, 4vw, 48px); padding-bottom: 18px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-nef .section-head h2{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(26px, 3.2vw, 40px); line-height: 1; letter-spacing: -0.02em; margin: 0; color: var(--c-text);
}
.jtnq-nef .section-head .count{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-nef .testi-grid{ column-count: 2; column-gap: clamp(20px, 2.4vw, 28px); }
@media (max-width: 760px){ .jtnq-nef .testi-grid{ column-count: 1; } }
.jtnq-nef .testi{
  position: relative; background: var(--c-bg-raise); border: 1px solid var(--c-line);
  padding: clamp(22px, 2.6vw, 30px); margin: 0 0 clamp(20px, 2.4vw, 28px); display: block;
  break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;
  transition: border-color .25s ease;
}
.jtnq-nef .testi:hover{ border-color: var(--c-accent); }
.jtnq-nef .testi .quote{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 1.55vw, 21px); line-height: 1.42; letter-spacing: -0.005em; color: var(--c-text);
  margin: 0; text-wrap: pretty;
}
.jtnq-nef .testi .quote::before{ content: "\\201C"; font-family: var(--f-serif); font-style: italic; color: var(--c-accent); margin-right: 2px; }
.jtnq-nef .testi .quote::after{ content: "\\201D"; font-family: var(--f-serif); font-style: italic; color: var(--c-accent); margin-left: 1px; }
.jtnq-nef .testi .author{
  margin-top: clamp(18px, 2vw, 22px); display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-nef .testi .author .dot{ width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); flex-shrink: 0; }
.jtnq-nef .testi.is-short .quote{ font-size: clamp(22px, 2.1vw, 28px); line-height: 1.25; }

.jtnq-nef .closer{
  position: relative; padding: clamp(80px, 11vw, 128px) var(--pad-x) clamp(72px, 10vw, 112px);
  text-align: center; border-top: 1px solid var(--c-line-soft); overflow: hidden; isolation: isolate;
}
.jtnq-nef .closer::before{
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(50% 80% at 50% 100%, color-mix(in oklab, var(--c-accent) 18%, transparent) 0%, transparent 70%);
  pointer-events: none; z-index: -1;
}
.jtnq-nef .closer .lead{
  font-family: var(--f-serif); font-style: italic; font-size: clamp(22px, 2.6vw, 32px);
  line-height: 1.3; letter-spacing: -0.015em; color: var(--c-text); max-width: 24ch;
  margin: 0 auto clamp(32px, 4vw, 48px); text-wrap: balance;
}
.jtnq-nef .cta{
  display: inline-flex; align-items: center; gap: 14px; background: var(--c-accent); color: var(--c-bg);
  font-family: var(--f-sans); font-weight: 500; font-size: clamp(16px, 1.6vw, 19px); letter-spacing: -0.01em;
  padding: clamp(18px, 1.8vw, 22px) clamp(32px, 3.6vw, 44px); border-radius: 999px;
  transition: transform .25s ease, background .25s ease, gap .25s ease;
}
.jtnq-nef .cta:hover{ transform: translateY(-2px); gap: 18px; background: oklch(0.83 0.14 78); }
.jtnq-nef .cta svg{ width: 16px; height: 16px; }
.jtnq-nef .note{
  margin-top: clamp(22px, 2.6vw, 30px); font-family: var(--f-mono); font-size: 11px;
  letter-spacing: .26em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-nef .note .gold{ color: var(--c-accent); margin: 0 8px; }

.jtnq-nef .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-nef .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-nef .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-nef .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-nef .footer-brand .dot{ color: var(--c-accent); }
.jtnq-nef .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-nef .footer-meta{ text-align: left; } }
.jtnq-nef .footer-meta a{ color: var(--c-text-soft); }
.jtnq-nef .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-nef .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-nef .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}
`;

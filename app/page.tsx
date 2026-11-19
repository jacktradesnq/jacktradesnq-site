'use client';

import { useEffect, useRef, useState } from 'react';
import PayoutCarousel from './payout-carousel';
import { ICONS } from './home-icons';
// Written by ~/propfirm-tracker (site_counter.py) on every approved payout mail, then pushed to main.
import challengeData from '../content/challenge.json';
// Every certificate propfirm-tracker has published (never emptied), for "Total payout".
import autoCertificates from '../content/certificates.json';

// This month's payout certificates, also written by propfirm-tracker (Lucid "Your Payout Certificate is Ready!" mail).
// Angelo 31/10/2026: added automatically, back to 0 every new month; the June-August ones stay.
type Certificate = { file: string; day?: string; date: string; firm: string; amount: number | null };
const monthCertificates: Certificate[] = (challengeData as { certificates?: Certificate[] }).certificates ?? [];

const challengeMonth = new Date(`${challengeData.month}-01T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const SITE = {
  brand: 'Jacktradesnq',
  socials: [
    { name: 'YouTube', url: 'https://www.youtube.com/@jack.tradesnq', handle: '@jack.tradesnq' },
    { name: 'Twitch', url: 'https://www.twitch.tv/jacktradesnq', handle: 'jacktradesnq' },
    { name: 'Kick', url: 'https://kick.com/jacktradesnq', handle: 'jacktradesnq' },
    { name: 'TikTok', url: 'https://www.tiktok.com/@jack.tradesnq', handle: '@jack.tradesnq' },
    { name: 'Instagram', url: 'https://www.instagram.com/jack.tradesnq', handle: '@jack.tradesnq' },
    { name: 'X', url: 'https://x.com/jacktradesnq', handle: '@jacktradesnq' },
    { name: 'Discord', url: 'https://discord.gg/wpddBCAAU2', handle: 'Join the server' },
  ],
  nefarious: { name: 'Nefarious', url: '/nefarious/', tagline: 'Official partner · free Discord community' },
  propFirms: { name: 'Trading Partnerships', url: '/prop-firms/', tagline: 'Futures & perps partners · trade copier · code JTNQ' },
  giveaways: { name: 'Giveaways', url: '/giveaways/', tagline: 'How to enter · past giveaways' },
  // Bio: Angelo's own sentences (dictated 13-14/10/2026), English corrected only.
  bio: {
    hello: "Hi, I'm Jack",
    paragraphs: [
      "I'm a futures trader from France, I trade NQ on prop firm accounts, and I'm a profitable day trader.",
      'I started day trading four years ago. I trade the New York AM session with ICT.',
    ],
  },
  // Total payout (Angelo 31/10/2026: "on va garder ca par \" Total payout \" on aura l'intégralité de tout nos paoyuts ici; lucid et pas lucid met aussi traders launch").
  // Lucid: downloaded from his dashboard (Certificates) on 14/10/2026. Traders Launch: iCloud Jack/Trading/traders-launch-payouts.
  // Certificates that came after are added by propfirm-tracker in content/certificates.json.
  payouts: [
    { file: '/payouts/traders-launch-2026-09-01-160.webp', day: '2026-09-01', date: 'September 1, 2026', firm: 'Traders Launch', amount: 160 },
    { file: '/payouts/traders-launch-2026-08-31-160.webp', day: '2026-08-31', date: 'August 31, 2026', firm: 'Traders Launch', amount: 160 },
    { file: '/payouts/traders-launch-2026-08-28-176.webp', day: '2026-08-28', date: 'August 28, 2026', firm: 'Traders Launch', amount: 176 },
    { file: '/payouts/traders-launch-2026-08-27-160.webp', day: '2026-08-27', date: 'August 27, 2026', firm: 'Traders Launch', amount: 160 },
    { file: '/payouts/traders-launch-2026-08-26-160.webp', day: '2026-08-26', date: 'August 26, 2026', firm: 'Traders Launch', amount: 160 },
    { file: '/payouts/traders-launch-2026-08-25-160.webp', day: '2026-08-25', date: 'August 25, 2026', firm: 'Traders Launch', amount: 160 },
    { file: '/payouts/lucid-2026-08-21-689.webp', day: '2026-08-21', date: 'August 21, 2026', firm: 'Lucid Trading', amount: 689 },
    { file: '/payouts/lucid-2026-08-12-994.webp', day: '2026-08-12', date: 'August 12, 2026', firm: 'Lucid Trading', amount: 994 },
    { file: '/payouts/lucid-2026-06-18-532.webp', day: '2026-06-18', date: 'June 18, 2026', firm: 'Lucid Trading', amount: 532 },
    { file: '/payouts/lucid-2026-06-17-568.webp', day: '2026-06-17', date: 'June 17, 2026', firm: 'Lucid Trading', amount: 568 },
  ] as Certificate[],
  // $10K a month challenge (series started 16/09/2026): payouts received this month, reset to 0 if missed.
  // current = sum of this month's "Payout Approved" amounts (Angelo 26/10/2026: "Tout seul", "Montant approuvé").
  challenge: {
    month: challengeMonth,
    current: Math.round(challengeData.total) as number | null,
    goal: 10000,
    text: [
      "Right now, I'm doing a challenge where I document my way to making $10K a month with day trading.",
      "I chose $10K a month because five figures is a good milestone in my opinion.",
    ],
  },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice.',
  },
};

const allCertificates: Certificate[] = [
  ...(autoCertificates as Certificate[]),
  ...SITE.payouts.filter((p) => !(autoCertificates as Certificate[]).some((a) => a.file === p.file)),
].sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''));

function certificateAlt(c: Certificate) {
  return `${c.firm} payout certificate, ${c.date}${c.amount == null ? '' : `: $${Math.round(c.amount).toLocaleString('en-US')}`}`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const socialsRef = useRef<HTMLDivElement>(null);
  const [socialsOpen, setSocialsOpen] = useState(false);

  useEffect(() => {
    if (!socialsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!socialsRef.current?.contains(e.target as Node)) setSocialsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSocialsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [socialsOpen]);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.17 0.03 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const COLORS = {
      grid: 'rgba(180, 160, 120, 0.05)',
      wick: 'rgba(210, 195, 165, 0.50)',
      up: 'rgba(220, 200, 160, 0.85)',
      down: 'rgba(120, 110, 95, 0.85)',
      accent: 'rgba(212, 168, 70, 1)',
      accentSoft: 'rgba(212, 168, 70, 0.40)',
    };

    const CANDLE_W = 14;
    const GAP = 6;
    const STRIDE = CANDLE_W + GAP;
    const NEW_CANDLE_MS = 2000;
    const PX_PER_MS = STRIDE / NEW_CANDLE_MS;
    const ACCENT_PROB = 1 / 18;

    let W = 0;
    let H = 0;
    let buffer: { open: number; high: number; low: number; close: number; accent: boolean }[] = [];
    let xOffset = 0;
    let lastT = performance.now();
    let yMin = 100;
    let yMax = 100;
    let raf = 0;
    let lastClose = 100;

    const gauss = () => {
      const u = Math.max(1e-9, Math.random());
      const v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const nextCandle = () => {
      const open = lastClose;
      const close = open + gauss() * 1.3;
      const high = Math.max(open, close) + Math.abs(gauss()) * 1.0;
      const low = Math.min(open, close) - Math.abs(gauss()) * 1.0;
      lastClose = close;
      return { open, high, low, close, accent: Math.random() < ACCENT_PROB };
    };

    const neededBufferSize = () => Math.ceil(W / STRIDE) + 3;

    const seedBuffer = (n: number) => {
      buffer = [];
      lastClose = 100 + (Math.random() - 0.5) * 4;
      for (let i = 0; i < n; i++) buffer.push(nextCandle());
      let mn = Infinity;
      let mx = -Infinity;
      for (const c of buffer) {
        if (c.low < mn) mn = c.low;
        if (c.high > mx) mx = c.high;
      }
      yMin = mn;
      yMax = mx;
    };

    const resize = () => {
      const parent = canvas.parentElement as HTMLElement;
      W = parent.clientWidth;
      H = parent.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const needed = neededBufferSize();
      if (buffer.length === 0) seedBuffer(needed);
      else {
        while (buffer.length < needed) buffer.push(nextCandle());
        while (buffer.length > needed) buffer.shift();
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      let mn = Infinity;
      let mx = -Infinity;
      for (const c of buffer) {
        if (c.low < mn) mn = c.low;
        if (c.high > mx) mx = c.high;
      }
      const a = 0.06;
      yMin += (mn - yMin) * a;
      yMax += (mx - yMax) * a;
      const pad = (yMax - yMin) * 0.12 + 1;
      const pMin = yMin - pad;
      const pMax = yMax + pad;
      const yScale = H / (pMax - pMin);

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      const gridLines = 6;
      for (let i = 0; i <= gridLines; i++) {
        const y = Math.floor((H / gridLines) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const N = buffer.length;
      const baseX = -xOffset;
      let lastVisible: (typeof buffer)[0] | null = null;
      for (let i = 0; i < N; i++) {
        const c = buffer[i];
        const x = baseX + i * STRIDE;
        if (x + CANDLE_W < -STRIDE || x > W + STRIDE) continue;
        const yOpen = H - (c.open - pMin) * yScale;
        const yClose = H - (c.close - pMin) * yScale;
        const yHigh = H - (c.high - pMin) * yScale;
        const yLow = H - (c.low - pMin) * yScale;
        const isUp = c.close >= c.open;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        ctx.strokeStyle = c.accent ? COLORS.accentSoft : COLORS.wick;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + CANDLE_W / 2, yHigh);
        ctx.lineTo(x + CANDLE_W / 2, yLow);
        ctx.stroke();
        ctx.fillStyle = c.accent ? COLORS.accent : isUp ? COLORS.up : COLORS.down;
        ctx.fillRect(x, bodyTop, CANDLE_W, bodyH);
        if (x <= W) lastVisible = c;
      }

      if (lastVisible) {
        const y = H - (lastVisible.close - pMin) * yScale;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    };

    const tick = (t: number) => {
      const dt = Math.min(50, t - lastT);
      lastT = t;
      xOffset += PX_PER_MS * dt;
      while (xOffset >= STRIDE) {
        xOffset -= STRIDE;
        buffer.shift();
        buffer.push(nextCandle());
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="jtnq-home">
      <style>{CSS}</style>

      <header className="site-header" ref={headerRef}>
        <a className="brand" href="#top" aria-label="home">
          J<span className="dot">.</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href={SITE.nefarious.url}>Nefarious</a>
          <a href={SITE.propFirms.url}>{SITE.propFirms.name}</a>
          <a href={SITE.giveaways.url}>{SITE.giveaways.name}</a>
          <div className={`nav-socials${socialsOpen ? ' is-open' : ''}`} ref={socialsRef}>
            <button
              type="button"
              className="nav-socials-trigger"
              aria-expanded={socialsOpen}
              aria-controls="socials-menu"
              onClick={() => setSocialsOpen((v) => !v)}
            >
              Socials
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="socials-menu" id="socials-menu" hidden={!socialsOpen}>
              {SITE.socials.map((s, i) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener"
                  style={{ ['--i' as string]: i }}
                  onClick={() => setSocialsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICONS[s.name.toLowerCase()]} />
                  </svg>
                  <span className="sm-name">{s.name}</span>
                  <span className="sm-handle">{s.handle}</span>
                </a>
              ))}
            </div>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <canvas className="hero-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="hero-vignette" aria-hidden="true" />
          <div className="hero-content">
            <h1 className="wordmark">
              {SITE.brand}
              <span className="dot">.</span>
            </h1>
          </div>
          <div className="hero-foot">
            <span className="meta-l">&nbsp;</span>
            <span className="scroll">
              <span>Scroll</span>
              <span className="line" />
            </span>
            <span className="meta-r">&nbsp;</span>
          </div>
        </section>

        <section className="about" aria-labelledby="about-title">
          <div className="about-head">
            <span className="eyebrow">About</span>
            <h2 className="about-title" id="about-title">
              {SITE.bio.hello}
              <span className="swash">.</span>
            </h2>
          </div>
          <div className="about-body">
            {SITE.bio.paragraphs.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </section>

        <section className="payouts" aria-label="Total payout">
          <span className="eyebrow">Total payout</span>
          <PayoutCarousel label="Total payout certificates" items={allCertificates.map((c) => ({ file: c.file, alt: certificateAlt(c) }))} />
        </section>

        <section className="challenge" aria-labelledby="challenge-title">
          <div className="challenge-head">
            <span className="eyebrow">The challenge · {SITE.challenge.month}</span>
            <h2 className="challenge-count" id="challenge-title">
              <span className="cur">{SITE.challenge.current == null ? '$—' : `$${SITE.challenge.current.toLocaleString('en-US')}`}</span>
              <span className="sep"> / </span>
              <span className="goal">${(SITE.challenge.goal / 1000).toFixed(0)}K</span>
            </h2>
            <div className="challenge-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ((SITE.challenge.current ?? 0) / SITE.challenge.goal) * 100)}%` }} />
            </div>
            <span className="challenge-label">Payouts received this month</span>
          </div>
          <div className="about-body">
            {SITE.challenge.text.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </section>

        {monthCertificates.length > 0 && (
          <section className="payouts payouts-month" aria-label={`Payout certificates, ${SITE.challenge.month}`}>
            <span className="eyebrow">Payouts · {SITE.challenge.month}</span>
            <div className="payouts-grid">
              {monthCertificates.map((c) => (
                <img
                  key={c.file}
                  src={c.file}
                  width={900}
                  height={645}
                  loading="lazy"
                  alt={certificateAlt(c)}
                />
              ))}
            </div>
          </section>
        )}

        <section id="hub" className="hub">
          <div className="hub-grid">
            <a className="hub-card" href={SITE.nefarious.url}>
              <div className="row">
                <h3 className="title">
                  {SITE.nefarious.name}
                  <span className="swash">.</span>
                </h3>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="tagline">{SITE.nefarious.tagline}</p>
            </a>

            <a className="hub-card" href={SITE.propFirms.url}>
              <div className="row">
                <h3 className="title">
                  {SITE.propFirms.name}
                  <span className="swash">.</span>
                </h3>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="tagline">{SITE.propFirms.tagline}</p>
            </a>

            <a className="hub-card" href={SITE.giveaways.url}>
              <div className="row">
                <h3 className="title">
                  {SITE.giveaways.name}
                  <span className="swash">.</span>
                </h3>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="tagline">{SITE.giveaways.tagline}</p>
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {SITE.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <div className="footer-socials">
              {SITE.socials.map((s) => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener" aria-label={s.name}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICONS[s.name.toLowerCase()]} />
                  </svg>
                </a>
              ))}
            </div>
            <a href={SITE.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={SITE.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{SITE.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{SITE.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

const CSS = `
.jtnq-home{
  --c-bg: oklch(0.17 0.03 165);
  --c-bg-raise: oklch(0.205 0.035 165);
  --c-bg-deep: oklch(0.13 0.028 165);
  --c-text: oklch(0.95 0.025 95);
  --c-text-soft: oklch(0.78 0.025 120);
  --c-text-mute: oklch(0.78 0.025 120);
  --c-text-deep: oklch(0.78 0.025 120);
  --c-accent: oklch(0.80 0.135 82);
  --c-line: oklch(0.29 0.035 165);
  --c-line-soft: oklch(0.24 0.03 165);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --maxw: 1280px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  position: relative;
}
.jtnq-home a{ color: inherit; text-decoration: none; }
.jtnq-home ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-home .site-header{
  position: fixed; inset: 0 0 auto 0; z-index: 60;
  padding: 22px var(--pad-x);
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  transition: background .25s ease, border-color .25s ease, backdrop-filter .25s ease;
  border-bottom: 1px solid transparent;
}
.jtnq-home .site-header.is-stuck{
  background: color-mix(in oklab, var(--c-bg) 70%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
  border-bottom-color: var(--c-line-soft);
}
.jtnq-home .brand{
  font-family: var(--f-sans); font-weight: 500;
  font-size: 28px; line-height: 1; letter-spacing: -0.015em;
  color: var(--c-text); display: inline-flex; align-items: baseline;
  transition: color .2s ease;
}
.jtnq-home .brand:hover{ color: var(--c-accent); }
.jtnq-home .brand .dot{ color: var(--c-accent); }
.jtnq-home .nav{ display: flex; align-items: center; gap: 2px; }
.jtnq-home .nav a{
  font-size: 13px; color: var(--c-text-soft); padding: 8px 14px;
  border-radius: 999px; transition: color .18s ease;
  /* "Prop firms" is the first two-word entry: without this it breaks onto two
     lines at phone width and the whole bar looks squeezed. */
  white-space: nowrap;
}
.jtnq-home .nav a:hover{ color: var(--c-text); }

.jtnq-home .nav-socials{ position: relative; }
.jtnq-home .nav-socials-trigger{
  font-family: inherit; font-size: 13px; color: var(--c-text-soft);
  background: none; border: 0; cursor: pointer;
  padding: 8px 14px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 8px;
  transition: color .18s ease;
}
.jtnq-home .nav-socials-trigger:hover,
.jtnq-home .nav-socials.is-open .nav-socials-trigger{ color: var(--c-text); }
.jtnq-home .nav-socials-trigger svg{
  width: 11px; height: 11px; opacity: .7;
  transition: transform .22s ease;
}
.jtnq-home .nav-socials.is-open .nav-socials-trigger svg{ transform: rotate(180deg); }
.jtnq-home .socials-menu{
  position: absolute; top: calc(100% + 12px); right: 0; z-index: 70;
  min-width: 248px; padding: 8px; border-radius: 12px;
  background: color-mix(in oklab, var(--c-bg-raise) 92%, transparent);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  border: 1px solid var(--c-line);
  box-shadow:
    0 1px 0 0 color-mix(in oklab, var(--c-text) 6%, transparent) inset,
    0 12px 32px -12px color-mix(in oklab, var(--c-bg-deep) 90%, transparent),
    0 32px 64px -24px color-mix(in oklab, var(--c-bg-deep) 80%, transparent);
  display: flex; flex-direction: column; gap: 2px;
  animation: sm-in .18s ease both;
}
@keyframes sm-in{ from{ opacity: 0; transform: translateY(-6px); } to{ opacity: 1; transform: none; } }
.jtnq-home .socials-menu a{
  display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 12px;
  padding: 8px 12px; border-radius: 4px; color: var(--c-text-soft);
  animation: sm-row .22s ease both; animation-delay: calc(var(--i) * 28ms);
  transition: background .16s ease, color .16s ease;
}
@keyframes sm-row{ from{ opacity: 0; transform: translateX(-4px); } to{ opacity: 1; transform: none; } }
.jtnq-home .socials-menu a svg{ width: 16px; height: 16px; fill: currentColor; color: var(--c-text-mute); transition: color .16s ease; }
.jtnq-home .socials-menu .sm-name{ font-size: 13px; }
.jtnq-home .socials-menu .sm-handle{
  font-family: var(--f-sans); font-size: 14px;
  color: var(--c-text-deep); transition: color .16s ease;
}
.jtnq-home .socials-menu a:hover{ background: color-mix(in oklab, var(--c-accent) 10%, transparent); color: var(--c-text); }
.jtnq-home .socials-menu a:hover svg{ color: var(--c-accent); }
.jtnq-home .socials-menu a:hover .sm-handle{ color: var(--c-text-mute); }
@media (prefers-reduced-motion: reduce){
  .jtnq-home .socials-menu,
  .jtnq-home .socials-menu a{ animation: none; }
  .jtnq-home .nav-socials-trigger svg{ transition: none; }
}
@media (max-width: 520px){
  .jtnq-home .nav a, .jtnq-home .nav-socials-trigger{ font-size: 12px; padding: 8px 8px; }
  .jtnq-home .socials-menu{ min-width: 216px; }
}
@media (max-width: 360px){
  .jtnq-home .nav a, .jtnq-home .nav-socials-trigger{ font-size: 11px; padding: 8px 4px; }
}

.jtnq-home .hero{
  position: relative; min-height: 100vh; width: 100%; overflow: hidden;
  display: grid; grid-template-rows: 1fr auto; isolation: isolate;
}
.jtnq-home .hero-canvas{
  position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; opacity: .65;
  -webkit-mask-image: radial-gradient(ellipse 38% 42% at 50% 52%, transparent 0%, transparent 30%, rgba(0,0,0,.55) 55%, #000 75%);
  mask-image: radial-gradient(ellipse 38% 42% at 50% 52%, transparent 0%, transparent 30%, rgba(0,0,0,.55) 55%, #000 75%);
}
.jtnq-home .hero-vignette{
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    radial-gradient(80% 60% at 50% 50%, transparent 0%, transparent 45%, var(--c-bg) 100%),
    linear-gradient(180deg, color-mix(in oklab, var(--c-bg) 60%, transparent) 0%, transparent 25%, transparent 75%, var(--c-bg) 100%);
}
.jtnq-home .hero-content{
  position: relative; z-index: 2; align-self: center; text-align: center;
  padding: 160px var(--pad-x) 0;
}
.jtnq-home .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-style: normal; font-weight: 700;
  font-size: clamp(80px, 12vw, 188px); line-height: .9; letter-spacing: -0.028em;
  margin: 0; color: var(--c-text);
}
.jtnq-home .wordmark .dot{
  color: var(--c-accent); display: inline-block; transform-origin: center 75%;
  animation: jtnqDotPulse 2s ease-in-out infinite;
}
@keyframes jtnqDotPulse{
  0%,100%{ transform: scale(1.5); opacity: 1; }
  50%{ transform: scale(1.75); opacity: .85; }
}
.jtnq-home .hero-foot{
  position: relative; z-index: 2; display: grid;
  grid-template-columns: 1fr auto 1fr; align-items: end; gap: 24px;
  padding: 0 var(--pad-x) 36px; color: var(--c-text-mute);
  font-family: var(--f-sans); font-size: 14px;
}
.jtnq-home .hero-foot .scroll{
  grid-column: 2; display: inline-flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--c-text-soft);
}
.jtnq-home .hero-foot .scroll .line{
  width: 1px; height: 36px; background: linear-gradient(180deg, transparent, var(--c-accent));
  animation: jtnqScrollLine 2.2s ease-in-out infinite; transform-origin: top;
}
@keyframes jtnqScrollLine{
  0%{ transform: scaleY(0); opacity: 0; }
  40%{ transform: scaleY(1); opacity: 1; }
  100%{ transform: scaleY(1); opacity: 0; transform-origin: bottom; }
}
.jtnq-home .hero-foot .meta-l{ justify-self: start; }
.jtnq-home .hero-foot .meta-r{ justify-self: end; }

@media (max-width: 640px){
  .jtnq-home .hero-content{ padding: 0 var(--pad-x); }
  .jtnq-home .wordmark{ font-size: clamp(38px, 12.5vw, 88px); letter-spacing: -0.02em; }
  .jtnq-home .hero-canvas{
    -webkit-mask-image: radial-gradient(ellipse 58% 30% at 50% 50%, transparent 0%, transparent 24%, rgba(0,0,0,.55) 52%, #000 74%);
    mask-image: radial-gradient(ellipse 58% 30% at 50% 50%, transparent 0%, transparent 24%, rgba(0,0,0,.55) 52%, #000 74%);
  }
}

.jtnq-home .about, .jtnq-home .challenge{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(64px, 9vw, 128px) var(--pad-x) 0;
  display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(32px, 6vw, 96px); align-items: start;
}
@media (max-width: 860px){ .jtnq-home .about, .jtnq-home .challenge{ grid-template-columns: 1fr; gap: 24px; } }
.jtnq-home .eyebrow{
  display: inline-flex; align-items: center; gap: 12px;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-accent);
}
.jtnq-home .eyebrow::before{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-home .about-title{
  font-family: var(--f-sans); font-weight: 400;
  font-size: clamp(44px, 5.6vw, 88px); line-height: .95; letter-spacing: -0.03em;
  margin: 24px 0 0; color: var(--c-text);
}
.jtnq-home .about-title .swash{ color: var(--c-accent); }
.jtnq-home .about-body{ padding-top: clamp(0px, 3vw, 48px); }
.jtnq-home .about-body p{
  margin: 0 0 24px; font-size: clamp(17px, 1.5vw, 21px); line-height: 1.6; color: var(--c-text-soft); max-width: 52ch;
}
.jtnq-home .about-body p:first-child{ color: var(--c-text); }
.jtnq-home .payouts{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(48px, 6vw, 96px) var(--pad-x) 0;
}
.jtnq-home .payouts-grid{
  margin-top: 24px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(12px, 1.6vw, 24px);
}
@media (max-width: 980px){ .jtnq-home .payouts-grid{ grid-template-columns: 1fr 1fr; } }
.jtnq-home .payouts-strip{
  margin-top: 24px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; cursor: grab;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, oklch(0 0 0) 64px, oklch(0 0 0) calc(100% - 64px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, oklch(0 0 0) 64px, oklch(0 0 0) calc(100% - 64px), transparent 100%);
}
.jtnq-home .payouts-strip::-webkit-scrollbar{ display: none; }
.jtnq-home .payouts-strip.dragging{ cursor: grabbing; user-select: none; }
.jtnq-home .payouts-strip-row{ display: flex; gap: clamp(12px, 1.6vw, 24px); width: max-content; padding: 4px 0 24px; }
.jtnq-home .payouts-strip-row img{
  display: block; flex: none; width: clamp(240px, 24vw, 360px); height: auto; border-radius: 12px; border: 1px solid var(--c-line);
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .4), 0 16px 40px -16px oklch(0.05 0.02 165 / .6);
  pointer-events: none;
}
.jtnq-home .payouts-grid img{
  display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--c-line);
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .4), 0 16px 40px -16px oklch(0.05 0.02 165 / .6);
}
.jtnq-home .challenge-count{
  margin: 24px 0 0; font-family: var(--f-sans); font-weight: 500;
  font-size: clamp(40px, 5vw, 72px); letter-spacing: -0.02em; line-height: 1; color: var(--c-text);
}
.jtnq-home .challenge-count .cur{ color: var(--c-accent); }
.jtnq-home .challenge-count .sep, .jtnq-home .challenge-count .goal{ color: var(--c-text-mute); }
.jtnq-home .challenge-bar{
  margin-top: 24px; height: 4px; border-radius: 999px; background: var(--c-line); overflow: hidden; max-width: 420px;
}
.jtnq-home .challenge-bar span{ display: block; height: 100%; background: var(--c-accent); border-radius: 999px; }
.jtnq-home .challenge-label{
  display: block; margin-top: 12px;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}

.jtnq-home .hub{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(56px, 8vw, 96px) var(--pad-x) clamp(48px, 6vw, 72px);
  display: grid; grid-template-columns: 1fr; gap: clamp(40px, 5vw, 64px);
}
.jtnq-home .hub-grid{
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(28px, 4vw, 56px); align-items: stretch;
}
@media (max-width: 980px){
  .jtnq-home .hub-grid{ grid-template-columns: 1fr 1fr; gap: clamp(28px, 4vw, 48px); }
}
@media (max-width: 640px){ .jtnq-home .hub-grid{ grid-template-columns: 1fr; gap: 32px; } }
.jtnq-home .hub-card{
  position: relative; display: block; padding: clamp(28px, 3.5vw, 44px) 0;
  border-top: 1px solid var(--c-line); color: var(--c-text); transition: color .25s ease;
}
.jtnq-home .hub-card::after{
  content: ""; position: absolute; inset: 0 auto auto 0; width: 0; height: 1px;
  background: var(--c-accent); transition: width .5s cubic-bezier(.2,.7,.3,1);
}
.jtnq-home .hub-card:hover::after{ width: 100%; }
.jtnq-home .hub-card .row{ display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.jtnq-home .hub-card .title{
  font-family: var(--f-sans); font-weight: 400;
  font-size: clamp(34px, 3.4vw, 52px); line-height: .98; letter-spacing: -0.025em;
  margin: 0; color: var(--c-text); transition: color .25s ease; text-wrap: balance;
}
.jtnq-home .hub-card .title .swash{ color: var(--c-accent); }
.jtnq-home .hub-card .arrow{
  flex-shrink: 0; width: clamp(22px, 2.4vw, 32px); height: clamp(22px, 2.4vw, 32px);
  margin-top: .35em; color: var(--c-text-soft);
  transition: transform .35s cubic-bezier(.2,.7,.3,1), color .25s ease;
}
.jtnq-home .hub-card .tagline{
  margin: clamp(18px, 2.4vw, 28px) 0 0; font-family: var(--f-sans); font-size: 14px;
 color: var(--c-text-mute); max-width: 36ch;
}
.jtnq-home .hub-card:hover .title{ color: var(--c-accent); }
.jtnq-home .hub-card:hover .arrow{ color: var(--c-accent); transform: translate(6px,-6px); }

.jtnq-home .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft);
  padding: 56px var(--pad-x) 48px;
}
.jtnq-home .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid;
  grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-home .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-home .footer-brand{ font-family: var(--f-sans); font-size: 22px; color: var(--c-text); }
.jtnq-home .footer-brand .dot{ color: var(--c-accent); }
.jtnq-home .footer-meta{
  font-family: var(--f-sans); font-size: 14px;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-home .footer-meta{ text-align: left; } }
.jtnq-home .footer-meta a{ color: var(--c-text-soft); }
.jtnq-home .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-home .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-home .footer-socials{ display: flex; gap: 18px; justify-content: flex-end; margin-bottom: 20px; }
@media (max-width: 720px){ .jtnq-home .footer-socials{ justify-content: flex-start; } }
.jtnq-home .footer-socials a{ color: var(--c-text-mute); display: inline-flex; transition: color .2s ease, transform .2s ease; }
.jtnq-home .footer-socials a:hover{ color: var(--c-accent); transform: translateY(-2px); }
.jtnq-home .footer-socials svg{ width: 18px; height: 18px; fill: currentColor; }
.jtnq-home .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px;
  border-top: 1px solid var(--c-line-soft); font-size: 12px; line-height: 1.7; color: var(--c-text-deep);
}
`;

'use client';

import { useEffect, useRef } from 'react';

const SITE = {
  brand: 'Jacktradesnq',
  socials: [
    { name: 'TikTok', url: 'https://www.tiktok.com/@jack.tradesnq' },
    { name: 'YouTube', url: 'https://www.youtube.com/@jack.tradesnq' },
    { name: 'Instagram', url: 'https://www.instagram.com/jack.tradesnq' },
    { name: 'X', url: 'https://x.com/jacktradesnq' },
  ],
  studies: { url: '/studies/', tagline: '10 years of futures data, backtested with AI' },
  nefarious: { name: 'Nefarious', url: '/nefarious/', tagline: 'Official partner · free Discord community' },
  topOne: { name: 'Top One Futures', url: '/top-one-futures/', tagline: 'Prop firm partner · daily payouts, code JTNQ' },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice.',
  },
};

const ICONS: Record<string, string> = {
  tiktok:
    'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  instagram:
    'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.16 0.012 60)';
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
          <a className="nav-cta" href={SITE.studies.url}>
            Studies
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
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

        <section id="hub" className="hub">
          <div className="hub-grid">
            <a className="hub-card" href={SITE.studies.url}>
              <div className="row">
                <h3 className="title">
                  Studies<span className="swash">.</span>
                </h3>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="tagline">{SITE.studies.tagline}</p>
            </a>

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

            <a className="hub-card" href={SITE.topOne.url}>
              <div className="row">
                <h3 className="title">
                  {SITE.topOne.name}
                  <span className="swash">.</span>
                </h3>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </div>
              <p className="tagline">{SITE.topOne.tagline}</p>
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
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal;
  font-weight:400 500;
  font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
.jtnq-home{
  --c-bg: oklch(0.16 0.012 60);
  --c-bg-raise: oklch(0.20 0.014 58);
  --c-bg-deep: oklch(0.12 0.010 60);
  --c-text: oklch(0.94 0.028 85);
  --c-text-soft: oklch(0.78 0.022 80);
  --c-text-mute: oklch(0.52 0.018 75);
  --c-text-deep: oklch(0.36 0.015 70);
  --c-accent: oklch(0.80 0.135 82);
  --c-line: oklch(0.28 0.012 65);
  --c-line-soft: oklch(0.22 0.010 62);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
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
  font-family: var(--f-serif); font-style: italic; font-weight: 500;
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
}
.jtnq-home .nav a:hover{ color: var(--c-text); }
.jtnq-home .nav .nav-cta{
  margin-left: 12px; color: var(--c-accent); background: transparent;
  border: 1px solid var(--c-accent); padding: 8px 16px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 8px; font-weight: 500;
  transition: color .2s ease, background .2s ease, transform .2s ease;
}
.jtnq-home .nav .nav-cta svg{ width: 11px; height: 11px; }
.jtnq-home .nav .nav-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

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
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(96px, 14vw, 220px); line-height: .88; letter-spacing: -0.035em;
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
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
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

.jtnq-home .hub{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(56px, 8vw, 96px) var(--pad-x) clamp(48px, 6vw, 72px);
  display: grid; grid-template-columns: 1fr; gap: clamp(40px, 5vw, 64px);
}
.jtnq-home .hub-grid{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(28px, 4vw, 56px); align-items: stretch;
}
@media (max-width: 980px){ .jtnq-home .hub-grid{ grid-template-columns: 1fr 1fr; gap: clamp(28px, 4vw, 48px); } }
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
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
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
  margin: clamp(18px, 2.4vw, 28px) 0 0; font-family: var(--f-mono); font-size: 11px;
  letter-spacing: .18em; text-transform: uppercase; color: var(--c-text-mute); max-width: 36ch;
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
.jtnq-home .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-home .footer-brand .dot{ color: var(--c-accent); }
.jtnq-home .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
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

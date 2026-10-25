'use client';

// /prop-firms: pick a family (Futures · Perps), then a firm, and its whole table
// opens in a window over the page — every program and every size at once. Angelo, 11/10/2026: « un filtre
// où tu tapes entre futures, perps et CFD […] chaque prop firm tu cliques dessus et ça
// t'ouvre le tableau directement ».
//
// His partnership contracts forbid comparing firms or putting one forward (11/10/2026:
// « faut pas que je compare et que je mette en avant l'un ou l'autre, c'est contre mes
// contrats »): cards in alphabetical order, all alike, never two firms in one table,
// nothing opened by default.
//
// The table opens over the page instead of folding out under the card (Angelo, 12/10/2026:
// « j'ai pas envie que ça soit un toggle mais un truc qui s'ouvre »).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CSS, META, money } from './shared';
import { FAMILIES, type Family, type FirmView } from './firm-view';
import { FUTURES_FIRMS } from './futures';
import { PERPS_PROMO, PERPS_PROMO_FIRM_ID, PROMO_ENDS_MS, perpsFirms, usePromoLive } from './perps';
import { FirmLogo, FirmTable, PromoClock } from './FirmTable';
import { FAMILY_CSS } from './family-css';

const byName = (a: FirmView, b: FirmView) => a.name.localeCompare(b.name, 'en');
const isFamily = (s: string): s is Family => FAMILIES.some((f) => f.id === s);

export default function PropFirms() {
  const promoLive = usePromoLive();
  const firmsBy = useMemo<Record<Family, FirmView[]>>(
    () => ({
      futures: [...FUTURES_FIRMS].sort(byName),
      perps: perpsFirms(promoLive).sort(byName),
    }),
    [promoLive],
  );

  const [family, setFamily] = useState<Family>('futures');
  const [openId, setOpenId] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  // #futures / #perps open the matching family, on load and on back/forward.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (!isFamily(h)) return;
      setFamily(h);
      setOpenId(null);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  function pick(f: Family) {
    if (f === family) return;
    setFamily(f);
    setOpenId(null);
    window.history.replaceState(null, '', `#${f}`);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = FAMILIES.findIndex((f) => f.id === family);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % FAMILIES.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + FAMILIES.length) % FAMILIES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = FAMILIES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const f = FAMILIES[next].id;
    pick(f);
    tabRefs.current[f]?.focus();
  }

  const firms = firmsBy[family];
  const open = firms.find((f) => f.id === openId) ?? null;

  // The native <dialog> gives Escape, focus trapping and the backdrop for free.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="jtnq-cmp">
      <style>{CSS}</style>
      <style>{FAMILY_CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={META.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{META.backToHome.label}</span>
            </a>
          </div>

          <div className="eyebrow">{META.hero.eyebrow}</div>
          <h1 className="wordmark">
            {META.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{META.hero.phrase}</p>
        </section>

        <section className="fam-section" aria-label="Partner prop firms">
          <div className="fam-tabs" role="tablist" aria-label="Prop firm type">
            {FAMILIES.map((f) => (
              <button
                key={f.id}
                ref={(el) => {
                  tabRefs.current[f.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${f.id}`}
                aria-selected={family === f.id}
                aria-controls={`panel-${f.id}`}
                tabIndex={family === f.id ? 0 : -1}
                className={`fam-tab${family === f.id ? ' active' : ''}`}
                onClick={() => pick(f.id)}
                onKeyDown={onTabKey}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="fam-panel" role="tabpanel" id={`panel-${family}`} aria-labelledby={`tab-${family}`}>
            <p className="fam-caption">
              {firms.length} partner firm{firms.length > 1 ? 's' : ''}
              {firms.length > 1 ? ' · pick one to see all of its plans' : ''}
            </p>

            <div className="firm-cards">
              {firms.map((firm) => {
                return (
                  <button
                    key={firm.id}
                    type="button"
                    className="firm-card"
                    aria-haspopup="dialog"
                    onClick={() => setOpenId(firm.id)}
                  >
                    <FirmLogo firm={firm} size={40} />
                    <span className="fc-body">
                      <span className="fc-name">{firm.name}</span>
                      <span className="fc-meta">{firm.summary}</span>
                      <span className="fc-chips">
                        {firm.code && <span className="promo-chip">code {firm.code.code}</span>}
                        {firm.stale && <span className="stale-chip">{firm.stale.label}</span>}
                      </span>
                    </span>
                    <span className="fc-side">
                      {firm.from && (
                        <span className="fc-from">
                          <span className="fc-from-k">from</span>
                          <span className="fc-from-v">
                            {money(firm.from.now)}
                            {firm.from.per && <span className="per">{firm.from.per}</span>}
                          </span>
                        </span>
                      )}
                      <span className="fc-open">
                        See all plans
                        <svg className="fc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <dialog
              ref={dialogRef}
              className="firm-dialog"
              aria-label={open ? `${open.name} plans` : undefined}
              onClose={() => setOpenId(null)}
              onClick={(e) => {
                // A click on the dimmed backdrop (the dialog box itself, outside the table) closes it.
                if (e.target === e.currentTarget) e.currentTarget.close();
              }}
            >
              <button type="button" className="fd-close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {open && (
              <FirmTable
                key={open.id}
                firm={open}
                id={`firm-${open.id}`}
                banner={
                  open.id === PERPS_PROMO_FIRM_ID && promoLive && PERPS_PROMO && PROMO_ENDS_MS != null ? (
                    <p className="perps-promo">
                      <span className="perps-promo-text">
                        {PERPS_PROMO.discountPct}% off with code {PERPS_PROMO.code} — ends in{' '}
                        <PromoClock endsMs={PROMO_ENDS_MS} />
                      </span>
                    </p>
                  ) : null
                }
              />
              )}
            </dialog>
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {META.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={META.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={META.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{META.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{META.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

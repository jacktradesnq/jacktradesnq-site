'use client';

// /prop-firms: pick a family (Futures · Perps), then a firm, and its window opens over the page.
// Angelo, 11/10/2026: « un filtre où tu tapes entre futures, perps et CFD […] chaque prop firm
// tu cliques dessus et ça t'ouvre le tableau directement ». Since 01/11/2026 the window holds
// his words on the firm, its code and « See all plans », which opens the comparator (« Prop
// compare ») on that firm; the plans themselves live in the comparator.
//
// His partnership contracts forbid putting one firm forward (11/10/2026: « faut pas que je
// compare et que je mette en avant l'un ou l'autre, c'est contre mes contrats »): cards in
// alphabetical order, all alike, nothing opened by default. The comparator he asked for on
// 01/11/2026 ranks nothing either (compare/ComparePanel.tsx).
//
// The window opens over the page instead of folding out under the card (Angelo, 12/10/2026:
// « j'ai pas envie que ça soit un toggle mais un truc qui s'ouvre »).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BackBar, CSS, META, SiteFooter, money, useBodyBackground } from './shared';
import { FAMILIES, type Family, type FirmView } from './firm-view';
import { FUTURES_FIRMS } from './futures';
import { PERPS_PROMO, PERPS_PROMO_FIRM_ID, PROMO_ENDS_MS, perpsFirms, usePromoLive } from './perps';
import { FirmLogo, PromoClock } from './FirmTable';
import { FirmWindow } from './FirmWindow';
import { FirmSearch } from './FirmSearch';
import { firmMatches } from '@/lib/compare-order.mjs';
import { FAMILY_CSS } from './family-css';
import { TRADE_COPIER_CSS, TRADE_COPIER_DISCLAIMER, TradeCopierPanel } from './TradeCopier';
import { ComparePanel } from './compare/ComparePanel';

// A third tab next to Futures and Perps, Tradecopia (Angelo, 31/10/2026: « ouais 3eme bouton »).
// A fourth, the comparator (Angelo, 01/11/2026: 4th button, « Prop compare pour qu'ils
// comprennent on compare quoi »); #compare=<firm-id> opens it on one firm.
// Neither is a firm family: each opens its own panel instead of firm cards.
type Tab = Family | 'trade-copier' | 'compare';
const TABS: { id: Tab; label: string }[] = [
  ...FAMILIES,
  { id: 'trade-copier', label: 'Trade copier' },
  { id: 'compare', label: 'Prop compare' },
];
const COMPARE_FIRM = /^compare=([a-z0-9-]+)$/;

const byName = (a: FirmView, b: FirmView) => a.name.localeCompare(b.name, 'en');
const isTab = (s: string): s is Tab => TABS.some((t) => t.id === s);

export default function PropFirms() {
  const promoLive = usePromoLive();
  const firmsBy = useMemo<Record<Family, FirmView[]>>(
    () => ({
      futures: [...FUTURES_FIRMS].sort(byName),
      perps: perpsFirms(promoLive).sort(byName),
    }),
    [promoLive],
  );

  const [family, setFamily] = useState<Tab>('futures');
  const [openId, setOpenId] = useState<string | null>(null);
  const [compareFirm, setCompareFirm] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useBodyBackground();

  // #futures / #perps / #trade-copier / #compare open the matching tab, on load and on
  // back/forward; #compare=<firm-id> opens the comparator on that firm.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      const firm = COMPARE_FIRM.exec(h)?.[1] ?? null;
      if (!isTab(h) && !firm) return;
      setFamily(firm ? 'compare' : (h as Tab));
      setCompareFirm(firm);
      setOpenId(null);
      setQuery('');
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  function pick(f: Tab) {
    if (f === family) return;
    setFamily(f);
    setOpenId(null);
    setCompareFirm(null);
    setQuery('');
    window.history.replaceState(null, '', `#${f}`);
  }

  // A firm that is only in the other family: its tab opens, the search stays.
  function search(next: string) {
    setQuery(next);
    if (family !== 'futures' && family !== 'perps') return;
    const other = family === 'futures' ? 'perps' : 'futures';
    const has = (f: Family) => firmsBy[f].some((firm) => firmMatches(firm.name, next));
    if (!has(family) && has(other)) {
      setFamily(other);
      window.history.replaceState(null, '', `#${other}`);
    }
  }

  function compareOn(firmId: string | null) {
    setCompareFirm(firmId);
    window.history.replaceState(null, '', firmId ? `#compare=${firmId}` : '#compare');
  }

  // « See all plans » in a firm's window: the comparator, on that firm.
  function seeAllPlans(firmId: string) {
    dialogRef.current?.close();
    setFamily('compare');
    compareOn(firmId);
    document.querySelector('.fam-section')?.scrollIntoView({ block: 'start' });
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((f) => f.id === family);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const f = TABS[next].id;
    pick(f);
    tabRefs.current[f]?.focus();
  }

  const isCopier = family === 'trade-copier';
  const isCompare = family === 'compare';
  const firms = isCopier || isCompare ? [] : firmsBy[family];
  const shownFirms = firms.filter((f) => firmMatches(f.name, query));
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
      <style>{TRADE_COPIER_CSS}</style>

      <main>
        <section className="hero">
          <BackBar />

          <div className="eyebrow">{META.hero.eyebrow}</div>
          <h1 className="wordmark">
            {META.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{META.hero.phrase}</p>
        </section>

        <section className="fam-section" aria-label="Partner prop firms">
          <div className="fam-tabs" role="tablist" aria-label="Prop firm type">
            {TABS.map((f) => (
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
            {isCopier ? (
              <TradeCopierPanel />
            ) : isCompare ? (
              <ComparePanel firm={compareFirm} onFirmChange={compareOn} />
            ) : (
            <>
            <FirmSearch value={query} onChange={search} />
            <p className="fam-caption" aria-live="polite">
              {shownFirms.length === 0 ? (
                'No partner firm found'
              ) : (
                <>
                  {shownFirms.length} partner firm{shownFirms.length > 1 ? 's' : ''}
                  {shownFirms.length > 1 ? ' · pick one to see all of its plans' : ''}
                </>
              )}
            </p>

            <div className="firm-cards">
              {shownFirms.map((firm) => {
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
                        {firm.code && (
                          <span className="promo-chip">
                            {firm.offer ? `${firm.offer} with code ${firm.code.code}` : `code ${firm.code.code}`}
                          </span>
                        )}
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
                        Open
                        <svg className="fc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            </>
            )}

            <dialog
              ref={dialogRef}
              className="firm-dialog"
              aria-label={open ? open.name : undefined}
              onClose={() => setOpenId(null)}
              onClick={(e) => {
                // A click on the dimmed backdrop (the dialog box itself, outside the window) closes it.
                if (e.target === e.currentTarget) e.currentTarget.close();
              }}
            >
              <button type="button" className="fd-close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {open && (
                <FirmWindow
                  key={open.id}
                  firm={open}
                  onSeeAll={() => seeAllPlans(open.id)}
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

      <SiteFooter disclaimer={isCopier ? TRADE_COPIER_DISCLAIMER : META.legal.disclaimer} />
    </div>
  );
}

// A client component like the comparator pages: app/prop-firms/shared.tsx is
// itself 'use client', so its META and CSS exports are client references and a
// server component reading them gets undefined.
'use client';

import rawPromos from '@/public/data/live-promos.json';
import { CSS, META, money, sizeLabel } from '../prop-firms/shared';
import { PROMOS_CSS } from './styles';

// Every figure on this page comes from public/data/live-promos.json, built by
// scripts/build-live-promos.mjs from the same engine as the newsletter, so the
// two can never quote different prices. Rules it enforces: the reference
// account size (50K when the firm sells one), Angelo's code and never a firm's
// public one, and a discount only when one plan's own two prices support it.
type Promo = {
  firmId: string;
  firmName: string;
  logo: string;
  url: string;
  code: string | null;
  codeViaLink: boolean;
  program: string;
  programType: 'eval' | 'instant';
  priceType: 'one-time' | 'monthly';
  size: number;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  priceNote: string | null;
  endsAt: string | null;
  expiring: boolean;
  split: string;
  payout: string;
  ddType: string;
  profitTarget: number | null;
  maxDrawdown: number;
  dailyLoss: number | null;
  consistency: string | null;
  activationFee: number | null;
  contracts: string | null;
  lastChecked: string;
};
type PromoData = { generatedAt: string; builtFor: string; promos: Promo[] };

const DATA = rawPromos as unknown as PromoData;

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

const per = (p: Promo) => (p.priceType === 'monthly' ? '/mo' : '');

// No "catch" block on a promo page: Angelo's call, and it is his page. What
// stays is only what changes the price you pay, stated flatly under it, because
// showing "$37/mo" next to a hidden "$99 once funded" is the kind of half-truth
// this whole page exists to avoid. Trading constraints such as the consistency
// rule live on the full comparison table instead.
function priceFacts(p: Promo): string[] {
  const out: string[] = [];
  if (p.priceNote) out.push(p.priceNote);
  if (p.priceType === 'monthly') out.push('billed monthly');
  if (p.activationFee) out.push(`${money(p.activationFee)} activation once funded`);
  return out;
}

export default function PromosPage() {
  const { promos, generatedAt } = DATA;

  return (
    <div className="jtnq-cmp">
      <style>{CSS}</style>
      <style>{PROMOS_CSS}</style>

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

          <div className="eyebrow">LIVE PROMOS</div>
          <h1 className="wordmark">
            Promos
            <span className="dot">.</span>
          </h1>
          <p className="phrase">
            What my partner futures firms are running right now, on the {sizeLabel(50000)} account
            everybody quotes. Prices read off their own sites, checked {humanDate(generatedAt)}. My
            code JTNQ or tracked link on every button.
          </p>
        </section>

        <section className="promo-section">
          <div className="promo-bar">
            <span className="promo-count">
              {promos.length} promo{promos.length > 1 ? 's' : ''} running
            </span>
            <a className="promo-all" href="/prop-firms/">
              See every plan and rule
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <div className="promo-grid">
            {promos.map((p) => (
              <article
                key={p.firmId}
                id={p.firmId}
                className={`promo-card${p.expiring ? ' is-urgent' : ''}`}
              >
                <header className="promo-head">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="promo-logo" src={p.logo} alt="" width={40} height={40} />
                  <div className="promo-id">
                    <h2 className="promo-firm">{p.firmName}</h2>
                    <p className="promo-plan">
                      {sizeLabel(p.size)} {p.program}
                      <span className="promo-kind">
                        {p.programType === 'instant' ? 'instant funded' : 'challenge'}
                      </span>
                    </p>
                  </div>
                  {p.expiring && p.endsAt && (
                    <span className="promo-ends">ends {humanDate(p.endsAt)}</span>
                  )}
                </header>

                <div className="promo-price">
                  <span className="promo-now">
                    {money(p.price)}
                    {per(p) && <span className="promo-per">{per(p)}</span>}
                  </span>
                  {p.originalPrice != null && (
                    <s className="promo-was">
                      {money(p.originalPrice)}
                      {per(p)}
                    </s>
                  )}
                  <span className="promo-off">{p.discountPct}% off</span>
                </div>
                {priceFacts(p).length > 0 && (
                  <p className="promo-note">{priceFacts(p).join(' \u00b7 ')}</p>
                )}

                <dl className="promo-specs">
                  <div>
                    <dt>Split</dt>
                    <dd>{p.split}</dd>
                  </div>
                  <div>
                    <dt>Payout</dt>
                    <dd>{p.payout}</dd>
                  </div>
                  <div>
                    <dt>Drawdown</dt>
                    <dd>
                      {money(p.maxDrawdown)} {p.ddType}
                    </dd>
                  </div>
                  {p.profitTarget != null && (
                    <div>
                      <dt>Target</dt>
                      <dd>{money(p.profitTarget)}</dd>
                    </div>
                  )}
                  {p.consistency && !/^(none|no|n\/a)$/i.test(p.consistency) && (
                    <div>
                      <dt>Consistency</dt>
                      <dd>{p.consistency}</dd>
                    </div>
                  )}
                </dl>


                <div className="promo-foot">
                  <a className="promo-cta" href={p.url} target="_blank" rel="noopener nofollow sponsored">
                    Get the {sizeLabel(p.size)}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </a>
                  {p.code ? (
                    <span className="promo-code">
                      code <strong>{p.code}</strong>
                    </span>
                  ) : (
                    <span className="promo-code promo-code--link">applied on the link</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <p className="note">
            Prices, promos and activation fees are scraped off each firm&#8217;s own site every
            morning. The risk rules are maintained by hand and checked against those same sites
            every day: anything that no longer matches is flagged and fixed, and the last check ran
            on {humanDate(generatedAt)}. One field is outside that check: the drawdown type. Some
            firms spell it out on the buy screen, others just write &#8220;EOD drawdown&#8221; and
            leave the trailing part to you, so the label here is my reading of theirs. A firm can
            also move a rule between two checks, so read the checkout page before paying. Affiliate
            links: your price does not change, and I earn a commission on sign-ups.
          </p>
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

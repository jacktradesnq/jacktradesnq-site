'use client';

// What a partner firm's window shows on /prop-firms (Angelo, 01/11/2026): his intro sentence,
// « Angelo's take », the code and the button to the firm as before, and « See all plans »,
// which opens the comparator on that firm. The same block for every firm, in the same place.
// The two texts are his alone (content/prop-firms/firm-notes.md); an empty one is not shown.

import notesMd from '@/content/prop-firms/firm-notes.md';
import { parseFirmNotes } from '@/lib/firm-notes.mjs';
import type { FirmView } from './firm-view';
import { Arrow, FirmLogo } from './FirmTable';
import { META } from './shared';

const NOTES = parseFirmNotes(notesMd);

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function FirmWindow({ firm, banner, onSeeAll }: { firm: FirmView; banner?: React.ReactNode; onSeeAll: () => void }) {
  const notes = NOTES[firm.id];
  const intro = notes?.intro ? paragraphs(notes.intro) : [];
  const take = notes?.take ? paragraphs(notes.take) : [];
  return (
    <div className="fw">
      <header className="fw-head">
        <FirmLogo firm={firm} size={48} />
        <h2 className="fw-title">{firm.name}</h2>
      </header>

      {banner}

      {intro.length > 0 && (
        <div className="fw-intro">
          {intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}

      {take.length > 0 && (
        <section className="fw-take" aria-labelledby={`take-${firm.id}`}>
          <h3 className="fw-take-k" id={`take-${firm.id}`}>
            Angelo&apos;s take
          </h3>
          {take.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      )}

      <div className="fw-actions">
        {firm.code && (
          <span className="promo-chip" title={firm.code.title}>
            code {firm.code.code}
          </span>
        )}
        <a className="row-cta" href={firm.href} target="_blank" rel="noopener nofollow sponsored">
          Get funded
          <Arrow />
        </a>
        <button type="button" className="fw-all" onClick={onSeeAll}>
          See all plans
        </button>
      </div>

      {/* The Code JTNQ role on his Discord (Angelo, 04/11/2026: « ok ca m'interesse le role oui »). */}
      {firm.code && (
        <p className="fw-role">
          Used code {firm.code.code}? Open a ticket on{' '}
          <a href={META.discordUrl} target="_blank" rel="noopener">
            my Discord
          </a>{' '}
          with your receipt and get the Code JTNQ role.
        </p>
      )}
    </div>
  );
}

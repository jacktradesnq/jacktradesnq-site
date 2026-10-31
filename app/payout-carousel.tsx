'use client';

import { useEffect, useRef } from 'react';

// Total payout as a strip that moves on its own from left to right, and that visitors can swipe / drag.
// Angelo 31/10/2026: "je préfère que ca défile de gauche a droite automatiquement, et que les utilisateur
// peuvent eux aussi swipe, mettre comme ca si plus tard j'ai de + en + de payoiut ca sera trop fat".

export type CarouselItem = { file: string; alt: string };

const SPEED = 40; // px per second
const RESUME_AFTER = 2500; // ms without touching before it moves again

export default function PayoutCarousel({ items, label }: { items: CarouselItem[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The list is rendered twice: once scrolled past one copy, jump back by exactly one copy (invisible seam).
    const half = () => el.scrollWidth / 2;
    const wrap = () => {
      const h = half();
      if (h <= 0) return;
      if (el.scrollLeft <= 0) el.scrollLeft += h;
      else if (el.scrollLeft >= h) el.scrollLeft -= h;
    };
    el.scrollLeft = half();

    let pausedUntil = 0;
    const pause = () => {
      pausedUntil = performance.now() + RESUME_AFTER;
    };
    let hovering = false;
    let pos = el.scrollLeft;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (reduced || hovering || now < pausedUntil) {
        pos = el.scrollLeft;
      } else {
        // left to right: the certificates travel towards the right, so the view moves left
        pos -= (SPEED * dt) / 1000;
        el.scrollLeft = pos;
        wrap();
        if (Math.abs(el.scrollLeft - pos) > 1) pos = el.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Mouse drag on desktop (touch and trackpads scroll natively).
    let drag: { x: number; left: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      drag = { x: e.clientX, left: el.scrollLeft };
      el.classList.add('dragging');
      pause();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      el.scrollLeft = drag.left - (e.clientX - drag.x);
      wrap();
      pause();
    };
    const up = () => {
      drag = null;
      el.classList.remove('dragging');
    };
    const enter = () => (hovering = true);
    const leave = () => {
      hovering = false;
      up();
    };
    const onScrollInput = () => {
      wrap();
      pause();
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchmove', onScrollInput, { passive: true });
    el.addEventListener('wheel', onScrollInput, { passive: true });
    el.addEventListener('scroll', wrap, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchmove', onScrollInput);
      el.removeEventListener('wheel', onScrollInput);
      el.removeEventListener('scroll', wrap);
    };
  }, [items.length]);

  return (
    <div className="payouts-strip" ref={track} role="region" aria-label={label} tabIndex={0}>
      <div className="payouts-strip-row">
        {[0, 1].map((copy) =>
          items.map((c) => (
            <img
              key={`${copy}-${c.file}`}
              src={c.file}
              width={900}
              height={645}
              loading="lazy"
              draggable={false}
              alt={copy === 0 ? c.alt : ''}
              aria-hidden={copy === 1 ? true : undefined}
            />
          )),
        )}
      </div>
    </div>
  );
}

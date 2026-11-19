'use client';

import { useId, useState } from 'react';
import { firmSuggestions } from '@/lib/compare-order.mjs';

// The little search on the firm selection, always in view, on the firm cards and in Prop compare
// (Angelo, 02/11/2026: « je veux bien le little search même a titre perso si j'ai pas ca ca me
// ferait chier »). It only narrows by name: nothing ranked, nothing put forward.
// Suggestions (Angelo, 19/11/2026: « tu commence a taper Goo souvent ca sort google, la pareil
// avec tout […] si je tape Tradei ca propose tradeify »): the names the typed text is part of,
// alphabetical; click, or arrow keys then Enter, fills the box with the full name. A single
// suggestion is ready for Enter at once.

export function FirmSearch({
  value,
  onChange,
  names = [],
}: {
  value: string;
  onChange: (value: string) => void;
  names?: string[];
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(-1);
  const suggestions = open ? firmSuggestions(names, value) : [];
  const current = chosen >= 0 && chosen < suggestions.length ? chosen : suggestions.length === 1 ? 0 : -1;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setChosen(-1);
  }

  return (
    <label className="firm-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">Search a firm</span>
      <input
        type="search"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={current >= 0 ? `${listId}-${current}` : undefined}
        placeholder="Search a firm"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setChosen(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!suggestions.length) return;
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setChosen((current + step + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' && current >= 0) {
            e.preventDefault();
            pick(suggestions[current]);
          } else if (e.key === 'Escape' && suggestions.length) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {suggestions.length > 0 && (
        <span className="firm-suggest" role="listbox" id={listId}>
          {suggestions.map((name, i) => (
            <span
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              className={i === current ? 'is-on' : undefined}
              // mouse down, not click: the box must not lose focus (and close the list) first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(name);
              }}
            >
              {name}
            </span>
          ))}
        </span>
      )}
    </label>
  );
}

'use client';

// The little search on the firm selection, always in view, on the firm cards and in Prop compare
// (Angelo, 02/11/2026: « je veux bien le little search même a titre perso si j'ai pas ca ca me
// ferait chier »). It only narrows by name: nothing ranked, nothing put forward.

export function FirmSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="firm-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">Search a firm</span>
      <input
        type="search"
        placeholder="Search a firm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

'use client';

import { useState } from 'react';

export interface MobileTab {
  label: string;
  htmlBefore: string;
  htmlAfter?: string;
}

export default function MobileTabs({ tabs }: { tabs: MobileTab[] }) {
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;
  const tab = tabs[active];
  return (
    <div className="bd-mobile-tabs">
      <div className="bd-mobile-tab-bar" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={'bd-mobile-tab' + (i === active ? ' active' : '')}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="bd-mobile-tab-panel">
        <div className="bd-prose" dangerouslySetInnerHTML={{ __html: tab.htmlBefore }} />
        {tab.htmlAfter ? (
          <div className="bd-prose" dangerouslySetInnerHTML={{ __html: tab.htmlAfter }} />
        ) : null}
      </div>
    </div>
  );
}

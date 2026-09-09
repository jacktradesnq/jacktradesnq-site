import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GO_LINKS } from '@/lib/go-links';

export const dynamicParams = false;

export const metadata: Metadata = {
  title: 'Redirecting…',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return GO_LINKS.map((l) => ({ source: l.source, firm: l.firmId }));
}

export default async function Go({ params }: { params: Promise<{ source: string; firm: string }> }) {
  const { source, firm } = await params;
  const link = GO_LINKS.find((l) => l.source === source && l.firmId === firm);
  if (!link) notFound();

  // The beacon fires on load, so the hop waits for it before handing the
  // visitor over — and gives up waiting after 1.2s rather than strand anyone.
  const redirect = `(function(){var t=${JSON.stringify(link.url)};var done=false;
function go(){if(done)return;done=true;location.replace(t);}
if(document.readyState==='complete')setTimeout(go,150);
else addEventListener('load',function(){setTimeout(go,150);});
setTimeout(go,1200);})();`;

  return (
    <main className="jtnq-go">
      <style>{CSS}</style>
      <p className="eyebrow">Jacktradesnq</p>
      <p className="line">
        Taking you to <strong>{link.firmName}</strong>
      </p>
      <a className="manual" href={link.url} rel="noopener nofollow sponsored">
        Continue →
      </a>
      <script dangerouslySetInnerHTML={{ __html: redirect }} />
    </main>
  );
}

const CSS = `
.jtnq-go {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: oklch(0.14 0.014 160);
  color: oklch(0.94 0.012 90);
  text-align: center;
}
.jtnq-go .eyebrow {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: oklch(0.62 0.02 150);
}
.jtnq-go .line { font-size: 1.05rem; }
.jtnq-go .line strong { font-weight: 600; color: oklch(0.8 0.14 80); }
.jtnq-go .manual {
  font-size: 0.85rem;
  color: oklch(0.66 0.03 150);
  text-decoration: underline;
  text-underline-offset: 4px;
}
`;

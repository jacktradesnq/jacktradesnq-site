import type { Metadata } from 'next';
import Link from 'next/link';
import ContactEmail from '../_legal/ContactEmail';

export const metadata: Metadata = {
  title: 'Mentions légales — JackTradesNQ',
};

export default function MentionsLegales() {
  return (
    <main className="page-legal">
      <Link href="/" className="back">← JackTradesNQ</Link>

      <div className="card">
        <div lang="fr">
          <span className="lang-tag">Français</span>
          <h2>Mentions légales</h2>

          <h3>Éditeur du site</h3>
          <p>
            <strong>Jack Chen</strong> — Entrepreneur individuel (EI)<br />
            Adresse : 65 rue du Faubourg du Temple, 75010 Paris, France<br />
            Courriel : <ContactEmail /><br />
            SIREN : 993 260 827<br />
            Directeur de la publication : Jack Chen
          </p>

          <h3>Hébergeur</h3>
          <p>
            Cloudflare, Inc.<br />
            101 Townsend St, San Francisco, CA 94107, États-Unis<br />
            cloudflare.com
          </p>

          <h3>Propriété intellectuelle</h3>
          <p>L&apos;ensemble du contenu de ce site (textes, indicateurs, vidéos, images) est la propriété exclusive de l&apos;éditeur. Toute reproduction sans autorisation est interdite.</p>

          <h3>Avertissement — Contenu financier</h3>
          <p>
            Le contenu de ce site est proposé à titre informatif et éducatif et ne constitue pas un conseil en investissement au sens de l&apos;article D.321-1 du Code monétaire et financier. L&apos;éditeur n&apos;est pas enregistré en tant que Conseiller en Investissements Financiers (CIF) auprès de l&apos;ORIAS. Le trading et l&apos;investissement comportent un risque de perte en capital pouvant être total et, sur les produits à effet de levier, excéder le dépôt initial.
          </p>
        </div>

        <hr />
        <div lang="en">
          <span className="lang-tag">English</span>
          <h2>Legal Notice</h2>

          <h3>Site Publisher</h3>
          <p>
            <strong>Jack Chen</strong> — Sole trader (Entrepreneur individuel)<br />
            Address: 65 rue du Faubourg du Temple, 75010 Paris, France<br />
            Email: <ContactEmail /><br />
            SIREN: 993 260 827
          </p>

          <h3>Hosting</h3>
          <p>Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107, USA — cloudflare.com</p>

          <h3>Disclaimer</h3>
          <p>All content on this site is provided for informational and educational purposes only. Nothing on this site constitutes financial advice, investment advice, trading advice, or any other sort of advice. The publisher is not a registered investment advisor. Trading involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results.</p>
        </div>
      </div>
    </main>
  );
}

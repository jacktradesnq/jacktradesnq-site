import type { Metadata } from 'next';
import Link from 'next/link';
import ContactEmail from '../_legal/ContactEmail';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — JackTradesNQ',
};

export default function PolitiqueConfidentialite() {
  return (
    <main className="page-legal">
      <Link href="/" className="back">← JackTradesNQ</Link>

      <div className="card">
        <div lang="fr">
          <span className="lang-tag">Français</span>
          <h2>Politique de confidentialité</h2>
          <p className="updated">Dernière mise à jour : avril 2026</p>

          <h3>Responsable de traitement</h3>
          <p>Jack Chen — <ContactEmail /> — Paris, France</p>

          <h3>Données collectées</h3>
          <table>
            <thead>
              <tr><th>Traitement</th><th>Données</th><th>Base légale</th><th>Durée</th></tr>
            </thead>
            <tbody>
              <tr><td>Logs serveur</td><td>Adresse IP, navigateur</td><td>Intérêt légitime</td><td>12 mois</td></tr>
            </tbody>
          </table>

          <h3>Cookies</h3>
          <p>Ce site n&apos;utilise aucun cookie de suivi ou publicitaire.</p>

          <h3>Hébergeur</h3>
          <ul>
            <li>Cloudflare, Inc. (hébergement, CDN) — USA — couvert par le EU-US Data Privacy Framework</li>
            <li>Fontshare / Indian Type Foundry (polices web) — Inde/USA — cdn.fontshare.com — adresse IP transmise à chaque chargement de page pour le rendu des polices</li>
          </ul>

          <h3>Vos droits (RGPD)</h3>
          <p>Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité, d&apos;opposition et de définition de directives post-mortem (art. 85 loi I&amp;L). Pour exercer ces droits : <ContactEmail />. Réclamation possible auprès de la CNIL — 3 Place de Fontenoy, 75334 Paris Cedex 07 — cnil.fr.</p>
        </div>

        <hr />
        <div lang="en">
          <span className="lang-tag">English</span>
          <h2>Privacy Policy</h2>
          <p className="updated">Last updated: April 2026</p>

          <h3>Data Controller</h3>
          <p>Jack Chen — <ContactEmail /> — Paris, France</p>

          <h3>What We Collect</h3>
          <table>
            <thead>
              <tr><th>Processing</th><th>Data</th><th>Legal basis</th><th>Retention</th></tr>
            </thead>
            <tbody>
              <tr><td>Server logs</td><td>IP address, browser</td><td>Legitimate interest</td><td>12 months</td></tr>
            </tbody>
          </table>

          <h3>Cookies</h3>
          <p>This site uses no tracking or advertising cookies.</p>

          <h3>Hosting</h3>
          <ul>
            <li>Cloudflare, Inc. (hosting, CDN) — USA — covered by the EU-US Data Privacy Framework</li>
            <li>Fontshare / Indian Type Foundry (web fonts) — India/USA — cdn.fontshare.com — IP address transmitted on each page load for font rendering</li>
          </ul>

          <h3>Your Rights</h3>
          <p>Under GDPR you have the right to access, rectify, erase, restrict, port, and object to your data. Contact: <ContactEmail />. You may also lodge a complaint with the CNIL (French data protection authority) at cnil.fr.</p>
        </div>
      </div>
    </main>
  );
}

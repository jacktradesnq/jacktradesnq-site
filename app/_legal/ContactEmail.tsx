// L'adresse de contact des pages légales.
// Cloudflare (Email Address Obfuscation) réécrit toute adresse visible en « [email protected] »,
// ce qui fait diverger le HTML de ce que React attend (erreur #418 à l'hydratation).
// Les commentaires email_off lui disent de laisser celle-ci intacte.
export const CONTACT_EMAIL = 'contact@jacktradesnq.com';

export default function ContactEmail() {
  return <span dangerouslySetInnerHTML={{ __html: `<!--email_off-->${CONTACT_EMAIL}<!--/email_off-->` }} />;
}

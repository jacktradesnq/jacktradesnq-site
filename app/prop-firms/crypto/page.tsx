import { redirect } from 'next/navigation';

// Plus aucun partenaire CFD/crypto depuis le 27/09 : la page renvoie au comparateur futures.
export default function PropFirmsCrypto() {
  redirect('/prop-firms/');
}

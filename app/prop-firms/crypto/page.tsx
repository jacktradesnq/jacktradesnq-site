import { redirect } from 'next/navigation';

// Les familles vivent sur /prop-firms depuis le 11/10 (choix Futures / Perps / CFD) : on ouvre la bonne.
export default function PropFirmsCrypto() {
  redirect('/prop-firms/#perps');
}

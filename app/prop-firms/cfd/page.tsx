import { redirect } from 'next/navigation';

// Plus de famille CFD depuis le 25/10/2026 (fin de l'affiliation Tradeify FX, sa seule firme) : l'ancienne URL mène à /prop-firms.
export default function PropFirmsCfd() {
  redirect('/prop-firms/');
}

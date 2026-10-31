import { redirect } from 'next/navigation';

// Le trade copier vit sur /prop-firms depuis le 31/10/2026, 3e bouton à côté de Futures et Perps
// (Angelo : « go merge les 2 », « ouais 3eme bouton ») : l'ancienne URL ouvre ce bouton.
export default function TradeCopier() {
  redirect('/prop-firms/#trade-copier');
}

import type { Metadata } from 'next';
import { SeriesBoard } from '../series-board';

export const metadata: Metadata = { title: 'Encyclopédie des cartes' };

export default function SeriesCardsPage() {
  return <SeriesBoard mode="cartes" />;
}

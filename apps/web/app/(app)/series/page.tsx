import type { Metadata } from 'next';
import { SeriesBoard } from './series-board';

export const metadata: Metadata = { title: 'Encyclopédie' };

export default function SeriesPage() {
  return <SeriesBoard mode="produits" />;
}

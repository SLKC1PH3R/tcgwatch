import type { Metadata } from 'next';
import { SeriesBoard } from '../series-board';

export const metadata: Metadata = { title: 'Encyclopédie des cartes' };

type Props = { searchParams: Promise<{ serie?: string }> };

export default async function SeriesCardsPage({ searchParams }: Props) {
  const { serie } = await searchParams;
  return <SeriesBoard mode="cartes" serie={serie} />;
}

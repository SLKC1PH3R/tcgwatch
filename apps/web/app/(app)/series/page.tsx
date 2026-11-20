import type { Metadata } from 'next';
import { SeriesBoard } from './series-board';

export const metadata: Metadata = { title: 'Encyclopédie' };

type Props = { searchParams: Promise<{ serie?: string }> };

export default async function SeriesPage({ searchParams }: Props) {
  const { serie } = await searchParams;
  return <SeriesBoard mode="produits" serie={serie} />;
}

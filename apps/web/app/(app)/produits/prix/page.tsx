import type { Metadata } from 'next';
import { PriceBoard } from './price-board';

export const metadata: Metadata = { title: 'Prix du scellé' };

type Props = { searchParams: Promise<{ serie?: string; tri?: string }> };

export default async function PricesPage({ searchParams }: Props) {
  const q = await searchParams;
  return <PriceBoard category={null} serie={q.serie} sort={q.tri} basePath="/produits/prix" />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PRICE_CATEGORIES } from '@tcgwatch/shared';
import { PriceBoard } from '../price-board';

type Props = {
  params: Promise<{ categorie: string }>;
  searchParams: Promise<{ serie?: string; tri?: string; p?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params;
  const category = PRICE_CATEGORIES.find((c) => c.key === categorie);
  return { title: category ? `Prix des ${category.label}` : 'Prix' };
}

export default async function CategoryPricesPage({ params, searchParams }: Props) {
  const [{ categorie }, q] = await Promise.all([params, searchParams]);
  const category = PRICE_CATEGORIES.find((c) => c.key === categorie);
  if (!category) notFound();
  return (
    <PriceBoard
      category={category}
      serie={q.serie}
      sort={q.tri}
      basePath={`/produits/prix/${category.key}`}
      picked={q.p}
    />
  );
}

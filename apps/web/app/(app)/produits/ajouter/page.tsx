import type { Metadata } from 'next';
import { getEnv } from '@tcgwatch/shared/env';
import { PageHeader } from '@/components/page-header';
import { getProductOptions, getReleaseOptions } from '@/lib/data/products';
import { AddUrlForm } from './add-url-form';

export const metadata: Metadata = { title: 'Ajouter une URL' };

export default async function AddUrlPage({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string }>;
}) {
  const [products, releases, { produit }] = await Promise.all([
    getProductOptions(),
    getReleaseOptions(),
    searchParams,
  ]);
  return (
    <>
      <PageHeader
        title="Suivre une fiche revendeur"
        description="Collez l’URL d’une fiche produit : le revendeur est détecté et l’adaptateur testé immédiatement."
      />
      <AddUrlForm
        products={products}
        releases={releases.map((r) => ({
          id: r.id,
          label: r.setCode ? `${r.nameFr} (${r.setCode})` : r.nameFr,
        }))}
        defaultInterval={getEnv().DEFAULT_CHECK_INTERVAL_MIN}
        preselectedProductId={produit}
      />
    </>
  );
}

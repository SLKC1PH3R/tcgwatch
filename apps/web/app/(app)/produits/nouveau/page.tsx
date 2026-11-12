import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getReleaseOptions } from '@/lib/data/products';
import { createProductAction } from '../actions';
import { ProductForm } from '../product-form';

export const metadata: Metadata = { title: 'Nouveau produit' };

export default async function NewProductPage() {
  const releases = await getReleaseOptions();
  return (
    <>
      <PageHeader
        title="Nouveau produit"
        description="Créez un produit scellé, puis ajoutez-y des fiches revendeurs."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ProductForm
            action={createProductAction}
            releases={releases.map((r) => ({
              id: r.id,
              label: r.setCode ? `${r.nameFr} (${r.setCode})` : r.nameFr,
            }))}
            submitLabel="Créer le produit"
          />
        </CardContent>
      </Card>
    </>
  );
}

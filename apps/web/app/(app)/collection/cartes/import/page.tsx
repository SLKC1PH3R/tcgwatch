import type { Metadata } from 'next';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { CollectionImporter } from './importer';

export const metadata: Metadata = { title: 'Importer une collection' };

/** Import d'une collection de cartes depuis un fichier CSV. */
export default async function ImportPage() {
  await requireUser();
  return (
    <FitPage>
      <PageHeader
        title="Importer une collection"
        description="Un fichier CSV exporté d’une autre application (Dragon Shield, Pokécardex…) ou un tableur maison : une ligne par carte, avec au moins le numéro et l’extension (nom français ou anglais, ou sigle comme « DRI »). Quantité, version (normale, reverse…) et prix d’achat sont repris s’ils sont présents. Vous vérifiez avant d’importer."
      />
      <CollectionImporter />
    </FitPage>
  );
}

import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { getCardReleases } from '@/lib/data/card-collection';
import { scanCoverage } from '@/lib/data/card-scan';
import { CardScanner } from './scanner';

export const metadata: Metadata = { title: 'Scanner de cartes' };

/** Ajout de cartes à la collection par la caméra (reconnaissance de l'illustration). */
export default async function ScannerPage() {
  await requireUser();
  const [releases, coverage] = await Promise.all([getCardReleases(), scanCoverage()]);
  const pct = coverage.total ? Math.round((coverage.hashed / coverage.total) * 100) : 0;
  return (
    <>
      <PageHeader
        title="Scanner de cartes"
        description={
          pct < 100
            ? `Reconnaissance en cours de préparation : ${pct} % des cartes sont déjà reconnaissables.`
            : 'Montre une carte à la caméra : elle est reconnue et ajoutée à ta collection en un geste.'
        }
      />
      <CardScanner releases={releases.map((r) => ({ code: r.tcgdexId!, name: r.nameFr }))} />
    </>
  );
}

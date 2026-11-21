import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Hors ligne' };

/** Affichée par le service worker quand une page n'est pas disponible sans réseau. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="font-display text-2xl font-bold">Pas de connexion</p>
        <p className="text-sm text-muted-foreground">
          Cette page a besoin du réseau. Ta collection reste consultable hors ligne (dernière
          version ouverte).
        </p>
        <div className="flex justify-center gap-3 text-sm font-semibold">
          <Link href="/collection" className="text-primary hover:underline">
            Collection scellée
          </Link>
          <Link href="/collection/cartes" className="text-primary hover:underline">
            Mes cartes
          </Link>
        </div>
      </div>
    </main>
  );
}

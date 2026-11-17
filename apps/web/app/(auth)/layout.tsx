import { BrandLogo } from '@/components/brand-logo';
import Image from 'next/image';
import { Suspense } from 'react';
import { CardRain } from './card-rain';

/** Cartes 30ᵉ Anniversaire (images Poképédia), décoratives. */
function CardImage({ src, priority = false }: { src: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      width={432}
      height={601}
      priority={priority}
      className="size-full rounded-xl bg-muted object-cover"
    />
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[radial-gradient(circle_at_70%_45%,#1e1f3a,var(--background)_65%)] p-12 lg:flex">
        <Suspense>
          <CardRain />
        </Suspense>
        <BrandLogo className="relative" />
        <div className="relative flex justify-center" aria-hidden>
          <div className="relative h-96 w-[22rem]">
            <div className="absolute top-10 left-0 h-72 w-52 -rotate-12 rounded-2xl bg-border p-1.5">
              <CardImage src="/cards/30e-anniversaire-b.webp" />
            </div>
            <div className="absolute top-10 right-0 h-72 w-52 rotate-12 rounded-2xl bg-border p-1.5">
              <CardImage src="/cards/30e-anniversaire-r.webp" />
            </div>
            <div className="holo-fill absolute top-2 left-[4.5rem] h-72 w-52 rounded-2xl p-1.5 shadow-[0_30px_80px_rgba(139,124,255,0.4)]">
              <CardImage src="/cards/30e-anniversaire-g.webp" priority />
            </div>
          </div>
        </div>
        <div className="relative max-w-md space-y-3">
          <p className="font-display text-2xl leading-tight font-bold">
            Suivi des produits scellés Pokémon TCG
          </p>
          <p className="leading-relaxed text-muted-foreground">
            Sorties FR, stock et prix chez les revendeurs, alertes et valeur de votre collection.
            Aucun achat automatique.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden">
            <BrandLogo size="lg" />
            <p className="mt-1 text-sm text-muted-foreground">
              Suivi des produits scellés Pokémon TCG
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

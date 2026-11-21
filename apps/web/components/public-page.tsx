import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { SiteFooter } from '@/components/site-footer';
import { cn } from '@/lib/utils';

/** Gabarit des pages publiques (légal, méthode, guides) : en-tête simple, texte, pied de page. */
export function PublicPage({
  title,
  intro,
  updated,
  children,
  wide = false,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" aria-label="TCGWatch, accueil">
          <BrandLogo />
        </Link>
      </header>
      <main
        className={cn(
          'mx-auto w-full flex-1 px-4 pt-6 pb-16 md:px-8',
          wide ? 'max-w-5xl' : 'max-w-3xl',
        )}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {intro && <p className="mt-3 text-lg text-muted-foreground">{intro}</p>}
        {updated && <p className="mt-2 text-xs text-muted-foreground">Mise à jour : {updated}</p>}
        <div className="prose-tcg mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

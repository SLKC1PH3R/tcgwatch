import Link from 'next/link';

/** Pied de page public : pages légales et méthode. */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
        <p>TCGWatch n’est pas affilié à The Pokémon Company, Nintendo ou aux boutiques citées.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/methode" className="hover:text-foreground">
            Méthode
          </Link>
          <Link href="/guides" className="hover:text-foreground">
            Guides
          </Link>
          <Link href="/mentions-legales" className="hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/cgu" className="hover:text-foreground">
            CGU
          </Link>
          <Link href="/confidentialite" className="hover:text-foreground">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { MainNav } from '@/components/main-nav';
import { MobileNav } from '@/components/mobile-nav';
import { PageTrail } from '@/components/page-trail';
import { SearchBox } from '@/components/search-box';
import { logoutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        {/* Pleine largeur : logo à gauche, menu centré, recherche et compte à droite.
            Les colonnes latérales ne descendent jamais sous leur contenu : faute de place,
            le menu se décale un peu plutôt que de déborder. */}
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-8 md:py-4 2xl:grid 2xl:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)]">
          <Link
            href="/"
            className="font-display text-xl font-extrabold tracking-tight text-foreground 2xl:justify-self-start"
          >
            TCG<span className="text-primary">Watch</span>
          </Link>
          {/* Menu ordinateur ; sur mobile, il s'ouvre en plein écran depuis le bouton Menu. */}
          <div className="order-last hidden w-full lg:block 2xl:order-none 2xl:w-auto">
            <Suspense>
              <MainNav />
            </Suspense>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 2xl:justify-self-end">
            <Suspense>
              <SearchBox className="w-36 sm:w-56 xl:w-48 2xl:w-56" />
            </Suspense>
            <span
              className="hidden max-w-40 truncate text-sm text-muted-foreground xl:inline"
              title={user.email}
            >
              {user.name ?? user.email}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter">
                <LogOut />
              </Button>
            </form>
            <Suspense>
              <MobileNav />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <Suspense>
          <PageTrail />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

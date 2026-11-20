import { Bell, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { prisma } from '@tcgwatch/db';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { BrandLogo } from '@/components/brand-logo';
import { MainNav } from '@/components/main-nav';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { parseTheme } from '@/lib/theme';
import { PageTrail } from '@/components/page-trail';
import { SearchBox } from '@/components/search-box';
import { logoutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.alertEvent.count({ where: { acknowledged: false } });
  const theme = parseTheme((await cookies()).get('theme')?.value);
  return (
    // Une page qui porte data-fit-screen (l'accueil) occupe exactement la hauteur de l'écran
    // sur un écran assez grand : en-tête + contenu, sans défilement de la page.
    <div className="flex min-h-dvh flex-col fit:has-[[data-fit-screen]]:h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        {/* Pleine largeur : logo à gauche, menu centré, recherche et compte à droite.
            Les colonnes latérales ne descendent jamais sous leur contenu : faute de place,
            le menu se décale un peu plutôt que de déborder. */}
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:gap-x-5 md:px-8 md:py-4 2xl:grid 2xl:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)]">
          <Link href="/" aria-label="TCGWatch, accueil" className="2xl:justify-self-start">
            <BrandLogo compact />
          </Link>
          {/* Menu ordinateur ; sur mobile, il s'ouvre en plein écran depuis le bouton Menu. */}
          <div className="order-last hidden w-full lg:block 2xl:order-none 2xl:w-auto">
            <Suspense>
              <MainNav />
            </Suspense>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 2xl:justify-self-end">
            <Suspense>
              <SearchBox className="w-32 sm:w-56 xl:w-48 2xl:w-56" />
            </Suspense>
            <ThemeToggle initial={theme} />
            <Link
              href="/alertes"
              aria-label={unread > 0 ? `Alertes, ${unread} pas encore vues` : 'Alertes'}
              title="Alertes"
              className="relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <span
              className="hidden max-w-40 truncate text-sm text-muted-foreground xl:inline"
              title={user.email}
            >
              {user.name ?? user.email}
            </span>
            {/* Sur mobile, la déconnexion est en bas du menu plein écran. */}
            <form action={logoutAction} className="hidden lg:block">
              <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter">
                <LogOut />
              </Button>
            </form>
            <Suspense>
              <MobileNav
                footer={
                  <form
                    action={logoutAction}
                    className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {user.name ?? user.email}
                    </span>
                    <Button type="submit" variant="outline" size="sm">
                      <LogOut />
                      Se déconnecter
                    </Button>
                  </form>
                }
              />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10 fit:has-[[data-fit-screen]]:flex fit:has-[[data-fit-screen]]:min-h-0 fit:has-[[data-fit-screen]]:max-w-[1680px] fit:has-[[data-fit-screen]]:flex-1 fit:has-[[data-fit-screen]]:flex-col fit:has-[[data-fit-screen]]:py-5">
        <Suspense>
          <PageTrail />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

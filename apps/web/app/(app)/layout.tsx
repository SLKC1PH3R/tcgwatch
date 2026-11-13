import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { MainNav } from '@/components/main-nav';
import { SearchBox } from '@/components/search-box';
import { logoutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 md:px-8 md:py-4">
          <Link
            href="/"
            className="font-display text-xl font-extrabold tracking-tight text-foreground"
          >
            TCG<span className="text-primary">Watch</span>
          </Link>
          <div className="order-last w-full xl:order-none xl:w-auto xl:flex-1">
            <MainNav />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Suspense>
              <SearchBox className="w-44 sm:w-56 xl:w-48 2xl:w-56" />
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
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}

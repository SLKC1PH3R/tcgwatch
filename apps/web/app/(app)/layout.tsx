import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { MainNav } from '@/components/main-nav';
import { logoutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur md:h-dvh md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:flex-col md:items-stretch md:py-5">
          <div className="flex items-center gap-2 font-semibold md:px-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
              TW
            </span>
            TCGWatch
          </div>
          <form action={logoutAction} className="md:hidden">
            <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter">
              <LogOut />
            </Button>
          </form>
        </div>
        <MainNav />
        <div className="absolute inset-x-0 bottom-0 hidden border-t p-4 md:block">
          <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
          {user.name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <form action={logoutAction} className="mt-2">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <LogOut /> Se déconnecter
            </Button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

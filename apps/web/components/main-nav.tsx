'use client';

import { CalendarDays, ChartLine, LayoutDashboard, Package, Store, Vault } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { href: '/produits', label: 'Produits suivis', icon: Package },
  { href: '/revendeurs', label: 'Revendeurs', icon: Store },
  { href: '/collection', label: 'Ma collection', icon: Vault },
  { href: '/marche', label: 'Marché', icon: ChartLine },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full border bg-popover p-1 [&::-webkit-scrollbar]:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              active && 'bg-foreground text-background hover:bg-foreground hover:text-background',
            )}
          >
            <Icon className="size-4 xl:hidden" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

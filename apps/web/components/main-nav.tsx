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
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:px-3 md:pb-0">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

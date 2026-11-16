'use client';

import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChartLine,
  LayoutDashboard,
  Package,
  PackageCheck,
  Store,
  Vault,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Accueil', icon: LayoutDashboard },
  { href: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { href: '/series', label: 'Encyclopédie', icon: BookOpen, also: ['/extensions', '/cartes'] },
  { href: '/produits', label: 'Produits', icon: Package },
  { href: '/retours-en-stock', label: 'Retours en stock', icon: PackageCheck },
  { href: '/revendeurs', label: 'Revendeurs', icon: Store },
  { href: '/collection', label: 'Collection', icon: Vault },
  { href: '/marche', label: 'Marché', icon: ChartLine },
  {
    href: '/calculateurs/rentabilite',
    label: 'Calculateurs',
    icon: Calculator,
    also: ['/calculateurs'],
  },
] as { href: string; label: string; icon: typeof Package; also?: string[] }[];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full border bg-popover p-1 [&::-webkit-scrollbar]:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon, also = [] }) => {
        const active =
          href === '/' ? pathname === '/' : [href, ...also].some((h) => pathname.startsWith(h));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              active && 'bg-foreground text-background hover:bg-foreground hover:text-background',
            )}
          >
            <Icon className="size-4 lg:hidden" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

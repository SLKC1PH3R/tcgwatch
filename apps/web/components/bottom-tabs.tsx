'use client';

import { Home, Layers, PackageCheck, ScanLine, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Accueil', icon: Home, active: (p: string) => p === '/' },
  {
    href: '/retours-en-stock',
    label: 'Restocks',
    icon: PackageCheck,
    active: (p: string) => p.startsWith('/retours-en-stock'),
  },
  {
    href: '/collection/cartes/scanner',
    label: 'Scanner',
    icon: ScanLine,
    active: (p: string) => p.startsWith('/collection/cartes/scanner'),
  },
  {
    href: '/collection/cartes',
    label: 'Mes cartes',
    icon: Layers,
    active: (p: string) =>
      p.startsWith('/collection/cartes') && !p.startsWith('/collection/cartes/scanner'),
  },
  {
    href: '/profil',
    label: 'Profil',
    icon: UserRound,
    active: (p: string) =>
      p.startsWith('/profil') ||
      p === '/collection' ||
      (p.startsWith('/collection/') && !p.startsWith('/collection/cartes')),
  },
];

/** Barre d'onglets en bas de l'écran sur téléphone et tablette : les pages les plus utilisées. */
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Raccourcis"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const on = t.active(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors',
                  on && 'text-primary',
                )}
              >
                <t.icon className={cn('size-5', on && 'stroke-[2.5]')} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

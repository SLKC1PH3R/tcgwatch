'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PRICE_CATEGORIES } from '@tcgwatch/shared';
import { cn } from '@/lib/utils';

interface Item {
  href: string;
  label: string;
  /** Actif quand ce test passe (sinon : chemin identique). */
  active?: (path: string, params: URLSearchParams) => boolean;
}
interface Group {
  label?: string;
  items: Item[];
}
interface Section {
  label: string;
  match: (path: string) => boolean;
  groups: Group[];
}

const exact = (href: string) => (path: string) => path === href;

const SECTIONS: Section[] = [
  {
    label: 'Produits',
    match: (p) => p.startsWith('/produits'),
    groups: [
      {
        items: [
          {
            href: '/produits',
            label: 'Produits suivis',
            // Liste et fiches produit (/produits/<id>), pas les pages Prix ni Bons plans.
            active: (p) =>
              p === '/produits' ||
              (/^\/produits\/[^/]+$/.test(p) &&
                !['/produits/prix', '/produits/bons-plans'].includes(p)),
          },
        ],
      },
      {
        label: 'Prix',
        items: [
          { href: '/produits/prix', label: 'Voir tout', active: exact('/produits/prix') },
          ...PRICE_CATEGORIES.map((c) => ({
            href: `/produits/prix/${c.key}`,
            label: c.label,
            active: exact(`/produits/prix/${c.key}`),
          })),
          {
            href: '/produits/prix/cartes',
            label: 'Cartes à l’unité',
            active: exact('/produits/prix/cartes'),
          },
        ],
      },
      { items: [{ href: '/produits/bons-plans', label: 'Bons plans' }] },
    ],
  },
  {
    label: 'Encyclopédie',
    match: (p) => ['/series', '/extensions', '/cartes'].some((h) => p.startsWith(h)),
    groups: [
      {
        items: [
          {
            href: '/series',
            label: 'Par produit',
            active: (p, q) =>
              p === '/series' || (p.startsWith('/extensions') && q.get('onglet') !== 'cartes'),
          },
          {
            href: '/series/cartes',
            label: 'Par cartes',
            active: (p, q) =>
              p === '/series/cartes' ||
              p.startsWith('/cartes') ||
              (p.startsWith('/extensions') && q.get('onglet') === 'cartes'),
          },
        ],
      },
    ],
  },
  {
    label: 'Marché',
    match: (p) => p.startsWith('/marche'),
    groups: [
      {
        items: [
          { href: '/marche', label: 'Prix du marché' },
          { href: '/marche/indice', label: 'Indice du marché' },
        ],
      },
    ],
  },
  {
    label: 'Calculateurs',
    match: (p) => p.startsWith('/calculateurs'),
    groups: [
      {
        items: [
          { href: '/calculateurs/rentabilite', label: 'Rentabilité d’une ouverture' },
          { href: '/calculateurs/budget', label: 'Que acheter avec mon budget ?' },
        ],
      },
    ],
  },
];

/** Sous-menu de la section courante (Produits, Encyclopédie, Marché, Calculateurs). */
export function SectionNav() {
  const path = usePathname();
  const params = useSearchParams();
  const section = SECTIONS.find((s) => s.match(path));
  if (!section) return null;
  return (
    <nav
      aria-label={`Sous-menu ${section.label}`}
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-4"
    >
      {section.groups.map((g, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          {i > 0 && <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />}
          {g.label && (
            <span className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.label}
            </span>
          )}
          {g.items.map((item) => {
            const active = item.active ? item.active(path, params) : path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
                  active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

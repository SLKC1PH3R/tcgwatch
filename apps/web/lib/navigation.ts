import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChartLine,
  LayoutDashboard,
  Package,
  Store,
  Vault,
  type LucideIcon,
} from 'lucide-react';
import { PRICE_CATEGORIES } from '@tcgwatch/shared';

/**
 * Plan du site : une seule source pour le menu principal (ordinateur), le menu mobile
 * et le fil d'Ariane des pages.
 */

export interface NavLink {
  href: string;
  label: string;
  /** Une ligne d'explication sous le libellé, dans les sous-menus. */
  hint?: string;
  /** Actif quand ce test passe (sinon : chemin identique). */
  active?: (path: string, params: URLSearchParams) => boolean;
}

export interface NavGroup {
  label?: string;
  /** Liens affichés en pastilles compactes (ex. types de produit). */
  compact?: boolean;
  items: NavLink[];
}

export interface NavEntry {
  label: string;
  icon: LucideIcon;
  /** Lien direct (entrée sans sous-menu). */
  href?: string;
  /** Section à laquelle appartient la page courante. */
  match: (path: string) => boolean;
  groups?: NavGroup[];
}

const exact = (href: string) => (path: string) => path === href;
const isProductSheet = (p: string) =>
  /^\/produits\/[^/]+$/.test(p) &&
  !['/produits/prix', '/produits/bons-plans', '/produits/mes-produits'].includes(p);

export const NAV: NavEntry[] = [
  { label: 'Accueil', icon: LayoutDashboard, href: '/', match: (p) => p === '/' },
  {
    label: 'Calendrier',
    icon: CalendarDays,
    href: '/calendrier',
    match: (p) => p.startsWith('/calendrier'),
  },
  {
    label: 'Produits',
    icon: Package,
    match: (p) =>
      p.startsWith('/produits') || p.startsWith('/retours-en-stock') || p.startsWith('/alertes'),
    groups: [
      {
        label: 'Suivi',
        items: [
          {
            href: '/produits',
            label: 'Produits suivis',
            hint: 'Stock et meilleur prix chez chaque revendeur',
            active: (p) => p === '/produits' || isProductSheet(p),
          },
          {
            href: '/produits/mes-produits',
            label: 'Mes produits',
            hint: 'Ton bon prix, les annonces et les alertes',
            active: exact('/produits/mes-produits'),
          },
          {
            href: '/retours-en-stock',
            label: 'Retours en stock',
            hint: 'Les dernières remises en vente',
            active: (p) => p.startsWith('/retours-en-stock'),
          },
          {
            href: '/alertes',
            label: 'Alertes',
            hint: 'Tout ce qui t’a été envoyé, et les réglages',
            active: (p) => p.startsWith('/alertes'),
          },
          {
            href: '/produits/bons-plans',
            label: 'Bons plans',
            hint: 'Offres sous la cote ou sous le prix public',
            active: exact('/produits/bons-plans'),
          },
        ],
      },
      {
        label: 'Prix par type',
        compact: true,
        items: [
          { href: '/produits/prix', label: 'Tous les types', active: exact('/produits/prix') },
          ...PRICE_CATEGORIES.map((c) => ({
            href: `/produits/prix/${c.key}`,
            label: c.label,
            hint: c.title,
            active: exact(`/produits/prix/${c.key}`),
          })),
          {
            href: '/produits/prix/cartes',
            label: 'Cartes à l’unité',
            hint: 'Cote des cartes',
            active: exact('/produits/prix/cartes'),
          },
        ],
      },
    ],
  },
  {
    label: 'Encyclopédie',
    icon: BookOpen,
    match: (p) => ['/series', '/extensions', '/cartes'].some((h) => p.startsWith(h)),
    groups: [
      {
        items: [
          {
            href: '/series',
            label: 'Par produit',
            hint: 'Séries, extensions et leurs produits scellés',
            active: (p, q) =>
              p === '/series' || (p.startsWith('/extensions') && q.get('onglet') !== 'cartes'),
          },
          {
            href: '/series/cartes',
            label: 'Par cartes',
            hint: 'Valeur des cartes de chaque extension',
            active: (p, q) =>
              p === '/series/cartes' ||
              p.startsWith('/cartes') ||
              (p.startsWith('/extensions') && q.get('onglet') === 'cartes'),
          },
          {
            href: '/guides',
            label: 'Guides',
            hint: 'Repérer les faux, scellé ou cartes, FR ou JP',
            active: (p) => p.startsWith('/guides'),
          },
          {
            href: '/methode',
            label: 'Méthode',
            hint: 'D’où viennent les prix et comment ils sont calculés',
            active: (p) => p.startsWith('/methode'),
          },
        ],
      },
    ],
  },
  {
    label: 'Marché',
    icon: ChartLine,
    match: (p) => p.startsWith('/marche'),
    groups: [
      {
        items: [
          {
            href: '/marche',
            label: 'Prix du marché',
            hint: 'Cote des produits et des cartes phares',
            active: (p) => p.startsWith('/marche') && !p.startsWith('/marche/indice'),
          },
          {
            href: '/marche/indice',
            label: 'Indice du marché',
            hint: 'Tendance globale, plus fortes hausses et baisses',
            active: (p) => p.startsWith('/marche/indice'),
          },
        ],
      },
    ],
  },
  {
    label: 'Collection',
    icon: Vault,
    match: (p) => p.startsWith('/collection'),
    groups: [
      {
        label: 'Produits scellés',
        items: [
          {
            href: '/collection',
            label: 'Tout mon scellé',
            hint: 'Valeur, plus-value et achats',
            active: (p, q) => p === '/collection' && !q.get('categorie'),
          },
        ],
      },
      {
        label: 'Scellé par type',
        compact: true,
        items: PRICE_CATEGORIES.map((c) => ({
          href: `/collection?categorie=${c.key}`,
          label: c.label,
          active: (p: string, q: URLSearchParams) =>
            p === '/collection' && q.get('categorie') === c.key,
        })),
      },
      {
        label: 'Cartes',
        items: [
          {
            href: '/collection/cartes',
            label: 'Mes cartes',
            hint: 'Valeur et avancement par extension',
            active: exact('/collection/cartes'),
          },
          {
            href: '/collection/cartes/ajout-rapide',
            label: 'Ajout rapide',
            hint: 'Toutes les cartes d’une extension, en quelques touchers',
            active: exact('/collection/cartes/ajout-rapide'),
          },
          {
            href: '/collection/cartes/classeurs',
            label: 'Classeurs',
            hint: 'Par extension ou personnels, 9 cartes par page',
            active: (p) => p.startsWith('/collection/cartes/classeurs'),
          },
          {
            href: '/collection/cartes/vitrines',
            label: 'Vitrines',
            hint: 'Tes plus belles cartes, à partager par un lien',
            active: (p) => p.startsWith('/collection/cartes/vitrines'),
          },
        ],
      },
    ],
  },
  {
    label: 'Revendeurs',
    icon: Store,
    href: '/revendeurs',
    match: (p) => p.startsWith('/revendeurs'),
  },
  {
    label: 'Calculateurs',
    icon: Calculator,
    match: (p) => p.startsWith('/calculateurs'),
    groups: [
      {
        items: [
          {
            href: '/calculateurs/rentabilite',
            label: 'Rentabilité d’une ouverture',
            hint: 'Ouvrir un produit ou le garder scellé ?',
            active: (p) => p.startsWith('/calculateurs/rentabilite'),
          },
          {
            href: '/calculateurs/budget',
            label: 'Quoi acheter avec mon budget ?',
            hint: 'Les meilleurs achats pour une somme donnée',
            active: (p) => p.startsWith('/calculateurs/budget'),
          },
        ],
      },
    ],
  },
];

export function isLinkActive(link: NavLink, path: string, params: URLSearchParams) {
  return link.active ? link.active(path, params) : path === link.href;
}

/** Section et sous-page courantes, pour le fil d'Ariane. */
export function currentLocation(path: string, params: URLSearchParams) {
  const entry = NAV.find((e) => e.match(path));
  if (!entry?.groups) return null;
  for (const group of entry.groups) {
    const link = group.items.find((l) => isLinkActive(l, path, params));
    if (link) return { entry, group, link };
  }
  return { entry, group: undefined, link: undefined };
}

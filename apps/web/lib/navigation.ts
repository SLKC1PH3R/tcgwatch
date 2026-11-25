import {
  Activity,
  BadgePercent,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  ChartLine,
  FileUp,
  FlaskConical,
  GraduationCap,
  HandCoins,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Library,
  ListChecks,
  Package,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  Receipt,
  ScanLine,
  Sparkles,
  Star,
  Store,
  UserRound,
  Vault,
  Wallet,
  Wrench,
  Zap,
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
  /** Pictogramme du lien dans les sous-menus. */
  icon?: LucideIcon;
  /** Une ligne d'explication sous le libellé, dans les sous-menus. */
  hint?: string;
  /** Actif quand ce test passe (sinon : chemin identique). */
  active?: (path: string, params: URLSearchParams) => boolean;
}

export interface NavGroup {
  label?: string;
  /** Liens affichés en pastilles compactes (ex. types de produit). */
  compact?: boolean;
  /** Dans un menu à plus de deux groupes : groupe placé dans la colonne de droite. */
  side?: boolean;
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
/** Pages d'ajout de cartes (menu Cartes) ; le reste de /collection va dans Mon profil. */
const CARD_ADD_PAGES = [
  '/collection/cartes/ajout-rapide',
  '/collection/cartes/import',
  '/collection/cartes/scanner',
];
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
    label: 'Scellé',
    icon: Package,
    match: (p) =>
      (p.startsWith('/produits') && !p.startsWith('/produits/prix')) ||
      p.startsWith('/retours-en-stock') ||
      p.startsWith('/alertes'),
    groups: [
      {
        label: 'Suivre et acheter',
        items: [
          {
            href: '/produits',
            label: 'Produits suivis',
            icon: PackageSearch,
            hint: 'Stock et meilleur prix chez chaque revendeur',
            active: (p) => p === '/produits' || isProductSheet(p),
          },
          {
            href: '/produits/mes-produits',
            label: 'Mes produits',
            icon: Star,
            hint: 'Ton bon prix, les annonces et les alertes',
            active: exact('/produits/mes-produits'),
          },
          {
            href: '/retours-en-stock',
            label: 'Retours en stock',
            icon: PackageCheck,
            hint: 'Les dernières remises en vente',
            active: (p) => p.startsWith('/retours-en-stock'),
          },
          {
            href: '/produits/bons-plans',
            label: 'Bons plans',
            icon: BadgePercent,
            hint: 'Offres sous la cote ou sous le prix public',
            active: exact('/produits/bons-plans'),
          },
          {
            href: '/alertes',
            label: 'Alertes',
            icon: Bell,
            hint: 'Tout ce qui t’a été envoyé, et les réglages',
            active: (p) => p.startsWith('/alertes'),
          },
        ],
      },
    ],
  },
  {
    label: 'Cartes',
    icon: Layers,
    match: (p) => CARD_ADD_PAGES.some((h) => p.startsWith(h)),
    groups: [
      {
        label: 'Ajouter des cartes',
        items: [
          {
            href: '/collection/cartes/ajout-rapide',
            label: 'Ajout rapide',
            icon: Zap,
            hint: 'Toutes les cartes d’une extension, en quelques touchers',
            active: exact('/collection/cartes/ajout-rapide'),
          },
          {
            href: '/collection/cartes/import',
            label: 'Importer un fichier',
            icon: FileUp,
            hint: 'Une collection exportée en CSV (Dragon Shield, tableur…)',
            active: exact('/collection/cartes/import'),
          },
          {
            href: '/collection/cartes/scanner',
            label: 'Scanner',
            icon: ScanLine,
            hint: 'Par la caméra ou des photos, une carte ou en rafale',
            active: exact('/collection/cartes/scanner'),
          },
        ],
      },
    ],
  },
  {
    label: 'Marché',
    icon: ChartLine,
    match: (p) => p.startsWith('/marche') || p.startsWith('/produits/prix'),
    groups: [
      {
        label: 'Tendances',
        items: [
          {
            href: '/marche',
            label: 'Prix du marché',
            icon: ChartLine,
            hint: 'Cote des produits et des cartes phares',
            active: (p) => p.startsWith('/marche') && !p.startsWith('/marche/indice'),
          },
          {
            href: '/marche/indice',
            label: 'Indice du marché',
            icon: Activity,
            hint: 'Tendance globale, plus fortes hausses et baisses',
            active: (p) => p.startsWith('/marche/indice'),
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
    match: (p) =>
      ['/series', '/extensions', '/cartes', '/guides', '/methode'].some((h) => p.startsWith(h)),
    groups: [
      {
        items: [
          {
            href: '/series',
            label: 'Par produit',
            icon: Package,
            hint: 'Séries, extensions et leurs produits scellés',
            active: (p, q) =>
              p === '/series' || (p.startsWith('/extensions') && q.get('onglet') !== 'cartes'),
          },
          {
            href: '/series/cartes',
            label: 'Par cartes',
            icon: Layers,
            hint: 'Valeur des cartes de chaque extension',
            active: (p, q) =>
              p === '/series/cartes' ||
              p.startsWith('/cartes') ||
              (p.startsWith('/extensions') && q.get('onglet') === 'cartes'),
          },
          {
            href: '/guides',
            label: 'Guides',
            icon: GraduationCap,
            hint: 'Repérer les faux, scellé ou cartes, FR ou JP',
            active: (p) => p.startsWith('/guides'),
          },
          {
            href: '/methode',
            label: 'Méthode',
            icon: FlaskConical,
            hint: 'D’où viennent les prix et comment ils sont calculés',
            active: (p) => p.startsWith('/methode'),
          },
        ],
      },
    ],
  },
  {
    label: 'Outils',
    icon: Wrench,
    match: (p) => p.startsWith('/revendeurs') || p.startsWith('/calculateurs'),
    groups: [
      {
        label: 'Boutiques',
        items: [
          {
            href: '/revendeurs',
            label: 'Revendeurs',
            icon: Store,
            hint: 'Boutiques suivies, frais de port et fiabilité',
            active: (p) => p.startsWith('/revendeurs'),
          },
        ],
      },
      {
        label: 'Calculateurs',
        items: [
          {
            href: '/calculateurs/rentabilite',
            label: 'Ouvrir ou garder ?',
            icon: Calculator,
            hint: 'Rentabilité d’une ouverture face au scellé',
            active: (p) => p.startsWith('/calculateurs/rentabilite'),
          },
          {
            href: '/calculateurs/budget',
            label: 'Quoi acheter avec mon budget ?',
            icon: Wallet,
            hint: 'Les meilleurs achats pour une somme donnée',
            active: (p) => p.startsWith('/calculateurs/budget'),
          },
        ],
      },
    ],
  },
  {
    label: 'Mon profil',
    icon: UserRound,
    match: (p) =>
      p.startsWith('/profil') ||
      (p.startsWith('/collection') && !CARD_ADD_PAGES.some((h) => p.startsWith(h))),
    groups: [
      {
        label: 'Ma collection de cartes',
        items: [
          {
            href: '/collection/cartes',
            label: 'Mes cartes',
            icon: LayoutGrid,
            hint: 'Valeur et avancement par extension',
            active: exact('/collection/cartes'),
          },
          {
            href: '/collection/cartes/classeurs',
            label: 'Classeurs',
            icon: Library,
            hint: 'Full Set, Master Set ou personnels',
            active: (p) => p.startsWith('/collection/cartes/classeurs'),
          },
          {
            href: '/collection/cartes/manquantes',
            label: 'Ce qu’il me manque',
            icon: ListChecks,
            hint: 'Cartes manquantes et coût pour compléter un set',
            active: exact('/collection/cartes/manquantes'),
          },
          {
            href: '/collection/cartes/achats',
            label: 'Achats et plus-value',
            icon: Receipt,
            hint: 'Lots, cartes achetées à l’unité et leur valeur',
            active: exact('/collection/cartes/achats'),
          },
          {
            href: '/collection/cartes/vitrines',
            label: 'Vitrines',
            icon: Sparkles,
            hint: 'Tes plus belles cartes, à partager par un lien',
            active: (p) => p.startsWith('/collection/cartes/vitrines'),
          },
        ],
      },
      {
        label: 'Mon profil',
        side: true,
        items: [
          {
            href: '/profil',
            label: 'Mon profil',
            icon: UserRound,
            hint: 'Ta page de collectionneur, à personnaliser et partager',
            active: (p) => p.startsWith('/profil'),
          },
        ],
      },
      {
        label: 'Ma collection scellée',
        side: true,
        items: [
          {
            href: '/collection',
            label: 'Mon scellé',
            icon: Vault,
            hint: 'Valeur, plus-value, achats et reventes',
            active: exact('/collection'),
          },
          {
            href: '/collection/bilan',
            label: 'Bilan des reventes',
            icon: HandCoins,
            hint: 'Plus-values réalisées de l’année, en CSV ou PDF',
            active: (p) => p.startsWith('/collection/bilan'),
          },
          {
            href: '/collection/ouvertures',
            label: 'Ouvertures',
            icon: PackageOpen,
            hint: 'Ce qu’un display ou un ETB ouvert a rapporté',
            active: (p) => p.startsWith('/collection/ouvertures'),
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

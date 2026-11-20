/**
 * Pages « plein écran » : sur un écran assez grand (variante Tailwind `fit`), la page tient en
 * hauteur sans défiler. Elle porte `data-fit-screen` (voir FitPage) ; ses cartes prennent la
 * hauteur de leur case et ce qui dépasse défile à l'intérieur, avec un fondu en bas. Sur mobile
 * et sur les écrans bas, rien ne change : la page défile normalement.
 */

/** Grille principale : prend la hauteur restante sous l'en-tête. */
export const fitGrid = 'grid gap-4 fit:min-h-0 fit:flex-1 [&>*]:min-w-0';

/** Colonne de cartes empilées dans une case de la grille. */
export const fitColumn = 'flex min-w-0 flex-col gap-4 fit:min-h-0';

/** Carte qui suit la hauteur de sa case (à combiner avec un contenu `fitScroll`). */
export const fitCard = 'gap-3 py-5 fit:min-h-0 fit:overflow-hidden';

/** Contenu de carte qui défile quand il dépasse, avec un fondu en bas. */
export const fitScroll =
  'fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pb-3 fit:[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.75rem),transparent)]';

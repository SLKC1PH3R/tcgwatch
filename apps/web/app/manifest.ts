import type { MetadataRoute } from 'next';

/** Appli installable (écran d'accueil, bureau) : plein écran, icônes, raccourcis. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TCGWatch — Pokémon JCC',
    short_name: 'TCGWatch',
    description:
      'Stocks et prix des produits Pokémon JCC chez les boutiques françaises, alertes de restock, collection et cote des cartes.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0c0d16',
    theme_color: '#0c0d16',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Alertes', url: '/alertes' },
      { name: 'Ma collection', url: '/collection' },
      { name: 'Scanner une carte', url: '/collection/cartes/scanner' },
      { name: 'Ajout rapide de cartes', url: '/collection/cartes/ajout-rapide' },
    ],
  };
}

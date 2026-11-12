import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'TCGWatch', template: '%s · TCGWatch' },
  description: 'Dashboard self-hosted de suivi des produits scellés Pokémon TCG (FR).',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0c0d16',
  colorScheme: 'dark',
};

// Toutes les pages lisent la base et la session : aucun rendu statique au build.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

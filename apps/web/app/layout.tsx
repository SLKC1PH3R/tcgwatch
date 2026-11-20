import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import { parseTheme } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'TCGWatch', template: '%s · TCGWatch' },
  description: 'Dashboard self-hosted de suivi des produits scellés Pokémon TCG (FR).',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0c0d16' },
    { media: '(prefers-color-scheme: light)', color: '#f5f6fb' },
  ],
};

// Toutes les pages lisent la base et la session : aucun rendu statique au build.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Thème choisi dans l'en-tête (cookie) : posé côté serveur, sans flash au chargement.
  const theme = parseTheme((await cookies()).get('theme')?.value);
  return (
    <html lang="fr" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}

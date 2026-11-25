import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vérification optimiste : sans cookie de session, redirection vers /connexion.
 * La validation réelle (session en base, expiration) est faite côté serveur par requireUser().
 */
// /cards : illustrations de la page de connexion (fichiers statiques de public/).
// /vitrine : vitrines de cartes partagées par lien (seulement celles rendues publiques).
// /collectionneur : pages publiques de collectionneur (seulement celles activées).
// /mot-de-passe, /verifier-email, /api/auth : récupération du compte et connexion Google.
const PUBLIC_PATHS = [
  '/connexion',
  '/inscription',
  '/mot-de-passe',
  '/verifier-email',
  '/api/auth',
  '/api/health',
  '/cards',
  '/vitrine',
  '/collectionneur',
  // Appli installable : service worker, manifeste, icônes, page hors-ligne.
  '/sw.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/hors-ligne',
  // Pages publiques : accueil des visiteurs, légal, méthode, guides.
  '/bienvenue',
  '/mentions-legales',
  '/cgu',
  '/confidentialite',
  '/methode',
  '/guides',
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.has('tcgwatch_session')) {
    const url = request.nextUrl.clone();
    // Visiteur sur l'accueil : la présentation du site ; ailleurs, la connexion.
    url.pathname = pathname === '/' ? '/bienvenue' : '/connexion';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};

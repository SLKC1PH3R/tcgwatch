import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vérification optimiste : sans cookie de session, redirection vers /connexion.
 * La validation réelle (session en base, expiration) est faite côté serveur par requireUser().
 */
// /cards : illustrations de la page de connexion (fichiers statiques de public/).
// /vitrine : vitrines de cartes partagées par lien (seulement celles rendues publiques).
const PUBLIC_PATHS = ['/connexion', '/inscription', '/api/health', '/cards', '/vitrine'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.has('tcgwatch_session')) {
    const url = request.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};

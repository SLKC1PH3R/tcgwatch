import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getEnv } from '@tcgwatch/shared/env';
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleEnabled } from '@/lib/google-oauth';

/** Départ de la connexion Google : état anti-CSRF en cookie, puis redirection vers Google. */
export async function GET(request: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL('/connexion', request.url));
  const next = new URL(request.url).searchParams.get('next') ?? '/';
  const state = randomBytes(16).toString('base64url');
  (await cookies()).set(GOOGLE_STATE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    secure: getEnv().COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}

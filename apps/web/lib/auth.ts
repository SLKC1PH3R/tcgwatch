import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { prisma } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';

export const SESSION_COOKIE = 'tcgwatch_session';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
}

/** Crée une session en base et pose le cookie httpOnly (à appeler dans une Server Action). */
export async function createSession(userId: string) {
  const env = getEnv();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null;
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Session courante (mise en cache le temps d'une requête). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const { emailVerifiedAt, ...user } = session.user;
  return { ...user, emailVerified: emailVerifiedAt !== null };
});

/** Protège une page ou une action : redirige vers /connexion si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  return user;
}

/** Réservé aux administrateurs (catalogue, boutiques, signalements) : 404 pour les autres. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') notFound();
  return user;
}

/** L'inscription est ouverte au premier compte, puis uniquement si ALLOW_REGISTRATION=true. */
export async function isRegistrationOpen(): Promise<boolean> {
  if (getEnv().ALLOW_REGISTRATION) return true;
  return (await prisma.user.count()) === 0;
}

// ─── Limitation des tentatives de connexion (mémoire, mono-instance) ───

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; first: number }>();

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS)
    attempts.set(key, { count: 1, first: Date.now() });
  else entry.count++;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

export async function clientKey(email: string): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'local';
  return `${ip}:${email.toLowerCase()}`;
}

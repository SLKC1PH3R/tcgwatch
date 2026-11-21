import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';
import { createSession, isRegistrationOpen } from '@/lib/auth';
import { GOOGLE_STATE_COOKIE, googleEnabled, googleProfile } from '@/lib/google-oauth';

const back = (path: string) => NextResponse.redirect(new URL(path, getEnv().APP_URL));

/**
 * Retour de Google : compte déjà lié → connexion ; même e-mail (vérifié par Google) → liaison ;
 * sinon création du compte (si les inscriptions sont ouvertes). Le premier compte est admin.
 */
export async function GET(request: Request) {
  if (!googleEnabled()) return back('/connexion');
  const url = new URL(request.url);
  const jar = await cookies();
  const [state, next = '/'] = (jar.get(GOOGLE_STATE_COOKIE)?.value ?? '').split('|');
  jar.delete(GOOGLE_STATE_COOKIE);
  const code = url.searchParams.get('code');
  if (!code || !state || url.searchParams.get('state') !== state) {
    return back('/connexion?erreur=google');
  }
  const profile = await googleProfile(code);
  if (!profile || !profile.emailVerified) return back('/connexion?erreur=google');

  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() },
      });
    } else {
      if (!(await isRegistrationOpen())) return back('/connexion?erreur=inscriptions');
      const first = (await prisma.user.count()) === 0;
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.sub,
          emailVerifiedAt: new Date(),
          role: first ? 'ADMIN' : 'USER',
        },
      });
    }
  }
  await createSession(user.id);
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return back(safe);
}

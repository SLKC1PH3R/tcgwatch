import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma, type AuthTokenKind } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';
import { sendMail } from './mail';

const TTL: Record<AuthTokenKind, number> = {
  VERIFY_EMAIL: 3 * 86_400_000,
  RESET_PASSWORD: 60 * 60_000,
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Nouveau jeton à usage unique (les précédents du même type sont annulés). */
async function issue(userId: string, kind: AuthTokenKind): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, kind } }),
    prisma.authToken.create({
      data: { id: hash(token), userId, kind, expiresAt: new Date(Date.now() + TTL[kind]) },
    }),
  ]);
  return token;
}

/** Consomme un jeton : renvoie l'utilisateur s'il est valide (et le supprime). */
export async function consumeToken(token: string, kind: AuthTokenKind): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { id: hash(token) } });
  if (!row || row.kind !== kind) return null;
  await prisma.authToken.delete({ where: { id: row.id } });
  return row.expiresAt > new Date() ? row.userId : null;
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issue(user.id, 'VERIFY_EMAIL');
  return sendMail({
    to: user.email,
    subject: 'Confirme ton adresse e-mail',
    lines: [
      'Bienvenue sur TCGWatch !',
      'Confirme ton adresse pour recevoir tes alertes et pouvoir récupérer ton compte.',
    ],
    action: {
      label: 'Confirmer mon adresse',
      url: `${getEnv().APP_URL}/verifier-email?jeton=${token}`,
    },
  });
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issue(user.id, 'RESET_PASSWORD');
  return sendMail({
    to: user.email,
    subject: 'Réinitialiser ton mot de passe',
    lines: [
      'Tu as demandé à changer ton mot de passe TCGWatch.',
      'Le lien ci-dessous est valable une heure.',
    ],
    action: {
      label: 'Choisir un nouveau mot de passe',
      url: `${getEnv().APP_URL}/mot-de-passe/nouveau?jeton=${token}`,
    },
  });
}

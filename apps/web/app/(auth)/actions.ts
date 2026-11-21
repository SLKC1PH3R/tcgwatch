'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import {
  clearAttempts,
  clientKey,
  createSession,
  destroySession,
  isRateLimited,
  isRegistrationOpen,
  recordFailedAttempt,
  requireUser,
} from '@/lib/auth';
import { consumeToken, sendPasswordResetEmail, sendVerificationEmail } from '@/lib/auth-tokens';
import { hashPassword, verifyPassword } from '@/lib/password';

export interface AuthState {
  error?: string;
  success?: string;
  fields?: { email?: string; name?: string };
}

/** N'autorise que les redirections internes (évite les open redirects). */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message,
      fields: { email: String(formData.get('email') ?? '') },
    };
  }
  const { email, password } = parsed.data;
  const key = await clientKey(email);
  if (isRateLimited(key)) {
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes.', fields: { email } };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Vérification factice si l'utilisateur n'existe pas : temps de réponse constant.
  const valid = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA').then(
        () => false,
      );
  if (user && !user.passwordHash) {
    return { error: 'Ce compte utilise la connexion Google.', fields: { email } };
  }
  if (!user || !valid) {
    recordFailedAttempt(key);
    return { error: 'E-mail ou mot de passe incorrect.', fields: { email } };
  }

  clearAttempts(key);
  await createSession(user.id);
  redirect(safeNext(formData.get('next')));
}

const registerSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    password: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères').max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fields = {
    email: String(formData.get('email') ?? ''),
    name: String(formData.get('name') ?? ''),
  };
  if (!(await isRegistrationOpen())) {
    return { error: 'Les inscriptions sont fermées sur cette instance.', fields };
  }
  const parsed = registerSchema.safeParse({
    name: formData.get('name') || undefined,
    email: formData.get('email'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };

  const { email, password, name } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: 'Un compte existe déjà avec cette adresse.', fields };
  }
  // Le premier compte de l'instance en est l'administrateur.
  const first = (await prisma.user.count()) === 0;
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      role: first ? 'ADMIN' : 'USER',
    },
  });
  await sendVerificationEmail(user);
  await createSession(user.id);
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/connexion');
}

const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide');

/** Mot de passe oublié : même réponse que le compte existe ou non (pas d'énumération). */
export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const key = await clientKey(parsed.data);
  if (isRateLimited(key)) return { error: 'Trop de demandes. Réessayez dans quelques minutes.' };
  recordFailedAttempt(key);
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (user) await sendPasswordResetEmail(user);
  return {
    success:
      'Si un compte existe avec cette adresse, un lien pour changer le mot de passe vient d’être envoyé (valable une heure).',
  };
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères').max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });

/** Nouveau mot de passe depuis le lien reçu : toutes les sessions sont fermées. */
export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const userId = await consumeToken(parsed.data.token, 'RESET_PASSWORD');
  if (!userId) return { error: 'Lien expiré ou déjà utilisé : refais une demande.' };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      // Le lien a été reçu par e-mail : l'adresse est confirmée au passage.
      data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  await createSession(userId);
  redirect('/');
}

/** Renvoie le lien de confirmation de l'adresse de l'utilisateur connecté. */
export async function resendVerificationAction(): Promise<AuthState> {
  const user = await requireUser();
  if (user.emailVerified) return { success: 'Adresse déjà confirmée.' };
  const key = await clientKey(`verify:${user.email}`);
  if (isRateLimited(key)) return { error: 'Trop de demandes. Réessayez plus tard.' };
  recordFailedAttempt(key);
  const sent = await sendVerificationEmail(user);
  return sent
    ? { success: `Lien envoyé à ${user.email}.` }
    : { error: 'Envoi impossible pour le moment.' };
}

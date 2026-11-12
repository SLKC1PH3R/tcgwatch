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
} from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';

export interface AuthState {
  error?: string;
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
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA').then(
        () => false,
      );
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
  const user = await prisma.user.create({
    data: { email, name: name || null, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/connexion');
}

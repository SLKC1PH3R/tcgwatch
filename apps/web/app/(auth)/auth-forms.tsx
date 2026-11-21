'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError, FormSuccess } from '@/components/form-message';
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type AuthState,
} from './actions';

/** Bouton « Continuer avec Google » (lien vers le départ OAuth) et séparateur. */
function GoogleButton({ next }: { next?: string }) {
  return (
    <>
      <Button asChild variant="outline" className="w-full">
        <a href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
            />
          </svg>
          Continuer avec Google
        </a>
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou avec un e-mail
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

export function LoginForm({
  next,
  registrationOpen,
  google,
  notice,
}: {
  next?: string;
  registrationOpen: boolean;
  google: boolean;
  notice?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre tableau de bord.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {google && <GoogleButton next={next} />}
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? '/'} />
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.fields?.email}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/mot-de-passe" className="text-xs text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <FormError message={state.error ?? notice} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
          {registrationOpen && (
            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link href="/inscription" className="font-medium text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function RegisterForm({ firstUser, google }: { firstUser: boolean; google: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>
          {firstUser
            ? 'Premier lancement : ce compte sera le propriétaire de l’instance.'
            : 'Gratuit : suis tes produits, ta collection et reçois tes alertes.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {google && <GoogleButton />}
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom (optionnel)</Label>
            <Input id="name" name="name" autoComplete="name" defaultValue={state.fields?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.fields?.email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <p className="text-xs text-muted-foreground">10 caractères minimum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmation</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <FormError message={state.error} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Création…' : 'Créer le compte'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{' '}
            <Link href="/connexion" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
        <CardDescription>
          Indique ton adresse : tu recevras un lien pour en choisir un nouveau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <FormError message={state.error} />
          <FormSuccess message={state.success} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Envoi…' : 'Recevoir le lien'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/connexion" className="font-medium text-primary hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Tes autres sessions seront déconnectées.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <p className="text-xs text-muted-foreground">10 caractères minimum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmation</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <FormError message={state.error} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Changer le mot de passe'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

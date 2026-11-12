'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-message';
import { loginAction, registerAction, type AuthState } from './actions';

export function LoginForm({
  next,
  registrationOpen,
}: {
  next?: string;
  registrationOpen: boolean;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre tableau de bord.</CardDescription>
      </CardHeader>
      <CardContent>
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
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <FormError message={state.error} />
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

export function RegisterForm({ firstUser }: { firstUser: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>
          {firstUser
            ? 'Premier lancement : ce compte sera le propriétaire de l’instance.'
            : 'Inscription ouverte sur cette instance.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
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

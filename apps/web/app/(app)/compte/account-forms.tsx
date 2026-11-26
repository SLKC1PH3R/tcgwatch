'use client';

import { useActionState } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type AccountState,
} from './actions';

export function ProfileForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nom affiché</Label>
        <Input id="name" name="name" defaultValue={name ?? ''} maxLength={80} />
      </div>
      <FormSuccess message={state.success} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-3">
      {hasPassword && (
        <div className="space-y-1.5">
          <Label htmlFor="current">Mot de passe actuel</Label>
          <Input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="password">{hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmation</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {hasPassword ? 'Changer le mot de passe' : 'Créer un mot de passe'}
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="confirm-delete">
          Pour confirmer, recopiez <b>{email}</b>
        </Label>
        <Input id="confirm-delete" name="confirm" autoComplete="off" required />
      </div>
      <FormError message={state.error} />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        Supprimer définitivement mon compte
      </Button>
    </form>
  );
}

'use client';

import { MailWarning } from 'lucide-react';
import { useActionState } from 'react';
import { resendVerificationAction, type AuthState } from '@/app/(auth)/actions';

/** Adresse pas encore confirmée : rappel discret, avec renvoi du lien. */
export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthState>(resendVerificationAction, {});
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      <MailWarning className="size-4 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        Confirmez votre adresse <b>{email}</b> avec le lien reçu par e-mail.
        {state.success && <span className="ml-2 text-success">{state.success}</span>}
        {state.error && <span className="ml-2 text-destructive">{state.error}</span>}
      </span>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {pending ? 'Envoi…' : 'Renvoyer le lien'}
        </button>
      </form>
    </div>
  );
}

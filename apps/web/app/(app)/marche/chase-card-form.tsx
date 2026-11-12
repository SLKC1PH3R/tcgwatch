'use client';

import { useActionState } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addChaseCardAction, type MarketState } from './actions';

export function ChaseCardForm({ releases }: { releases: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<MarketState, FormData>(addChaseCardAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cc-release">Extension</Label>
        <NativeSelect id="cc-release" name="releaseId" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-id">Identifiant TCGdex de la carte</Label>
        <Input id="cc-id" name="tcgdexId" required placeholder="me06-130" />
        <p className="text-xs text-muted-foreground">
          Visible sur tcgdex.dev ou via l’API (<code>/v2/fr/sets/me06</code>).
        </p>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" size="sm" disabled={pending}>
        Suivre la carte
      </Button>
    </form>
  );
}

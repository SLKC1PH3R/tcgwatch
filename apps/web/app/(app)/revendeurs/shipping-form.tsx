'use client';

import { useActionState } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveRetailerShippingAction, type ShippingState } from './actions';

const fr = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));

/** Saisie des frais de port d'une boutique (colis standard, France métropolitaine). */
export function ShippingForm({
  id,
  cost,
  freeFrom,
}: {
  id: string;
  cost: number | null;
  freeFrom: number | null;
}) {
  const [state, action, pending] = useActionState<ShippingState, FormData>(
    saveRetailerShippingAction.bind(null, id),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Port (€)
          <Input name="cost" inputMode="decimal" defaultValue={fr(cost)} placeholder="4,90" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Offert dès (€)
          <Input name="freeFrom" inputMode="decimal" defaultValue={fr(freeFrom)} placeholder="60" />
        </label>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}

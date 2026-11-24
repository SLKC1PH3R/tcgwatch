'use client';

import { useActionState } from 'react';
import { FormError } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOpeningAction, type OpeningState } from './actions';

/** Produit ouvert, prix payé, date : la saisie des cartes suit sur la page de l'ouverture. */
export function NewOpeningForm({
  products,
  today,
}: {
  products: { id: string; name: string; release: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<OpeningState, FormData>(createOpeningAction, {});
  const byRelease = new Map<string, { id: string; name: string }[]>();
  for (const p of products) byRelease.set(p.release, [...(byRelease.get(p.release) ?? []), p]);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="o-product">Produit ouvert</Label>
        <select
          id="o-product"
          name="productId"
          required
          defaultValue=""
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {[...byRelease].map(([release, list]) => (
            <optgroup key={release} label={release}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="o-price">Prix payé (€)</Label>
          <Input id="o-price" name="price" inputMode="decimal" required placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-date">Ouvert le</Label>
          <Input
            id="o-date"
            name="openedAt"
            type="date"
            defaultValue={today}
            max={today}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="o-notes">Note (facultatif)</Label>
        <Input id="o-notes" name="notes" placeholder="Display acheté chez…" />
      </div>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Saisir les cartes tirées'}
      </Button>
    </form>
  );
}

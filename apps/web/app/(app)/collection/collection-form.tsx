'use client';

import { useActionState, useRef } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addCollectionItemAction, type CollectionState } from './actions';

export const CONDITION_LABELS = {
  MINT: 'Scellé parfait',
  NEAR_MINT: 'Scellé, légers défauts',
  DAMAGED: 'Scellé abîmé',
  OPENED: 'Ouvert',
} as const;

export function CollectionForm({
  products,
  today,
}: {
  products: { id: string; name: string }[];
  today: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CollectionState, FormData>(async (prev, fd) => {
    const res = await addCollectionItemAction(prev, fd);
    if (res.success) formRef.current?.reset();
    return res;
  }, {});

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="c-product">Produit</Label>
        <NativeSelect id="c-product" name="productId" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="c-qty">Quantité</Label>
          <Input id="c-qty" name="quantity" type="number" min={1} defaultValue={1} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-price">Prix unitaire (€)</Label>
          <Input
            id="c-price"
            name="purchasePrice"
            inputMode="decimal"
            required
            placeholder="59,90"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-date">Date d’achat</Label>
          <Input
            id="c-date"
            name="purchaseDate"
            type="date"
            defaultValue={today}
            max={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-store">Magasin</Label>
          <Input id="c-store" name="store" placeholder="Play-In, Leclerc…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-condition">État du scellé</Label>
        <NativeSelect id="c-condition" name="condition" defaultValue="MINT">
          {Object.entries(CONDITION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-photo">Photo (optionnelle, 5 Mo max.)</Label>
        <Input
          id="c-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-notes">Notes</Label>
        <Textarea id="c-notes" name="notes" rows={2} />
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Ajout…' : 'Ajouter à la collection'}
      </Button>
    </form>
  );
}

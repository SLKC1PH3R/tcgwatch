'use client';

import { useActionState, useRef, useState } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { ProductPicker } from '@/components/product-picker';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductOption } from '@/lib/data/products';
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
  onSuccess,
}: {
  products: ProductOption[];
  today: string;
  /** Après un enregistrement réussi (ex. fermer la fenêtre). */
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Remonte le sélecteur après un enregistrement : plus de produit choisi.
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState<CollectionState, FormData>(async (prev, fd) => {
    const res = await addCollectionItemAction(prev, fd);
    if (res.success) {
      formRef.current?.reset();
      setRound((n) => n + 1);
      onSuccess?.();
    }
    return res;
  }, {});

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="c-product">Produit</Label>
        <ProductPicker key={round} id="c-product" products={products} />
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

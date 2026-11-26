'use client';

import { useActionState } from 'react';
import { FormError } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductPicker } from '@/components/product-picker';
import type { ProductOption } from '@/lib/data/products';
import { createOpeningAction, type OpeningState } from './actions';

/** Produit ouvert, prix payé, date : la saisie des cartes suit sur la page de l'ouverture. */
export function NewOpeningForm({ products, today }: { products: ProductOption[]; today: string }) {
  const [state, action, pending] = useActionState<OpeningState, FormData>(createOpeningAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="o-product">Produit ouvert</Label>
        <ProductPicker id="o-product" products={products} />
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

'use client';

import { useActionState } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addMarketPriceAction, type MarketState } from './actions';

/** Saisie manuelle du prix Cardmarket constaté (provider « manuel »). */
export function MarketPriceForm({
  products,
  productId,
  today,
}: {
  products?: { id: string; name: string }[];
  productId?: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<MarketState, FormData>(addMarketPriceAction, {});
  return (
    <form action={action} className="space-y-3">
      {productId ? (
        <input type="hidden" name="productId" value={productId} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="mp-product">Produit</Label>
          <NativeSelect id="mp-product" name="productId" required defaultValue="">
            <option value="" disabled>
              Choisir…
            </option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="mp-price">Prix Cardmarket (€)</Label>
          <Input id="mp-price" name="price" inputMode="decimal" required placeholder="ex. 89,90" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mp-date">Date du relevé</Label>
          <Input id="mp-date" name="date" type="date" defaultValue={today} max={today} />
        </div>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" size="sm" disabled={pending}>
        Enregistrer le prix marché
      </Button>
    </form>
  );
}

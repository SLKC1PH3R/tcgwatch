'use client';

import { HandCoins, X } from 'lucide-react';
import { useActionState, useRef } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sellCollectionItemAction, type CollectionState } from './actions';

/** Bouton « Vendre » d'une ligne : prix de vente, frais, date et canal, dans une fenêtre. */
export function SellDialog({
  id,
  name,
  quantity,
  purchaseDate,
  suggestedPrice,
  today,
}: {
  id: string;
  name: string;
  quantity: number;
  purchaseDate: string;
  suggestedPrice: number | null;
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const [state, action, pending] = useActionState<CollectionState, FormData>(async (prev, fd) => {
    const res = await sellCollectionItemAction(prev, fd);
    if (res.success) close();
    return res;
  }, {});

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => ref.current?.showModal()}
        aria-label={`Vendre ${name}`}
        title="Enregistrer une vente"
        className="size-8 text-muted-foreground hover:text-success"
      >
        <HandCoins />
      </Button>
      <dialog
        ref={ref}
        aria-label={`Vendre ${name}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-left text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-xl font-bold">Enregistrer une vente</h2>
              <p className="line-clamp-2 text-sm text-muted-foreground">{name}</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={close}
              aria-label="Fermer"
              className="-mt-1 -mr-2 size-8 shrink-0"
            >
              <X />
            </Button>
          </div>
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`s-qty-${id}`}>Quantité vendue</Label>
              <Input
                id={`s-qty-${id}`}
                name="quantity"
                type="number"
                min={1}
                max={quantity}
                defaultValue={quantity}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`s-price-${id}`}>Prix de vente (u., €)</Label>
              <Input
                id={`s-price-${id}`}
                name="salePrice"
                inputMode="decimal"
                required
                placeholder={suggestedPrice ? suggestedPrice.toFixed(2).replace('.', ',') : '0'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`s-fees-${id}`}>Frais (€, total)</Label>
              <Input id={`s-fees-${id}`} name="saleFees" inputMode="decimal" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`s-date-${id}`}>Date de vente</Label>
              <Input
                id={`s-date-${id}`}
                name="soldAt"
                type="date"
                defaultValue={today}
                min={purchaseDate}
                max={today}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`s-channel-${id}`}>Vendu sur</Label>
            <Input
              id={`s-channel-${id}`}
              name="saleChannel"
              list="sale-channels"
              placeholder="Cardmarket, Vinted, eBay, en main propre…"
            />
            <datalist id="sale-channels">
              <option value="Cardmarket" />
              <option value="Vinted" />
              <option value="eBay" />
              <option value="Leboncoin" />
              <option value="En main propre" />
            </datalist>
          </div>
          <p className="text-xs text-muted-foreground">
            Frais : commission de la plateforme et port à ta charge. La plus-value réalisée = prix
            de vente − frais − prix d’achat (port d’achat compris).
          </p>
          <FormError message={state.error} />
          <FormSuccess message={state.success} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer la vente'}
          </Button>
        </form>
      </dialog>
    </>
  );
}

'use client';

import { HandCoins, X } from 'lucide-react';
import { useActionState, useRef } from 'react';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sellCardAction, type CardSaleState } from '../../collection/cartes/actions';

/** Bouton « Vendre » d'une carte : variante, quantité, prix, frais, date et canal. */
export function SellCardDialog({
  cardId,
  name,
  owned,
  suggestedPrice,
  today,
}: {
  cardId: string;
  name: string;
  owned: { variant: string; label: string; quantity: number }[];
  suggestedPrice: number | null;
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const [state, action, pending] = useActionState<CardSaleState, FormData>(async (prev, fd) => {
    const res = await sellCardAction(cardId, prev, fd);
    if (res.success) close();
    return res;
  }, {});
  const max = Math.max(...owned.map((o) => o.quantity));

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => ref.current?.showModal()}
        className="w-full"
      >
        <HandCoins /> Enregistrer une vente
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-variant">Variante</Label>
              <select
                id="cs-variant"
                name="variant"
                defaultValue={owned[0]?.variant}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                {owned.map((o) => (
                  <option key={o.variant} value={o.variant}>
                    {o.label} ({o.quantity} ex.)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-qty">Quantité vendue</Label>
              <Input id="cs-qty" name="quantity" type="number" min={1} max={max} defaultValue={1} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-price">Prix de vente (u., €)</Label>
              <Input
                id="cs-price"
                name="salePrice"
                inputMode="decimal"
                required
                placeholder={suggestedPrice ? suggestedPrice.toFixed(2).replace('.', ',') : '0'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-fees">Frais (€, total)</Label>
              <Input id="cs-fees" name="saleFees" inputMode="decimal" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-date">Date de vente</Label>
              <Input id="cs-date" name="soldAt" type="date" defaultValue={today} max={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-channel">Vendue sur</Label>
              <Input
                id="cs-channel"
                name="saleChannel"
                list="card-sale-channels"
                placeholder="Cardmarket…"
              />
              <datalist id="card-sale-channels">
                <option value="Cardmarket" />
                <option value="Vinted" />
                <option value="eBay" />
                <option value="Leboncoin" />
                <option value="En main propre" />
              </datalist>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Les exemplaires vendus sont retirés de votre collection et comptés dans le bilan des
            reventes. Plus-value = prix de vente − frais − prix d’achat (s’il est renseigné).
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

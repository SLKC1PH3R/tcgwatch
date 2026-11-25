'use client';

import { Pencil, Plus, X } from 'lucide-react';
import { useActionState, useRef } from 'react';
import { FormError } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCardLotAction, type LotState } from '../actions';

export interface LotValues {
  id: string;
  name: string;
  price: number;
  purchasedAt: string;
  notes: string | null;
  releases: string[];
}

/**
 * Lot d'achat : un achat groupé (master set en cours, demi-display ouvert…) couvrant une ou
 * plusieurs extensions. Bouton « Nouveau lot » ou crayon d'un lot existant.
 */
export function LotDialog({
  lot,
  releases,
  today,
}: {
  lot?: LotValues;
  releases: { code: string; name: string }[];
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const [state, action, pending] = useActionState<LotState, FormData>(async (prev, fd) => {
    const res = await saveCardLotAction(prev, fd);
    if (res.success) close();
    return res;
  }, {});
  const id = lot?.id ?? 'new';

  return (
    <>
      {lot ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground"
          aria-label={`Modifier le lot ${lot.name}`}
          onClick={() => ref.current?.showModal()}
        >
          <Pencil />
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => ref.current?.showModal()}>
          <Plus /> Nouveau lot
        </Button>
      )}
      <dialog
        ref={ref}
        aria-label={lot ? `Modifier ${lot.name}` : 'Nouveau lot'}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-left text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold">
                {lot ? 'Modifier le lot' : 'Nouveau lot d’achat'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Un achat groupé : les cartes des extensions cochées, sans prix à l’unité, y sont
                rattachées.
              </p>
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
          {lot && <input type="hidden" name="id" value={lot.id} />}
          <div className="space-y-1.5">
            <Label htmlFor={`lot-name-${id}`}>Nom</Label>
            <Input
              id={`lot-name-${id}`}
              name="name"
              required
              defaultValue={lot?.name}
              placeholder="Master set 30 ans, demi-display Règne Delta…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`lot-price-${id}`}>Prix payé (€)</Label>
              <Input
                id={`lot-price-${id}`}
                name="price"
                inputMode="decimal"
                required
                defaultValue={lot ? String(lot.price).replace('.', ',') : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`lot-date-${id}`}>Acheté le</Label>
              <Input
                id={`lot-date-${id}`}
                name="purchasedAt"
                type="date"
                max={today}
                required
                defaultValue={lot?.purchasedAt ?? today}
              />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Extensions couvertes</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {releases.map((r) => (
                <label
                  key={r.code}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    name="releases"
                    value={r.code}
                    defaultChecked={lot?.releases.includes(r.code)}
                    className="size-4 accent-primary"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor={`lot-notes-${id}`}>Note (facultatif)</Label>
            <Input id={`lot-notes-${id}`} name="notes" defaultValue={lot?.notes ?? undefined} />
          </div>
          <FormError message={state.error} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      </dialog>
    </>
  );
}

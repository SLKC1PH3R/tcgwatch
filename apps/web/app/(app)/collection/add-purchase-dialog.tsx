'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { ProductOption } from '@/lib/data/products';
import { CollectionForm } from './collection-form';

/**
 * Bouton « Ajouter un achat » : le formulaire s'ouvre dans une fenêtre par-dessus la page
 * (`<dialog>` natif : Échap, focus piégé et fond assombri fournis par le navigateur).
 */
export function AddPurchaseDialog({
  products,
  today,
}: {
  products: ProductOption[];
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  // Anciens liens « …/collection#ajouter-achat » : ouvrent directement la fenêtre.
  useEffect(() => {
    if (window.location.hash === '#ajouter-achat') ref.current?.showModal();
  }, []);

  return (
    <>
      <Button type="button" onClick={open}>
        <Plus /> Ajouter un achat
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="ajouter-achat-titre"
        // Clic sur le fond (hors du panneau) : ferme la fenêtre.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 id="ajouter-achat-titre" className="font-display text-xl font-bold">
                Ajouter un achat
              </h2>
              <p className="text-sm text-muted-foreground">
                Choisissez un produit du catalogue (importé automatiquement).
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
          <CollectionForm products={products} today={today} onSuccess={close} />
        </div>
      </dialog>
    </>
  );
}

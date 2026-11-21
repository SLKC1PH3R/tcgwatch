'use client';

import { Flag, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useActionState, useRef } from 'react';
import { reportErrorAction, type ReportState } from '@/app/(app)/signalements/actions';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const KINDS = [
  { value: 'PRICE', label: 'Prix faux' },
  { value: 'STOCK', label: 'Stock faux' },
  { value: 'MATCH', label: 'Mauvais produit' },
  { value: 'OTHER', label: 'Autre' },
] as const;

/** « Signaler une erreur » : petite fenêtre (type, message), rattachée à un produit, une fiche ou une carte. */
export function ReportButton({
  productId,
  listingId,
  cardId,
  subject,
  defaultKind = 'PRICE',
  compact = false,
  className,
}: {
  productId?: string;
  listingId?: string;
  cardId?: string;
  /** Ce qui est signalé (« Variantes · 79,90 € »), rappelé dans la fenêtre. */
  subject: string;
  defaultKind?: (typeof KINDS)[number]['value'];
  compact?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  const [state, action, pending] = useActionState<ReportState, FormData>(reportErrorAction, {});
  const close = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        title="Signaler une erreur"
        aria-label={`Signaler une erreur : ${subject}`}
        className={cn(
          'inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive',
          className,
        )}
      >
        <Flag className="size-3.5" />
        {!compact && 'Signaler une erreur'}
      </button>
      <dialog
        ref={ref}
        aria-label="Signaler une erreur"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-left text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-lg font-bold">Signaler une erreur</h2>
              <p className="line-clamp-2 text-sm text-muted-foreground">{subject}</p>
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
          {productId && <input type="hidden" name="productId" value={productId} />}
          {listingId && <input type="hidden" name="listingId" value={listingId} />}
          {cardId && <input type="hidden" name="cardId" value={cardId} />}
          <input type="hidden" name="path" value={path} />
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Type d’erreur</legend>
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="cursor-pointer rounded-full border px-3 py-1 text-sm has-checked:border-primary has-checked:bg-primary/15"
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  defaultChecked={k.value === defaultKind}
                  className="sr-only"
                />
                {k.label}
              </label>
            ))}
          </fieldset>
          <textarea
            name="message"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            placeholder="Ex. : c’est une boîte de rangement, pas le coffret ; le vrai prix est 54,90 €…"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <FormError message={state.error} />
          <FormSuccess message={state.success} />
          {!state.success && (
            <Button type="submit" disabled={pending}>
              {pending ? 'Envoi…' : 'Envoyer'}
            </Button>
          )}
        </form>
      </dialog>
    </>
  );
}

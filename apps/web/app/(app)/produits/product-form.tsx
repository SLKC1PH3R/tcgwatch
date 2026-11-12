'use client';

import { useActionState } from 'react';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@tcgwatch/shared';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SimpleState } from './actions';

export interface ProductFormValues {
  name?: string;
  type?: string;
  releaseId?: string | null;
  ean?: string | null;
  imageUrl?: string | null;
  msrp?: number | null;
  targetPrice?: number | null;
  releaseDate?: string;
  notes?: string | null;
}

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v).replace('.', ',');

export function ProductForm({
  action,
  values = {},
  releases,
  submitLabel = 'Enregistrer',
}: {
  action: (state: SimpleState, formData: FormData) => Promise<SimpleState>;
  values?: ProductFormValues;
  releases: { id: string; label: string }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" defaultValue={values.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <NativeSelect id="type" name="type" defaultValue={values.type ?? 'ETB'}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRODUCT_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="releaseId">Sortie / extension</Label>
          <NativeSelect id="releaseId" name="releaseId" defaultValue={values.releaseId ?? ''}>
            <option value="">— Aucune —</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetPrice">Prix cible (€)</Label>
          <Input
            id="targetPrice"
            name="targetPrice"
            inputMode="decimal"
            defaultValue={num(values.targetPrice)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="msrp">Prix public conseillé (€)</Label>
          <Input id="msrp" name="msrp" inputMode="decimal" defaultValue={num(values.msrp)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="releaseDate">Date de sortie du produit</Label>
          <Input
            id="releaseDate"
            name="releaseDate"
            type="date"
            defaultValue={values.releaseDate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ean">EAN</Label>
          <Input id="ean" name="ean" inputMode="numeric" defaultValue={values.ean ?? ''} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="imageUrl">URL de l’image</Label>
        <Input id="imageUrl" name="imageUrl" type="url" defaultValue={values.imageUrl ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={values.notes ?? ''} />
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : submitLabel}
      </Button>
    </form>
  );
}

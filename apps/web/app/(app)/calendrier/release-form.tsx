'use client';

import { useActionState } from 'react';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@tcgwatch/shared';
import { FormError, FormSuccess } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReleaseState } from './actions';

export interface ReleaseValues {
  id?: string;
  nameFr?: string;
  setCode?: string | null;
  releaseDate?: string;
  productType?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  status?: 'AUTO' | 'VALIDATED';
}

export function ReleaseForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (state: ReleaseState, formData: FormData) => Promise<ReleaseState>;
  values?: ReleaseValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const p = values.id ?? 'new';
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`name-${p}`}>Nom FR</Label>
        <Input id={`name-${p}`} name="nameFr" defaultValue={values.nameFr} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`code-${p}`}>Code extension</Label>
        <Input
          id={`code-${p}`}
          name="setCode"
          defaultValue={values.setCode ?? ''}
          placeholder="ME06"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`date-${p}`}>Date de sortie FR</Label>
        <Input id={`date-${p}`} name="releaseDate" type="date" defaultValue={values.releaseDate} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`type-${p}`}>Type de produit</Label>
        <NativeSelect id={`type-${p}`} name="productType" defaultValue={values.productType ?? ''}>
          <option value="">Extension (tous produits)</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PRODUCT_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`img-${p}`}>Image (URL)</Label>
        <Input id={`img-${p}`} name="imageUrl" type="url" defaultValue={values.imageUrl ?? ''} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`notes-${p}`}>Notes</Label>
        <Input id={`notes-${p}`} name="notes" defaultValue={values.notes ?? ''} />
      </div>
      {values.id && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="validate"
            value="auto"
            defaultChecked={false}
            className="size-4"
          />
          Laisser en « auto » (les imports pourront encore la mettre à jour)
        </label>
      )}
      <div className="space-y-2 sm:col-span-2">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

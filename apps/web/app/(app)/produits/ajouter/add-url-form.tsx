'use client';

import { FlaskConical, Info } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { formatPrice, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FormError } from '@/components/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addListingAction,
  testUrlAction,
  type AddListingState,
  type TestUrlState,
} from '../actions';

interface Props {
  products: { id: string; name: string }[];
  releases: { id: string; label: string }[];
  defaultInterval: number;
  preselectedProductId?: string;
}

export function AddUrlForm({ products, releases, defaultInterval, preselectedProductId }: Props) {
  const [test, testAction, testing] = useActionState<TestUrlState, FormData>(testUrlAction, {});
  const [add, addAction, adding] = useActionState<AddListingState, FormData>(addListingAction, {});
  const suggestedProduct = test.suggestion?.existingProductId ?? preselectedProductId;
  const [productChoice, setProductChoice] = useState<string | undefined>(undefined);
  const productId = productChoice ?? suggestedProduct ?? '__new';
  const canAdd = Boolean(test.url && test.retailer && !test.error);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>1. Tester l’URL</CardTitle>
          <CardDescription>
            Adaptateurs dédiés : Play-In, Philibert, Cultura, Smyths Toys. Les autres sites sont lus
            via leurs données structurées (JSON-LD) ou leur fiche PrestaShop ; voir la page
            Revendeurs pour l’état de chaque site. Amazon, Fnac et Cdiscount ne sont pas pris en
            charge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={testAction} className="space-y-3">
            <Label htmlFor="url">URL de la fiche produit</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                name="url"
                type="url"
                required
                placeholder="https://www.play-in.com/fr/produit/…"
                defaultValue={test.url}
              />
              <Button type="submit" disabled={testing}>
                <FlaskConical /> {testing ? 'Test…' : 'Tester'}
              </Button>
            </div>
            <FormError message={test.error} />
            {test.error && test.suggestion?.existingProductId && (
              <Link
                href={`/produits/${test.suggestion.existingProductId}`}
                className="text-sm text-primary underline"
              >
                Voir le produit existant
              </Link>
            )}
          </form>

          {test.retailer && (
            <div className="mt-5 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{test.retailer.name}</span>
                <Badge variant="outline">{test.retailer.domain}</Badge>
                <Badge variant="secondary">Adaptateur : {test.retailer.adapterName}</Badge>
                {!test.retailer.known && <Badge variant="info">Nouveau revendeur</Badge>}
              </div>
              {test.warning && (
                <p className="flex gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0" /> {test.warning}
                </p>
              )}
              {test.result && (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    {test.result.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        referrerPolicy="no-referrer"
                        src={test.result.imageUrl}
                        alt=""
                        className="size-20 rounded-md border bg-white object-contain"
                      />
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Titre</dt>
                      <dd className="font-medium">{test.result.title ?? '—'}</dd>
                      <dt className="text-muted-foreground">Prix</dt>
                      <dd className="tabular-nums">
                        {formatPrice(test.result.price, test.result.currency)}
                      </dd>
                      <dt className="text-muted-foreground">Dispo</dt>
                      <dd>
                        <AvailabilityBadge availability={test.result.availability} />
                      </dd>
                      {test.result.releaseDate && (
                        <>
                          <dt className="text-muted-foreground">Sortie</dt>
                          <dd>
                            {new Date(test.result.releaseDate).toLocaleDateString('fr-FR', {
                              timeZone: 'UTC',
                            })}
                          </dd>
                        </>
                      )}
                      {test.result.ean && (
                        <>
                          <dt className="text-muted-foreground">EAN</dt>
                          <dd className="font-mono text-xs">{test.result.ean}</dd>
                        </>
                      )}
                      {test.result.brand && (
                        <>
                          <dt className="text-muted-foreground">Marque</dt>
                          <dd>{test.result.brand}</dd>
                        </>
                      )}
                      {test.result.category && (
                        <>
                          <dt className="text-muted-foreground">Rayon</dt>
                          <dd>{test.result.category}</dd>
                        </>
                      )}
                      {test.result.sku && (
                        <>
                          <dt className="text-muted-foreground">Réf.</dt>
                          <dd className="font-mono text-xs">{test.result.sku}</dd>
                        </>
                      )}
                      {test.result.stockAlertUrl && (
                        <>
                          <dt className="text-muted-foreground">Alerte site</dt>
                          <dd>détectée</dd>
                        </>
                      )}
                    </dl>
                  </div>
                  {test.result.images && test.result.images.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {test.result.images.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={src}
                          referrerPolicy="no-referrer"
                          src={src}
                          alt=""
                          loading="lazy"
                          className="size-12 rounded-md border bg-white object-contain"
                        />
                      ))}
                    </div>
                  )}
                  {test.result.description && (
                    <p className="line-clamp-4 text-sm text-muted-foreground">
                      {test.result.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={canAdd ? '' : 'opacity-60'}>
        <CardHeader className="flex-col">
          <CardTitle>2. Rattacher à un produit</CardTitle>
          <CardDescription>
            Le worker relèvera ensuite la fiche à l’intervalle choisi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addAction} className="space-y-4" key={test.url}>
            <input type="hidden" name="url" value={test.url ?? ''} />
            <input
              type="hidden"
              name="tested"
              value={test.result ? JSON.stringify(test.result) : ''}
            />
            <fieldset disabled={!canAdd || adding} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productId">Produit</Label>
                <NativeSelect
                  id="productId"
                  name="productId"
                  value={productId}
                  onChange={(e) => setProductChoice(e.target.value)}
                >
                  <option value="__new">➕ Nouveau produit…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                {test.suggestion?.existingProductId && (
                  <p className="text-xs text-muted-foreground">Produit reconnu par son EAN.</p>
                )}
              </div>

              {productId === '__new' && (
                <div className="space-y-4 rounded-lg border border-dashed p-4">
                  <div className="space-y-2">
                    <Label htmlFor="newName">Nom du produit</Label>
                    <Input
                      id="newName"
                      name="newName"
                      defaultValue={test.suggestion?.name}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newType">Type</Label>
                      <NativeSelect
                        id="newType"
                        name="newType"
                        defaultValue={test.suggestion?.type ?? 'AUTRE'}
                      >
                        {PRODUCT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {PRODUCT_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="releaseId">Sortie / extension</Label>
                      <NativeSelect id="releaseId" name="releaseId" defaultValue="">
                        <option value="">— Aucune —</option>
                        {releases.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="targetPrice">Prix cible pour ce site (€)</Label>
                  <Input
                    id="targetPrice"
                    name="targetPrice"
                    inputMode="decimal"
                    placeholder="ex. 54,90"
                  />
                  <p className="text-xs text-muted-foreground">Vide = prix cible du produit.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkIntervalMin">Fréquence (minutes)</Label>
                  <Input
                    id="checkIntervalMin"
                    name="checkIntervalMin"
                    type="number"
                    min={5}
                    max={1440}
                    defaultValue={defaultInterval}
                  />
                </div>
              </div>
              <FormError message={add.error} />
              <Button type="submit" className="w-full">
                {adding ? 'Ajout…' : 'Ajouter le suivi'}
              </Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Bell, ExternalLink, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useActionState } from 'react';
import { formatDateTime, formatPrice } from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { FormError, FormSuccess } from '@/components/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ListingDTO } from '@/lib/data/products';
import {
  checkNowAction,
  deleteListingAction,
  toggleListingAction,
  updateListingAction,
  type SimpleState,
} from '../actions';

const STATE_LABEL: Record<string, string> = {
  ACTIVE: 'Actif',
  PAUSED: 'En pause',
  ERROR: 'En erreur',
  BLOCKED_BY_ROBOTS: 'Bloqué (robots.txt)',
};

export function ListingRow({ listing }: { listing: ListingDTO }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(
    updateListingAction.bind(null, listing.id),
    {},
  );
  const paused = listing.state !== 'ACTIVE';

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{listing.retailerName}</span>
          <AvailabilityBadge availability={listing.availability} />
          <span className="font-semibold tabular-nums">{formatPrice(listing.price)}</span>
          {listing.state !== 'ACTIVE' && (
            <Badge variant={listing.state === 'PAUSED' ? 'secondary' : 'destructive'}>
              {STATE_LABEL[listing.state]}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button asChild size="sm">
            <a href={listing.url} target="_blank" rel="noopener noreferrer">
              Acheter <ExternalLink />
            </a>
          </Button>
          {listing.stockAlertUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={listing.stockAlertUrl} target="_blank" rel="noopener noreferrer">
                <Bell /> Alerte du site
              </a>
            </Button>
          )}
          <form action={checkNowAction.bind(null, listing.id)}>
            <Button
              size="sm"
              variant="ghost"
              type="submit"
              title="Relever au prochain passage du worker (≤ 1 min)"
            >
              <RefreshCw />
            </Button>
          </form>
          <form action={toggleListingAction.bind(null, listing.id)}>
            <Button
              size="sm"
              variant="ghost"
              type="submit"
              title={paused ? 'Reprendre le suivi' : 'Mettre en pause'}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
          </form>
          <form
            action={deleteListingAction.bind(null, listing.id)}
            onSubmit={(e) => {
              if (!confirm('Supprimer ce suivi et son historique ?')) e.preventDefault();
            }}
          >
            <Button
              size="sm"
              variant="ghost"
              type="submit"
              title="Supprimer"
              className="text-destructive"
            >
              <Trash2 />
            </Button>
          </form>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {listing.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            referrerPolicy="no-referrer"
            src={listing.imageUrl}
            alt=""
            loading="lazy"
            className="size-10 shrink-0 rounded border bg-white object-contain"
          />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground" title={listing.url}>
            {listing.title ?? listing.url}
          </p>
          {(listing.category || listing.sku) && (
            <p className="truncate text-xs text-muted-foreground">
              {listing.category}
              {listing.category && listing.sku && ' · '}
              {listing.sku && <>Réf. {listing.sku}</>}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Dernier relevé : {formatDateTime(listing.lastCheckedAt)}
        {listing.lastInStockAt && (
          <> · Dernier stock vu : {formatDateTime(listing.lastInStockAt)}</>
        )}
      </p>
      {listing.lastError && (
        <p className="text-xs text-destructive">
          {listing.consecutiveErrors} erreur(s) : {listing.lastError}
        </p>
      )}
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Prix cible (€)</span>
          <Input
            name="targetPrice"
            inputMode="decimal"
            defaultValue={
              listing.targetPrice !== null ? String(listing.targetPrice).replace('.', ',') : ''
            }
            placeholder="hérité du produit"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Fréquence (min)</span>
          <Input
            name="checkIntervalMin"
            type="number"
            min={5}
            max={1440}
            defaultValue={listing.checkIntervalMin}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Lien d’alerte de stock du site</span>
          <Input name="stockAlertUrl" type="url" defaultValue={listing.stockAlertUrl ?? ''} />
        </label>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Enregistrer
        </Button>
      </form>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
    </div>
  );
}

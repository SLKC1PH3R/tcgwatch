'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setPriceSourceAction } from '@/app/price-source-action';
import { PRICE_SOURCES, type PriceSource } from '@/lib/price-source';
import { cn } from '@/lib/utils';

/** Choix du prix des cartes (Cardmarket ou eBay FR), retenu dans un cookie pour tout le site. */
export function PriceSourceToggle({
  current,
  className,
}: {
  current: PriceSource;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (source: PriceSource) => {
    start(async () => {
      await setPriceSourceAction(source);
      router.refresh();
    });
  };
  return (
    <div
      role="group"
      aria-label="Prix affiché"
      className={cn('flex rounded-lg border p-0.5', pending && 'opacity-70', className)}
    >
      {PRICE_SOURCES.map((s) => (
        <button
          key={s.key}
          type="button"
          title={s.hint}
          aria-pressed={current === s.key}
          onClick={() => pick(s.key)}
          className={cn(
            'h-7 rounded-md px-2.5 text-xs font-medium',
            current === s.key
              ? s.key === 'ebay'
                ? 'bg-info text-black'
                : 'bg-primary text-primary-foreground'
              : 'hover:bg-accent',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

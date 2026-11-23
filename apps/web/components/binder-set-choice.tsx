'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { percent, type SetProgress } from '@/lib/card-sets';
import { cn } from '@/lib/utils';

/**
 * Tuile d'un classeur d'extension avec reverses : un clic propose d'ouvrir le Full Set ou le
 * Master Set.
 */
export function BinderSetChoice({
  href,
  name,
  progress,
  className,
  children,
}: {
  href: string;
  name: string;
  progress: SetProgress & { master: NonNullable<SetProgress['master']> };
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const choices = [
    {
      label: 'Full Set',
      text: 'Une carte de chaque numéro, en version classique.',
      p: progress.full,
      href,
      tone: 'border-primary/50 hover:bg-primary/10',
      bar: 'bg-primary',
    },
    {
      label: 'Master Set',
      text: 'Les cartes classiques et chaque reverse, rangée juste après.',
      p: progress.master,
      href: `${href}?set=master`,
      tone: 'border-info/50 hover:bg-info/10',
      bar: 'bg-info',
    },
  ];
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={className}>
        {children}
      </button>
      <dialog
        ref={ref}
        aria-label={`Ouvrir ${name}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{name}</h2>
              <p className="text-sm text-muted-foreground">Quel classeur ouvrir ?</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={close}
              aria-label="Fermer"
              className="-mt-1 -mr-2 size-8"
            >
              <X />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {choices.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className={cn('space-y-2 rounded-xl border p-4 transition-colors', c.tone)}
              >
                <p className="font-display text-lg font-bold">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.text}</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', c.bar)}
                    style={{ width: `${percent(c.p)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {c.p.owned}/{c.p.total} · {percent(c.p)} %
                </p>
              </Link>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}

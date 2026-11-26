'use client';

import { Check } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TourPanel {
  key: string;
  label: string;
  title: string;
  text: string;
  points: string[];
  visual: ReactNode;
}

/** Visite du site par onglets (Scellé, Cartes, Marché, Mon profil). */
export function LandingTour({ panels }: { panels: TourPanel[] }) {
  const [active, setActive] = useState(panels[0]!.key);
  const id = useId();
  const panel = panels.find((p) => p.key === active)!;

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Ce que fait TCGWatch"
        className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border bg-card p-1.5"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const i = panels.findIndex((p) => p.key === active);
          const next =
            panels[(i + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length]!;
          setActive(next.key);
          document.getElementById(`${id}-tab-${next.key}`)?.focus();
        }}
      >
        {panels.map((p) => (
          <button
            key={p.key}
            id={`${id}-tab-${p.key}`}
            type="button"
            role="tab"
            aria-selected={p.key === active}
            aria-controls={`${id}-panel`}
            tabIndex={p.key === active ? 0 : -1}
            onClick={() => setActive(p.key)}
            className={cn(
              'min-h-11 rounded-full px-5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground',
              p.key === active &&
                'bg-primary text-primary-foreground hover:text-primary-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${panel.key}`}
        className="grid items-center gap-8 rounded-3xl border bg-card p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:p-10"
      >
        <div className="space-y-4">
          <h3 className="font-display text-2xl font-bold md:text-3xl">{panel.title}</h3>
          <p className="text-muted-foreground md:text-lg">{panel.text}</p>
          <ul className="space-y-2.5">
            {panel.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden>{panel.visual}</div>
      </div>
    </div>
  );
}

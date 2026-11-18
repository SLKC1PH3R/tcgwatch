'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TabPanel {
  id: string;
  label: string;
  /** Lien « Tout voir » affiché quand l'onglet est actif. */
  href?: string;
  content: React.ReactNode;
}

/**
 * Onglets légers pour une carte de l'accueil : le contenu de chaque onglet est rendu côté serveur
 * et passé en props ; seul le choix de l'onglet vit dans le navigateur.
 */
export function TabPanels({ tabs, bodyClassName }: { tabs: TabPanel[]; bodyClassName?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-6">
        <div role="tablist" className="flex gap-1 rounded-full border bg-popover p-1">
          {tabs.map((t) => {
            const on = t.id === current.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${base}-tab-${t.id}`}
                aria-selected={on}
                aria-controls={`${base}-panel-${t.id}`}
                onClick={() => setActive(t.id)}
                className={cn(
                  'h-8 cursor-pointer rounded-full px-3.5 font-display text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                  on && 'bg-foreground text-background hover:text-background',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {current.href && (
          <Link
            href={current.href}
            className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            Tout voir
          </Link>
        )}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-${current.id}`}
        aria-labelledby={`${base}-tab-${current.id}`}
        className={cn('px-6', bodyClassName)}
      >
        {current.content}
      </div>
    </>
  );
}

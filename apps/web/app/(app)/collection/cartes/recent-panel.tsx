'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fitCard, fitColumn, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

/**
 * Colonne de droite de Mes cartes : la courbe de valeur, puis les derniers ajouts. « Agrandir »
 * replie la courbe vers le haut et donne toute la hauteur aux derniers ajouts (plus de cartes) ;
 * « Réduire » (ou un nouveau clic sur le titre) remet la courbe.
 */
export function RecentPanel({ chart, children }: { chart: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);

  return (
    <div className={cn(fitColumn, 'gap-4')}>
      <div
        className={cn(
          'grid shrink-0 transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
          open ? '-mb-4 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
        inert={open}
      >
        <div className="min-h-0 overflow-hidden">{chart}</div>
      </div>
      <Card className={cn(fitCard, 'fit:flex-1')}>
        <CardHeader className="items-center">
          <CardTitle>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="rounded-md text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Derniers ajouts
            </button>
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-expanded={open}
            className="-my-1"
          >
            {open ? <Minimize2 /> : <Maximize2 />}
            {open ? 'Réduire' : 'Agrandir'}
          </Button>
        </CardHeader>
        <CardContent className={fitScroll}>
          <div
            className={cn(
              'grid grid-cols-3 gap-3 sm:grid-cols-4 2xl:grid-cols-5',
              // Replié : une douzaine de cartes au plus (le reste en agrandissant).
              !open && '[&>*:nth-child(n+13)]:hidden',
              open && '2xl:grid-cols-6',
            )}
          >
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

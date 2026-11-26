'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fitCard, fitColumn, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export interface StackSection {
  title: ReactNode;
  description: ReactNode;
  body: ReactNode;
  bodyClassName?: string;
}

/**
 * Colonne de réglages des alertes : deux cartes empilées. « Agrandir » sur celle du haut la
 * déploie vers le bas (celle du bas se replie sur son titre), et inversement pour celle du bas,
 * qui monte prendre toute la colonne.
 */
export function SettingsStack({ top, bottom }: { top: StackSection; bottom: StackSection }) {
  const [open, setOpen] = useState<'top' | 'bottom' | null>(null);
  const sections = [
    { key: 'top' as const, s: top },
    { key: 'bottom' as const, s: bottom },
  ];

  return (
    <div className={fitColumn}>
      {sections.map(({ key, s }) => {
        const expanded = open === key;
        const folded = open !== null && !expanded;
        const toggle = () => setOpen(expanded ? null : key);
        return (
          <Card
            key={key}
            className={cn(
              fitCard,
              'transition-[flex-grow,max-height] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
              folded
                ? 'shrink-0'
                : expanded
                  ? 'fit:flex-1'
                  : key === 'top'
                    ? 'fit:max-h-[58%]'
                    : 'fit:flex-1',
            )}
          >
            <CardHeader className="shrink-0 flex-nowrap">
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={expanded}
                    className="flex items-center gap-2 rounded-md text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {s.title}
                  </button>
                </CardTitle>
                {!folded && <CardDescription>{s.description}</CardDescription>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggle}
                aria-expanded={expanded}
                className="-my-1 shrink-0"
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
                {expanded ? 'Réduire' : 'Agrandir'}
              </Button>
            </CardHeader>
            <div
              className={cn(
                'grid min-h-0 transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none fit:flex-1',
                folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              inert={folded}
            >
              <div className="flex min-h-0 flex-col overflow-hidden">
                <CardContent className={cn(s.bodyClassName, fitScroll)}>{s.body}</CardContent>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

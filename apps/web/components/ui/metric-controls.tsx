'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChartColumn, ChartSpline, ChevronDown } from 'lucide-react';
import type { ChartView } from './metric-chart';
import { cn } from '@/lib/utils';

export interface PeriodOption {
  label: string;
  /** Nombre de points gardés (les plus récents) ; absent = toute la série. */
  points?: number;
}

/** Bascule courbe / barres. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ChartView;
  onChange: (v: ChartView) => void;
}) {
  const items: { v: ChartView; label: string; Icon: typeof ChartSpline }[] = [
    { v: 'curve', label: 'Courbe', Icon: ChartSpline },
    { v: 'bars', label: 'Barres', Icon: ChartColumn },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Affichage"
      className="pointer-events-auto flex gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5"
    >
      {items.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            'grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
            value === v && 'bg-white/12 text-foreground',
          )}
        >
          <Icon size={15} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

/** Menu de période : bouton + liste déroulante. */
export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string;
  options: PeriodOption[];
  onChange: (o: PeriodOption) => void;
  accentText: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={root} className="pointer-events-auto relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        {value}
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Période"
          className="absolute top-full right-0 z-30 mt-1 min-w-36 rounded-xl border border-white/10 bg-popover/95 p-1 shadow-xl backdrop-blur"
        >
          {options.map((o) => {
            const on = o.label === value;
            return (
              <li key={o.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    on && 'text-foreground',
                  )}
                >
                  {o.label}
                  {on && <Check size={14} style={{ color: accentText }} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

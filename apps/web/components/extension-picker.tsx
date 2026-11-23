'use client';

import { BookOpen, Check, ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { fold } from '@tcgwatch/shared';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PickerExtension {
  code: string;
  name: string;
  serie: string | null;
  /** Année de sortie (affichée sous le nom). */
  year: number | null;
  logo: string | null;
  symbol: string | null;
  /** Logo de la série, dernier recours. */
  serieLogo?: string | null;
}

/** Logo de l'extension, à défaut son symbole, à défaut une icône. */
function ExtensionLogo({ ext, className }: { ext: PickerExtension; className?: string }) {
  if (ext.logo) {
    return <SafeImg src={ext.logo} alt="" className={cn('object-contain', className)} />;
  }
  if (ext.symbol) {
    return (
      <span className={cn('grid place-items-center', className)}>
        <SafeImg src={ext.symbol} alt="" className="size-8 object-contain" />
      </span>
    );
  }
  if (ext.serieLogo) {
    return <SafeImg src={ext.serieLogo} alt="" className={cn('object-contain', className)} />;
  }
  return (
    <span className={cn('grid place-items-center', className)}>
      <BookOpen className="size-7 text-muted-foreground" />
    </span>
  );
}

/**
 * Choix visuel d'une extension : logos regroupés par série, avec recherche. Renseigne le champ
 * `name` du formulaire englobant.
 */
export function ExtensionPicker({
  name,
  extensions,
  taken = [],
}: {
  name: string;
  extensions: PickerExtension[];
  /** Extensions qui ont déjà un classeur (signalées, toujours sélectionnables). */
  taken?: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const selected = extensions.find((e) => e.code === value) ?? null;
  const takenSet = useMemo(() => new Set(taken), [taken]);

  const groups = useMemo(() => {
    const q = fold(query.trim());
    const list = q
      ? extensions.filter((e) => fold(`${e.name} ${e.serie ?? ''} ${e.code}`).includes(q))
      : extensions;
    const bySerie = new Map<string, PickerExtension[]>();
    for (const e of list) {
      const key = e.serie ?? 'Autres';
      bySerie.set(key, [...(bySerie.get(key) ?? []), e]);
    }
    return [...bySerie];
  }, [extensions, query]);

  const open = () => {
    setQuery('');
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  return (
    <>
      {/* Champ requis (non caché, pour la validation du navigateur) : sans choix, l'envoi du
          formulaire ouvre le sélecteur. */}
      <input
        name={name}
        value={value}
        onChange={() => {}}
        required
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onInvalid={(e) => {
          e.preventDefault();
          open();
        }}
      />
      <button
        type="button"
        onClick={open}
        className="flex h-14 w-full items-center gap-3 rounded-xl border border-input bg-transparent px-3 text-left text-sm transition-colors hover:bg-accent"
      >
        {selected ? (
          <>
            <ExtensionLogo ext={selected} className="h-9 w-16 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{selected.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[selected.serie, selected.year].filter(Boolean).join(' · ')}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Choisir une extension…</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <dialog
        ref={ref}
        aria-label="Choisir une extension"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto h-[min(44rem,calc(100dvh-2rem))] w-[min(56rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-center gap-3 border-b p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une extension ou une série…"
              aria-label="Rechercher une extension"
              className="pl-9"
            />
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={close} aria-label="Fermer">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune extension ne correspond.
            </p>
          )}
          {groups.map(([serie, list]) => (
            <section key={serie} className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {serie} <span className="font-normal">· {list.length}</span>
              </h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((e) => {
                  const active = e.code === value;
                  return (
                    <li key={e.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setValue(e.code);
                          close();
                        }}
                        aria-pressed={active}
                        className={cn(
                          'relative flex h-full w-full flex-col items-center gap-2 rounded-xl border bg-popover/40 p-3 text-center transition-colors hover:bg-accent',
                          active && 'border-primary bg-primary/10',
                        )}
                      >
                        {active && <Check className="absolute top-2 right-2 size-4 text-primary" />}
                        <ExtensionLogo ext={e} className="h-12 w-full" />
                        <span className="line-clamp-2 text-sm leading-tight font-semibold">
                          {e.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.year ?? ''}
                          {takenSet.has(e.code) ? `${e.year ? ' · ' : ''}classeur existant` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}

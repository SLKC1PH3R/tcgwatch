'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Recherche globale (barre latérale) : produits, extensions, cartes Pokémon.
 * Raccourcis : « / » ou Ctrl+K pour placer le curseur dans le champ.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const current = pathname === '/recherche' ? (params.get('q') ?? '') : '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? '';
        if (q) router.push(`/recherche?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        key={current}
        name="q"
        type="search"
        defaultValue={current}
        placeholder="Rechercher…"
        aria-label="Rechercher un produit, une extension ou une carte"
        autoComplete="off"
        className="h-10 w-full min-w-0 rounded-full border border-input bg-card pr-10 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground md:block">
        /
      </kbd>
    </form>
  );
}

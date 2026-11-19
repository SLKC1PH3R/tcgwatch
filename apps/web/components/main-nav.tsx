'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV, isLinkActive, type NavEntry, type NavGroup } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const pill =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const pillActive = 'bg-foreground text-background hover:bg-foreground hover:text-background';

/** Menu principal (ordinateur) : liens directs et sous-menus déroulants. */
export function MainNav() {
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(path);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Changement de page : on referme le sous-menu.
  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(null);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      navRef.current?.querySelector<HTMLButtonElement>(`[data-menu="${open}"]`)?.focus();
      setOpen(null);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hoverOpen = (label: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-full border bg-popover p-1"
    >
      {NAV.map((entry, index) => {
        const active = entry.match(path);
        if (!entry.groups) {
          return (
            <Link
              key={entry.label}
              href={entry.href!}
              aria-current={active ? 'page' : undefined}
              className={cn(pill, active && pillActive)}
            >
              {entry.label}
            </Link>
          );
        }
        const isOpen = open === entry.label;
        const panelId = `menu-${index}`;
        return (
          <div
            key={entry.label}
            className="relative"
            onPointerEnter={hoverOpen(entry.label)}
            onPointerLeave={hoverClose}
          >
            <button
              type="button"
              data-menu={entry.label}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : entry.label)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown') return;
                e.preventDefault();
                setOpen(entry.label);
                requestAnimationFrame(() =>
                  document.querySelector<HTMLAnchorElement>(`#${panelId} a`)?.focus(),
                );
              }}
              className={cn(pill, 'cursor-pointer', active && pillActive)}
            >
              {entry.label}
              <ChevronDown
                aria-hidden
                className={cn('size-3.5 opacity-70 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
            {isOpen && (
              <MenuPanel
                id={panelId}
                entry={entry}
                align={index >= NAV.length - 2 ? 'end' : 'start'}
                path={path}
                params={params}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function MenuPanel({
  id,
  entry,
  align,
  path,
  params,
}: {
  id: string;
  entry: NavEntry;
  align: 'start' | 'end';
  path: string;
  params: URLSearchParams;
}) {
  const groups = entry.groups!;
  return (
    // pt-2 : « pont » invisible entre le bouton et le panneau, le survol ne se perd pas.
    <div
      id={id}
      className={cn('absolute top-full z-40 pt-2', align === 'end' ? 'right-0' : 'left-0')}
    >
      <div
        className={cn(
          'grid gap-1 rounded-2xl border bg-popover p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)]',
          groups.length > 1 ? 'w-[40rem] grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3' : 'w-80',
        )}
      >
        {groups.length > 2 ? (
          // Plus de deux groupes : les listes détaillées empilées à gauche, la grille compacte
          // à droite (sinon le groupe suivant attend la fin de la grille, d'où un grand vide).
          <>
            <div className="flex flex-col gap-1">
              {groups
                .filter((g) => !g.compact)
                .map((g, i) => (
                  <MenuGroup key={i} group={g} path={path} params={params} />
                ))}
            </div>
            <div className="flex flex-col gap-1">
              {groups
                .filter((g) => g.compact)
                .map((g, i) => (
                  <MenuGroup key={i} group={g} path={path} params={params} />
                ))}
            </div>
          </>
        ) : (
          groups.map((g, i) => <MenuGroup key={i} group={g} path={path} params={params} />)
        )}
      </div>
    </div>
  );
}

function MenuGroup({
  group,
  path,
  params,
}: {
  group: NavGroup;
  path: string;
  params: URLSearchParams;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {group.label && (
        <span className="px-3 pt-1.5 pb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {group.label}
        </span>
      )}
      <ul className={cn(group.compact ? 'grid grid-cols-2 gap-0.5 px-1' : 'flex flex-col')}>
        {group.items.map((link) => {
          const active = isLinkActive(link, path, params);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                title={group.compact ? link.hint : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-xl transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  group.compact ? 'px-3 py-1.5 text-sm font-medium' : 'px-3 py-1.5',
                  active && 'bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-2',
                    !group.compact && 'text-sm font-semibold',
                    active && 'text-primary',
                  )}
                >
                  {active && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                  {link.label}
                </span>
                {!group.compact && link.hint && (
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {link.hint}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

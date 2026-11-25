'use client';

import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { NAV, isLinkActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/** Menu mobile : panneau plein écran, sections dépliables (ouverte : celle de la page). */
export function MobileNav({ footer }: { footer?: React.ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(path);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      {/* Portail vers <body> : l'en-tête floute son fond (backdrop-filter), ce qui
          confinerait un panneau en position fixe à sa propre hauteur. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <BrandLogo />
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1">
                {NAV.map(({ label, icon: Icon, href, match, groups }) => {
                  const active = match(path);
                  if (!groups) {
                    return (
                      <li key={label}>
                        <Link
                          href={href!}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-accent',
                            active && 'bg-accent text-primary',
                          )}
                        >
                          <Icon className="size-5 text-muted-foreground" aria-hidden />
                          {label}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={label}>
                      <details open={active} className="group rounded-xl open:bg-card">
                        <summary
                          className={cn(
                            'flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-accent [&::-webkit-details-marker]:hidden',
                            active && 'text-primary',
                          )}
                        >
                          <Icon className="size-5 text-muted-foreground" aria-hidden />
                          <span className="flex-1">{label}</span>
                          <ChevronDown
                            aria-hidden
                            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                          />
                        </summary>
                        <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
                          {groups.map((g, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              {g.label && (
                                <span className="pt-1 pl-8 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                  {g.label}
                                </span>
                              )}
                              <ul
                                className={cn(
                                  g.compact ? 'flex flex-wrap gap-2 pl-8' : 'flex flex-col gap-0.5',
                                )}
                              >
                                {g.items.map((link) => {
                                  const on = isLinkActive(link, path, params);
                                  return (
                                    <li key={link.href}>
                                      <Link
                                        href={link.href}
                                        aria-current={on ? 'page' : undefined}
                                        className={cn(
                                          g.compact
                                            ? 'flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-accent'
                                            : 'flex min-h-11 items-center gap-3 rounded-lg py-1.5 pl-1 text-sm font-medium hover:bg-accent',
                                          on &&
                                            (g.compact
                                              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                                              : 'text-primary'),
                                        )}
                                      >
                                        {g.compact ? (
                                          link.label
                                        ) : (
                                          <>
                                            {link.icon ? (
                                              <link.icon
                                                aria-hidden
                                                className="size-4 shrink-0 text-muted-foreground"
                                              />
                                            ) : (
                                              <span className="size-4 shrink-0" />
                                            )}
                                            <span className="flex flex-col">
                                              {link.label}
                                              {link.hint && (
                                                <span className="text-xs font-normal text-muted-foreground">
                                                  {link.hint}
                                                </span>
                                              )}
                                            </span>
                                          </>
                                        )}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {footer}
          </div>,
          document.body,
        )}
    </>
  );
}

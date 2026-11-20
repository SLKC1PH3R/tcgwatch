'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { currentLocation } from '@/lib/navigation';

/**
 * Fil d'Ariane des sections à sous-menu (Produits › Prix par type › ETB) : on sait où l'on est
 * sans répéter les onglets, qui vivent désormais dans le menu principal.
 */
export function PageTrail() {
  const path = usePathname();
  const params = useSearchParams();
  const here = currentLocation(path, params);
  if (!here?.link) return null;
  const { entry, group, link } = here;
  const first = entry.groups![0]!.items[0]!;
  const steps = [
    { label: entry.label, href: first.href },
    ...(group?.label ? [{ label: group.label, href: group.items[0]!.href }] : []),
  ];
  const onLinkPage = path === link.href;
  return (
    <nav aria-label="Fil d’Ariane" className="mb-4 fit:mb-1.5">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground fit:text-xs">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <Link href={s.href} className="hover:text-foreground hover:underline">
              {s.label}
            </Link>
            <ChevronRight aria-hidden className="size-3.5 opacity-60" />
          </li>
        ))}
        <li>
          {onLinkPage ? (
            <span aria-current="page" className="font-semibold text-foreground">
              {link.label}
            </span>
          ) : (
            <Link href={link.href} className="font-semibold text-foreground hover:underline">
              {link.label}
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}

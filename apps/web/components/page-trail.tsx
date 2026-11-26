'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { currentLocation, NAV } from '@/lib/navigation';

/**
 * Étiquette de section au-dessus du titre, façon page d'accueil : numéro de la section du menu,
 * puis le chemin en capitales mono (« 02 — SCELLÉ · SUIVRE ET ACHETER · RETOURS EN STOCK »).
 * Chaque étape mène à sa page.
 */
export function PageTrail() {
  const path = usePathname();
  const params = useSearchParams();
  const entry = NAV.find((e) => e.match(path));
  if (!entry) return null;
  const number = String(NAV.indexOf(entry) + 1).padStart(2, '0');
  const here = currentLocation(path, params);
  const first = entry.groups?.[0]?.items[0];
  const steps = [
    { label: entry.label, href: entry.href ?? first?.href },
    ...(here?.group?.label && here.link
      ? [{ label: here.group.label, href: here.group.items[0]!.href }]
      : []),
  ];
  const link = here?.link;

  return (
    <nav aria-label="Fil d’Ariane" className="mb-3 fit:mb-1.5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 label-mono text-muted-foreground">
        <li aria-hidden className="font-medium text-primary">
          {number} —
        </li>
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {s.href ? (
              <Link href={s.href} className="hover:text-foreground">
                {s.label}
              </Link>
            ) : (
              s.label
            )}
          </li>
        ))}
        {link && link.label !== entry.label && (
          <li className="flex items-center gap-2">
            <span aria-hidden>·</span>
            {path === link.href ? (
              <span aria-current="page" className="text-foreground">
                {link.label}
              </span>
            ) : (
              <Link href={link.href} className="text-foreground hover:underline">
                {link.label}
              </Link>
            )}
          </li>
        )}
      </ol>
    </nav>
  );
}

'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { Theme } from '@/lib/theme';

const NEXT: Record<Theme, Theme> = { dark: 'light', light: 'system', system: 'dark' };
const LABEL: Record<Theme, string> = {
  dark: 'Thème sombre',
  light: 'Thème clair',
  system: 'Thème de l’appareil',
};
const ICON = { dark: Moon, light: Sun, system: Monitor };

/** Bouton de thème : sombre → clair → appareil (cookie d'un an, appliqué sans recharger). */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const Icon = ICON[theme];
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[theme];
        document.documentElement.dataset.theme = next;
        document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
        setTheme(next);
      }}
      aria-label={`${LABEL[theme]} (changer)`}
      title={`${LABEL[theme]} : cliquer pour passer au ${LABEL[NEXT[theme]].toLowerCase()}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
    >
      <Icon className="size-4.5" />
    </button>
  );
}

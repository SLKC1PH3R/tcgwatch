'use client';

import { useEffect } from 'react';

/** Même condition que les sections plein écran de landing.module.css. */
const MEDIA =
  '(min-width: 1025px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';
const DURATION = 750;
const KEYS_DOWN = new Set(['PageDown', 'ArrowDown', ' ']);
const KEYS_UP = new Set(['PageUp', 'ArrowUp']);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Défilement section par section sur ordinateur : un cran de molette (ou Page suivante, flèche,
 * espace) fait glisser jusqu'au début de la section suivante ou précédente, qui s'arrête en
 * plein écran. Une section plus haute que l'écran se lit d'abord normalement jusqu'à sa fin.
 */
export function SectionPager() {
  useEffect(() => {
    const media = window.matchMedia(MEDIA);
    let busy = false;
    let last = 0;
    let raf = 0;

    const sections = () => [...document.querySelectorAll<HTMLElement>('[data-snap]')];
    const tops = () => sections().map((el) => el.getBoundingClientRect().top + window.scrollY);

    const animate = (to: number) => {
      const from = window.scrollY;
      if (Math.abs(to - from) < 2) return;
      busy = true;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(step);
        else {
          // Laisse passer l'inertie du pavé tactile avant d'accepter un nouveau geste.
          setTimeout(() => (busy = false), 350);
        }
      };
      raf = requestAnimationFrame(step);
    };

    /** true si le geste a été pris en charge (et le défilement natif doit être annulé). */
    const move = (dir: 1 | -1): boolean => {
      const y = window.scrollY;
      const h = window.innerHeight;
      const list = sections();
      const starts = tops();
      // Section affichée : la dernière dont le haut est passé (à 2 px près).
      let i = 0;
      for (let k = 0; k < starts.length; k++) if (starts[k]! <= y + 2) i = k;
      const el = list[i];
      if (!el) return false;
      const top = starts[i]!;
      const bottom = top + el.offsetHeight;
      // Section plus haute que l'écran : on la parcourt normalement jusqu'au bout.
      if (dir === 1 && bottom > y + h + 2) {
        if (bottom - (y + h) < h * 0.5) {
          animate(bottom - h);
          return true;
        }
        return false;
      }
      if (dir === -1 && y > top + 2) {
        if (y - top < h * 0.5) {
          animate(top);
          return true;
        }
        return false;
      }
      const target = starts[i + dir];
      if (target === undefined) return false;
      // En remontant vers une section haute, on arrive sur sa fin.
      const prev = list[i + dir];
      animate(
        dir === -1 && prev && prev.offsetHeight > h + 2 ? target + prev.offsetHeight - h : target,
      );
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      if (!media.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      if (busy) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 4) return;
      const now = performance.now();
      if (now - last < 120) {
        e.preventDefault();
        return;
      }
      last = now;
      if (move(e.deltaY > 0 ? 1 : -1)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!media.matches || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, summary, [contenteditable]')) return;
      const dir =
        KEYS_DOWN.has(e.key) && !e.shiftKey
          ? 1
          : KEYS_UP.has(e.key) || (e.key === ' ' && e.shiftKey)
            ? -1
            : 0;
      if (!dir) return;
      if (busy || move(dir)) e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return null;
}

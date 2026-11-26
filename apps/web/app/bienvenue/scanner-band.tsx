'use client';

import { useEffect, useRef } from 'react';
import s from './landing.module.css';

export interface ScanCard {
  id: string;
  image: string;
  /** Données « lues » par le scanner, affichées une fois la ligne passée. */
  data: [label: string, value: string][];
}

const CHARS = '01░▒▓<>/\\|#%*+=-:.';

/** Remplissage pseudo-aléatoire mais stable (même rendu côté serveur et navigateur). */
function filler(seed: string, rows: number, cols: number): string[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => CHARS[Math.floor(next() * CHARS.length)]).join(''),
  );
}

function Ascii({ card }: { card: ScanCard }) {
  const rows = filler(card.id, 30, 34);
  return (
    <div className={s.scanAscii} aria-hidden>
      {'┌ SCAN ─────────────────────┐\n'}
      {card.data.map(([label, value]) => (
        <span key={label}>
          {`│ ${label.padEnd(6)} `}
          <b>{value}</b>
          {'\n'}
        </span>
      ))}
      {'│ STATUT '}
      <em>AJOUTÉE AU CLASSEUR</em>
      {'\n└───────────────────────────┘\n'}
      {rows.join('\n')}
    </div>
  );
}

/**
 * Bande de cartes qui défile sous une ligne de scan : à droite de la ligne, la carte ; à gauche,
 * ce que le scanner en a lu. Immobile si l'utilisateur préfère moins d'animations.
 */
export function ScannerBand({ cards }: { cards: ScanCard[] }) {
  const band = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = band.current;
    const t = track.current;
    if (!b || !t) return;
    const items = [...t.querySelectorAll<HTMLElement>('[data-scan]')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let offset = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const clip = () => {
      const box = b.getBoundingClientRect();
      const line = box.left + box.width / 2;
      for (const el of items) {
        const r = el.getBoundingClientRect();
        const pct = Math.min(100, Math.max(0, ((line - r.left) / r.width) * 100));
        el.style.setProperty('--clip', `${pct}%`);
      }
    };
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const half = t.scrollWidth / 2;
      offset = (offset + dt * 0.06) % half;
      t.style.transform = `translate3d(${-offset}px, 0, 0)`;
      clip();
      if (visible) raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      // Une carte coupée par la ligne, pour montrer le principe sans mouvement.
      const first = items[1] ?? items[0];
      if (first) {
        const box = b.getBoundingClientRect();
        offset = first.offsetLeft + first.offsetWidth / 2 - box.width / 2;
        t.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      clip();
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(b);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const loop = [...cards, ...cards];
  return (
    <div ref={band} className={s.band}>
      <div ref={track} className={s.track}>
        {loop.map((card, i) => (
          <div key={`${card.id}-${i}`} className={s.scanCard} data-scan>
            <div className={s.scanNormal}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.image}
                alt={i < cards.length ? (card.data[0]?.[1] ?? '') : ''}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <Ascii card={card} />
          </div>
        ))}
      </div>
      <div className={s.scanLine} aria-hidden />
    </div>
  );
}

/** Interrupteurs d'alertes de démonstration (rien n'est enregistré). */
export function AlertSwitches({
  items,
}: {
  items: { title: string; hint: string; on: boolean }[];
}) {
  return (
    <ul className={s.switches}>
      {items.map((it) => (
        <li key={it.title}>
          <div>
            <b>{it.title}</b>
            <small>{it.hint}</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={it.on}
            aria-label={it.title}
            className={s.switch}
            onClick={(e) => {
              const b = e.currentTarget;
              b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
            }}
          />
        </li>
      ))}
    </ul>
  );
}

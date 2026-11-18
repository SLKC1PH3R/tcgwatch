'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import { PeakChart } from '@/components/ui/peak-chart';

type Point = { day: string; value: number; invested: number };

/** Périodes du menu, en nombre de points (un point par jour). */
const PERIODS: Record<string, number> = { '7 jours': 7, '30 jours': 30, '1 an': 366 };
const PERIOD_NAMES = Object.keys(PERIODS);

/** Rapport hauteur / largeur de la carte PeakChart (540 × 696). */
const CARD_RATIO = 696 / 540;
/** Même seuil que la variante Tailwind `fit` (accueil plein écran). */
const FIT_QUERY = '(min-width: 64rem) and (min-height: 42rem)';

/** Reflet holographique posé sur la lueur du graphique (teinte seule, la luminosité reste). */
const HOLO = 'linear-gradient(135deg, #ffd43b, #ff6b9a, #8b7cff, #4fd1ff, #6ee7a0)';
const EDGE_FADE =
  'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent), linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent)';

const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

/**
 * Performance de la collection en carte « PeakChart » : la courbe de valeur estimée sur la
 * période choisie, la valeur actuelle en grand et la plus-value en légende. En plein écran, la
 * carte prend la plus grande taille qui tient dans son emplacement ; sinon, la largeur dispo.
 */
export function CollectionPeak({
  history,
  value,
  caption,
  note,
  trend,
}: {
  history: Point[];
  value: number;
  caption: string;
  /** Petit texte en haut à gauche de la carte (ex. total investi). */
  note: string;
  trend: 'up' | 'down';
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [period, setPeriod] = useState('1 an');

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = window.matchMedia(FIT_QUERY);
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const byHeight = fit.matches && h > 0 ? h / CARD_RATIO : Infinity;
      setWidth(Math.floor(Math.max(220, Math.min(w, byHeight, 640))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    fit.addEventListener('change', measure);
    return () => {
      ro.disconnect();
      fit.removeEventListener('change', measure);
    };
  }, []);

  const points = useMemo(() => history.slice(-PERIODS[period]!), [history, period]);
  const data = useMemo(() => points.map((p) => p.value), [points]);
  const labels = useMemo(
    () => points.map((p) => dayLabel.format(new Date(`${p.day}T00:00:00Z`))),
    [points],
  );

  return (
    <div
      ref={box}
      className="flex w-full items-center justify-center fit:min-h-0 fit:flex-1"
      // Réserve la hauteur avant la mesure, pour éviter un saut de mise en page.
      style={width ? undefined : { minHeight: 280 }}
    >
      {width > 0 && (
        // Le graphique est fondu dans la carte (pas de carte posée dessus) ; `isolate` limite le
        // mélange des couleurs à cette zone.
        <div className="relative isolate">
          <PeakChart
            width={width}
            data={data.length > 1 ? data : [value, value]}
            labels={labels}
            value={Math.round(value)}
            valueSuffix={' €'}
            title="Valeur estimée"
            caption={caption}
            updatedText={note}
            trend={trend}
            periods={PERIOD_NAMES}
            period={period}
            onPeriodChange={setPeriod}
            periodLabel="Période"
            accent="#8b7cff"
            locale="fr-FR"
            font="'Manrope Variable', ui-sans-serif, system-ui, sans-serif"
            formatValue={(v) => formatPrice(v)}
            blend
            fade={0.12}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: HOLO,
              mixBlendMode: 'color',
              opacity: 0.75,
              maskImage: EDGE_FADE,
              WebkitMaskImage: EDGE_FADE,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Petit graphique à plusieurs courbes (SVG rendu côté serveur, sans axes ni interaction) : pour
 * un aperçu, par exemple meilleur prix et prix du marché sur 30 jours. Les trous (null) coupent
 * la courbe.
 */
export function MiniLines({
  series,
  width = 320,
  height = 96,
  label,
}: {
  series: { values: (number | null)[]; color: string; dashed?: boolean }[];
  width?: number;
  height?: number;
  label: string;
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length < 2) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || Math.abs(max) || 1;
  const pad = 4;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const path = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full"
      preserveAspectRatio="none"
    >
      {series.map((s, i) => (
        <path
          key={i}
          d={path(s.values)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.dashed ? 1.5 : 2}
          strokeDasharray={s.dashed ? '4 4' : undefined}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

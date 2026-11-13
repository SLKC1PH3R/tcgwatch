/**
 * Mini-courbe SVG (sans bibliothèque) : évolution sur la période, verte si en hausse,
 * rouge si en baisse. Rendue côté serveur, sans interaction.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = values.at(-1)! >= values[0]!;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Évolution sur la période : ${up ? 'hausse' : 'baisse'}`}
      className="inline-block align-middle"
    >
      <polyline
        points={points}
        fill="none"
        stroke={up ? 'var(--success)' : 'var(--destructive)'}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

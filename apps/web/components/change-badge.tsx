import { cn } from '@/lib/utils';

const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Variation en % : ▲ vert, ▼ rouge, = gris ; « — » si inconnue. */
export function ChangeBadge({
  value,
  className,
  suffix,
}: {
  value: number | null | undefined;
  className?: string;
  suffix?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }
  const rounded = Math.round(value * 100);
  const tone =
    rounded > 0 ? 'text-success' : rounded < 0 ? 'text-destructive' : 'text-muted-foreground';
  const sign = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '=';
  return (
    <span className={cn('text-xs font-semibold tabular-nums', tone, className)}>
      {sign} {pct.format(Math.abs(rounded))} %{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

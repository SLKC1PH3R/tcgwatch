import { percent, type SetProgress } from '@/lib/card-sets';
import { cn } from '@/lib/utils';

/** Avancement Full Set (jaune) et, si l'extension a des reverses, Master Set (bleu). */
export function SetProgressBars({
  progress,
  className,
}: {
  progress: SetProgress;
  className?: string;
}) {
  const rows = [
    { label: 'Full Set', p: progress.full, bar: 'bg-primary' },
    ...(progress.master ? [{ label: 'Master Set', p: progress.master, bar: 'bg-info' }] : []),
  ];
  return (
    <div className={cn('space-y-1', className)}>
      {rows.map((r) => (
        <div key={r.label} className="space-y-0.5">
          {rows.length > 1 && (
            <p className="flex justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
              <span>{r.label}</span>
              <span>
                {r.p.owned}/{r.p.total} · {percent(r.p)} %
              </span>
            </p>
          )}
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', r.bar)}
              style={{ width: `${percent(r.p)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

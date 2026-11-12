import { daysUntil } from '@tcgwatch/shared';
import { Badge } from '@/components/ui/badge';

export function countdownLabel(days: number): string {
  if (days < 0) return 'Sorti';
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Demain';
  return `J-${days}`;
}

export function Countdown({ date }: { date: Date }) {
  const days = daysUntil(date);
  const variant = days < 0 ? 'secondary' : days <= 7 ? 'warning' : 'info';
  return (
    <Badge variant={variant} className="tabular-nums" title={`${days} jour(s)`}>
      {countdownLabel(days)}
    </Badge>
  );
}

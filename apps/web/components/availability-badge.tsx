import { AVAILABILITY_LABELS, type Availability } from '@tcgwatch/shared';
import { Badge } from '@/components/ui/badge';

const VARIANT: Record<Availability, 'success' | 'info' | 'destructive' | 'secondary'> = {
  IN_STOCK: 'success',
  PREORDER: 'info',
  OUT_OF_STOCK: 'destructive',
  UNKNOWN: 'secondary',
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return <Badge variant={VARIANT[availability]}>{AVAILABILITY_LABELS[availability]}</Badge>;
}

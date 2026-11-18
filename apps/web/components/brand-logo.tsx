import { cn } from '@/lib/utils';

/** Tracé du monogramme « TW » (Archivo élargi, graisse 900) : indépendant des polices chargées. */
const TW_PATH =
  'M23.14 33.2V27.21H19.63V24.94H29.61V27.21H26.1V33.2ZM32.37 33.2 29.94 24.94H32.97L33.95 28.6Q34.03 28.89 34.09 29.17Q34.15 29.44 34.2 29.67Q34.25 29.89 34.27 30.02H34.36Q34.38 29.89 34.42 29.71Q34.45 29.53 34.49 29.34Q34.53 29.14 34.57 28.95Q34.62 28.76 34.66 28.6L35.59 24.94H39.21L40.13 28.6Q40.19 28.82 40.24 29.08Q40.3 29.34 40.35 29.59Q40.39 29.84 40.43 30.02H40.51Q40.54 29.88 40.58 29.7Q40.62 29.52 40.66 29.32Q40.71 29.13 40.75 28.95Q40.8 28.76 40.84 28.6L41.83 24.94H44.58L42.16 33.2H38.75L37.56 28.56Q37.51 28.35 37.46 28.15Q37.41 27.94 37.37 27.78Q37.33 27.61 37.31 27.51H37.23Q37.19 27.66 37.14 27.85Q37.09 28.04 37.05 28.23Q37.01 28.41 36.97 28.56L35.77 33.2Z';

/**
 * Emblème TCGWatch : une main de trois cartes en éventail (holo violet et cyan derrière, carte
 * jaune devant avec le monogramme TW). Le liseré de la carte de devant reprend le fond de page.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="4 2 56 54" aria-hidden className={cn('shrink-0', className)}>
      <rect
        x="18"
        y="8"
        width="28"
        height="40"
        rx="5"
        fill="#8b7cff"
        transform="rotate(-17 32 54)"
      />
      <rect
        x="18"
        y="8"
        width="28"
        height="40"
        rx="5"
        fill="#4fd1ff"
        transform="rotate(15 32 54)"
      />
      <rect
        x="18"
        y="9"
        width="28"
        height="40"
        rx="5"
        fill="var(--primary)"
        stroke="var(--background)"
        strokeWidth="2.5"
      />
      <path fill="var(--primary-foreground)" d={TW_PATH} />
    </svg>
  );
}

/** Logo complet : emblème + « TCG WATCH » en capitales larges. */
export function BrandLogo({
  size = 'md',
  compact = false,
  className,
}: {
  size?: 'md' | 'lg';
  /** Un cran plus petit sur téléphone (en-tête). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        size === 'lg' ? 'gap-3' : compact ? 'gap-2 sm:gap-2.5' : 'gap-2.5',
        className,
      )}
    >
      <BrandMark className={size === 'lg' ? 'size-11' : compact ? 'size-7 sm:size-8' : 'size-8'} />
      <span
        className={cn(
          'font-wordmark leading-none font-black tracking-[0.04em] whitespace-nowrap text-foreground',
          size === 'lg' ? 'text-2xl' : compact ? 'text-base sm:text-lg' : 'text-lg',
        )}
      >
        TCG WATCH
      </span>
    </span>
  );
}

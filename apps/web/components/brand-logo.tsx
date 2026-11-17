import { cn } from '@/lib/utils';

/** Tracé du monogramme « TW » (Archivo élargi, graisse 900) : indépendant des polices chargées. */
const TW_PATH =
  'M21.66 35V28.01H17.57V25.37H29.21V28.01H25.12V35ZM32.43 35 29.6 25.37H33.13L34.27 29.64Q34.37 29.97 34.44 30.3Q34.51 30.62 34.57 30.88Q34.62 31.14 34.65 31.29H34.75Q34.78 31.14 34.82 30.93Q34.86 30.72 34.91 30.49Q34.95 30.27 35 30.04Q35.06 29.82 35.1 29.64L36.19 25.37H40.41L41.48 29.64Q41.55 29.89 41.62 30.19Q41.68 30.49 41.74 30.79Q41.79 31.08 41.83 31.29H41.93Q41.96 31.12 42.01 30.91Q42.06 30.7 42.11 30.48Q42.16 30.25 42.21 30.04Q42.27 29.82 42.31 29.64L43.47 25.37H46.68L43.85 35H39.88L38.49 29.58Q38.43 29.34 38.37 29.11Q38.31 28.87 38.27 28.67Q38.22 28.48 38.19 28.36H38.1Q38.05 28.53 38 28.76Q37.94 28.98 37.89 29.2Q37.84 29.41 37.8 29.58L36.4 35Z';

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

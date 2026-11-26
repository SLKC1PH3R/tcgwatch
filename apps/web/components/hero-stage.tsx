import { cn } from '@/lib/utils';

/**
 * Scène d'une photo (produit, carte) dans l'identité « scanner » : halo violet, anneau en
 * ellipse derrière l'objet, objet légèrement incliné.
 */
export function HeroStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-[1.625rem] border bg-card',
        'bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklab,var(--primary)_32%,transparent),transparent_62%)]',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-[-6%] top-1/2 h-[38%] w-[112%] -translate-y-1/2 text-primary"
      >
        <ellipse
          cx="200"
          cy="70"
          rx="190"
          ry="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.55"
          transform="rotate(-10 200 70)"
        />
      </svg>
      <div className="relative z-[1] flex size-full items-center justify-center">{children}</div>
    </div>
  );
}

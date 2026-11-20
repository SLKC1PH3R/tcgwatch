import { cn } from '@/lib/utils';

/**
 * Enveloppe d'une page plein écran (voir lib/fit.ts) : la mise en page de l'application lui
 * donne toute la hauteur de l'écran et ses enfants se la partagent.
 */
export function FitPage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-fit-screen className={cn('flex flex-col gap-4 fit:min-h-0 fit:flex-1', className)}>
      {children}
    </div>
  );
}

import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Vignette produit (images hébergées chez les revendeurs, sans envoi du référent). */
export function Thumb({ src, className }: { src: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          referrerPolicy="no-referrer"
          src={src}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground/50" />
      )}
    </span>
  );
}

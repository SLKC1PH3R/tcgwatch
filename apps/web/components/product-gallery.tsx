'use client';

import { useState } from 'react';
import { HeroStage } from '@/components/hero-stage';
import { cn } from '@/lib/utils';

/** Vignettes affichées au plus (les autres images restent ignorées). */
const MAX_THUMBS = 8;

/** Galerie produit : grande image + vignettes (images des fiches revendeurs). */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const visible = images.filter((u) => !broken.includes(u));
  if (visible.length === 0) return null;
  const main = visible[Math.min(current, visible.length - 1)]!;
  const hide = (url: string) => setBroken((b) => (b.includes(url) ? b : [...b, url]));

  return (
    <div className="space-y-3">
      <HeroStage className="h-72">
        <div className="flex h-52 w-[72%] -rotate-3 items-center justify-center rounded-2xl bg-white p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55),0_0_50px_-10px_color-mix(in_oklab,var(--primary)_45%,transparent)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            referrerPolicy="no-referrer"
            src={main}
            alt={alt}
            className="max-h-full max-w-full object-contain"
            onError={() => hide(main)}
          />
        </div>
      </HeroStage>
      {visible.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {visible.slice(0, MAX_THUMBS).map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Image ${i + 1}`}
              aria-pressed={url === main}
              className={cn(
                'flex size-14 items-center justify-center rounded-md border bg-white p-1 transition-colors',
                url === main
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'hover:border-foreground/40',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                referrerPolicy="no-referrer"
                src={url}
                alt=""
                loading="lazy"
                className="max-h-full max-w-full object-contain"
                onError={() => hide(url)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

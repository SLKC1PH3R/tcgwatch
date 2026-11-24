'use client';

import { useState } from 'react';

/** Image distante masquée si elle n'existe pas (logos et symboles TCGdex parfois absents). */
export function SafeImg({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Affiché à la place d'une image absente ou introuvable (sinon rien). */
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

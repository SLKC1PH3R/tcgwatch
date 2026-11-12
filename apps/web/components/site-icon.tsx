'use client';

import { useState } from 'react';

/** Favicon d'un site (servi par le site lui-même), initiale en repli. */
export function SiteIcon({ websiteUrl, name }: { websiteUrl: string; name: string }) {
  const [failed, setFailed] = useState(false);
  let src: string | null = null;
  try {
    src = new URL('/favicon.ico', websiteUrl).toString();
  } catch {
    src = null;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white text-sm font-semibold text-slate-700">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          referrerPolicy="no-referrer"
          src={src}
          alt=""
          loading="lazy"
          className="size-5 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

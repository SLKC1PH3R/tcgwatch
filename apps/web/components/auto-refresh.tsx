'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Recharge les données de la page toutes les `seconds` secondes tant qu'il est affiché. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

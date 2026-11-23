'use server';

import { cookies } from 'next/headers';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';

/** Retient le prix affiché pour les cartes (Cardmarket ou eBay FR) pour tout le site. */
export async function setPriceSourceAction(source: string) {
  (await cookies()).set(PRICE_COOKIE, parsePriceSource(source), {
    path: '/',
    maxAge: 365 * 86_400,
    sameSite: 'lax',
  });
}

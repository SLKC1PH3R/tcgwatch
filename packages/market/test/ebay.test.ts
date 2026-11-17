import { describe, expect, it } from 'vitest';
import { EbayClient } from '../src/ebay';

describe('API eBay (Browse)', () => {
  it('demande un jeton puis lit les annonces (prix, port, enchère)', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (url.includes('oauth2')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 7200 }));
      }
      return new Response(
        JSON.stringify({
          itemSummaries: [
            {
              itemId: 'v1|1|0',
              title: 'ETB Nuit Noire neuf',
              price: { value: '119.00', currency: 'EUR' },
              itemWebUrl: 'https://www.ebay.fr/itm/1',
              buyingOptions: ['FIXED_PRICE'],
              shippingOptions: [{ shippingCost: { value: '6.50' }, shippingCostType: 'FIXED' }],
              itemLocation: { postalCode: '67000', city: 'Strasbourg' },
              itemCreationDate: '2026-11-17T08:00:00.000Z',
            },
            {
              itemId: 'v1|2|0',
              title: 'ETB Nuit Noire enchère',
              price: { value: '150.00' },
              currentBidPrice: { value: '80.00' },
              itemWebUrl: 'https://www.ebay.fr/itm/2',
              buyingOptions: ['AUCTION'],
            },
          ],
        }),
      );
    }) as typeof fetch;
    const client = new EbayClient('id', 'secret', 'https://api.ebay.com', fetchImpl);
    const items = await client.search({ query: 'ETB Nuit Noire', maxPrice: 130 });
    expect(items[0]).toMatchObject({
      price: 119,
      shipping: 6.5,
      auction: false,
      location: '67000 Strasbourg',
    });
    expect(items[1]).toMatchObject({ price: 80, auction: true, shipping: null });
    const search = new URL(calls[1]!);
    expect(search.searchParams.get('filter')).toContain('price:[..130.00]');
    expect(search.searchParams.get('sort')).toBe('newlyListed');
    await client.search({ query: 'x' });
    expect(calls.filter((c) => c.includes('oauth2'))).toHaveLength(1);
  });
});

import { z } from 'zod';

/**
 * API officielle d'eBay (Browse API, https://developer.ebay.com) : annonces en cours sur
 * ebay.fr, les plus récentes d'abord. Clés gratuites d'un compte développeur eBay
 * (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET) ; sans clés, rien n'est interrogé.
 */
export const EBAY_API_URL = 'https://api.ebay.com';

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
const money = z.object({ value: z.string(), currency: z.string().optional() }).optional();
const itemSchema = z
  .object({
    itemId: z.string(),
    title: z.string(),
    price: money,
    currentBidPrice: money,
    itemWebUrl: z.string(),
    image: z.object({ imageUrl: z.string() }).optional(),
    condition: z.string().optional(),
    buyingOptions: z.array(z.string()).optional(),
    itemCreationDate: z.string().optional(),
    itemLocation: z
      .object({ city: z.string().optional(), postalCode: z.string().optional() })
      .partial()
      .optional(),
    shippingOptions: z
      .array(z.object({ shippingCost: money, shippingCostType: z.string().optional() }))
      .optional(),
  })
  .passthrough();
const searchSchema = z.object({ itemSummaries: z.array(itemSchema).optional() });

export interface EbayListing {
  externalId: string;
  title: string;
  price: number;
  shipping: number | null;
  currency: string;
  url: string;
  imageUrl: string | null;
  condition: string | null;
  location: string | null;
  localPickup: boolean;
  auction: boolean;
  listedAt: Date | null;
}

export interface EbaySearch {
  query: string;
  /** Prix maximal (hors port). */
  maxPrice?: number;
  /** Remise en main propre autour de ce code postal (rayon en km). */
  pickup?: { postalCode: string; radiusKm: number };
  limit?: number;
  /** `new` (défaut) : annonces neuves ; `any` : tous états (cartes à l'unité, jamais « neuves »). */
  condition?: 'new' | 'any';
  /** Catégorie eBay (183454 : cartes à collectionner à l'unité). */
  categoryId?: string;
}

export class EbayClient {
  private token?: { value: string; expires: number };
  /** Recherches faites par tous les clients du processus (quota eBay : 5 000 par jour). */
  static calls = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly baseUrl = EBAY_API_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const res = await this.fetchImpl(`${this.baseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`eBay OAuth : HTTP ${res.status}`);
    const body = tokenSchema.parse(await res.json());
    this.token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  /** Annonces neuves situées en France, les plus récentes d'abord. */
  async search(s: EbaySearch): Promise<EbayListing[]> {
    EbayClient.calls++;
    const filters = [
      'itemLocationCountry:FR',
      ...(s.condition === 'any' ? [] : ['conditionIds:{1000}']),
      'buyingOptions:{FIXED_PRICE|AUCTION|BEST_OFFER}',
    ];
    if (s.maxPrice) filters.push(`price:[..${s.maxPrice.toFixed(2)}]`, 'priceCurrency:EUR');
    if (s.pickup) {
      filters.push(
        'deliveryOptions:{SELLER_ARRANGED_LOCAL_PICKUP}',
        'pickupCountry:FR',
        `pickupPostalCode:${s.pickup.postalCode}`,
        `pickupRadius:${s.pickup.radiusKm}`,
        'pickupRadiusUnit:km',
      );
    }
    const q = new URLSearchParams({
      q: s.query,
      filter: filters.join(','),
      sort: 'newlyListed',
      limit: String(s.limit ?? 50),
      ...(s.categoryId ? { category_ids: s.categoryId } : {}),
    });
    const res = await this.fetchImpl(`${this.baseUrl}/buy/browse/v1/item_summary/search?${q}`, {
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'x-ebay-c-marketplace-id': 'EBAY_FR',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`eBay recherche « ${s.query} » : HTTP ${res.status}`);
    const body = searchSchema.parse(await res.json());
    return (body.itemSummaries ?? []).flatMap((i) => {
      const auction =
        (i.buyingOptions ?? []).includes('AUCTION') &&
        !(i.buyingOptions ?? []).includes('FIXED_PRICE');
      const price = Number((auction ? (i.currentBidPrice ?? i.price) : i.price)?.value);
      if (!Number.isFinite(price) || price <= 0) return [];
      const ship = i.shippingOptions?.[0];
      const shipping =
        ship?.shippingCostType === 'CALCULATED' || !ship?.shippingCost
          ? null
          : Number(ship.shippingCost.value);
      return [
        {
          externalId: i.itemId,
          title: i.title,
          price,
          shipping: Number.isFinite(shipping) ? shipping : null,
          currency: i.price?.currency ?? 'EUR',
          url: i.itemWebUrl,
          imageUrl: i.image?.imageUrl ?? null,
          condition: i.condition ?? null,
          location:
            [i.itemLocation?.postalCode, i.itemLocation?.city].filter(Boolean).join(' ') || null,
          localPickup: Boolean(s.pickup),
          auction,
          listedAt: i.itemCreationDate ? new Date(i.itemCreationDate) : null,
        },
      ];
    });
  }
}

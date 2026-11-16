import { Prisma, prisma } from '@tcgwatch/db';
import {
  cardmarketProductId,
  cardQuoteFromGuide,
  type CardmarketGuideEntry,
  TcgdexClient,
} from '@tcgwatch/market';
import { todayUtc } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** Une carte sans produit Cardmarket connu est redemandée à TCGdex au plus une fois par mois. */
const RECHECK_DAYS = 30;
/** Pause entre deux appels à TCGdex (API publique et gratuite : on reste discret). */
const LOOKUP_PAUSE_MS = 120;

/**
 * Produit Cardmarket des cartes qui n'en ont pas encore, lu sur leur fiche TCGdex : une seule
 * fois par carte, par lots quotidiens (`limit`). Extensions récentes et cartes rares d'abord,
 * pour que les cotes utiles arrivent en premier.
 */
export async function resolveCardmarketIds(
  ctx: WorkerContext,
  limit: number,
  client = new TcgdexClient(),
): Promise<{ checked: number; linked: number }> {
  const since = new Date(Date.now() - RECHECK_DAYS * 86_400_000);
  const cards = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c JOIN "Release" r ON r.id = c."releaseId"
    WHERE c."cardmarketId" IS NULL
      AND (c."cardmarketCheckedAt" IS NULL OR c."cardmarketCheckedAt" < ${since})
    ORDER BY (c.rarity IN ('Commune', 'Peu Commune')) ASC NULLS LAST,
      r."releaseDate" DESC NULLS LAST, c.number ASC NULLS LAST
    LIMIT ${limit}`;

  let linked = 0;
  for (const { id } of cards) {
    const card = await client.getCard(id).catch((err: unknown) => {
      ctx.logger.debug({ err, id }, 'Fiche TCGdex illisible');
      return null;
    });
    const cardmarketId = card ? cardmarketProductId(card) : null;
    await prisma.card.update({
      where: { id },
      data: { cardmarketId, cardmarketCheckedAt: new Date() },
    });
    if (cardmarketId) linked++;
    await new Promise((r) => setTimeout(r, LOOKUP_PAUSE_MS));
  }
  return { checked: cards.length, linked };
}

/**
 * Cote du jour de toutes les cartes liées à Cardmarket, d'après le guide des prix (un seul
 * fichier pour tout le catalogue) : une requête SQL, quel que soit le nombre de cartes.
 */
export async function applyCardPrices(guide: Map<number, CardmarketGuideEntry>): Promise<number> {
  const linked = await prisma.card.findMany({
    where: { cardmarketId: { not: null } },
    select: { id: true, cardmarketId: true },
  });
  const rows = linked.flatMap((c) => {
    const entry = guide.get(c.cardmarketId!);
    const q = entry ? cardQuoteFromGuide(entry) : null;
    return q
      ? [
          {
            id: c.id,
            trend: q.trend ?? q.price,
            low: q.low,
            avg1: q.avg1,
            avg7: q.avg7,
            avg30: q.avg30,
          },
        ]
      : [];
  });
  const CHUNK = 5000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$executeRaw`
      UPDATE "Card" AS c SET "priceTrend" = v.trend, "priceLow" = v.low, "priceAvg1" = v.avg1,
        "priceAvg7" = v.avg7, "priceAvg30" = v.avg30, "priceAt" = NOW()
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS v(
        id text, trend numeric, low numeric, avg1 numeric, avg7 numeric, avg30 numeric)
      WHERE c.id = v.id`;
  }
  return rows.length;
}

/**
 * Instantané quotidien de l'indice du marché : valeur totale des cartes cotées, des displays
 * et des ETB (dernière cote Cardmarket de chaque produit), une ligne par famille.
 */
export async function snapshotMarketIndex(date = todayUtc()): Promise<void> {
  const cards = await prisma.$queryRaw<{ value: Prisma.Decimal | null; count: bigint }[]>`
    SELECT sum("priceTrend") AS value, count(*) AS count FROM "Card" WHERE "priceTrend" > 0`;
  const sealed = await prisma.$queryRaw<
    { key: string; value: Prisma.Decimal | null; count: bigint }[]
  >`
    SELECT CASE p.type WHEN 'DISPLAY' THEN 'displays' WHEN 'ETB' THEN 'etb' ELSE 'other' END AS key,
      sum(m.price) AS value, count(*) AS count
    FROM "Product" p
    JOIN LATERAL (
      SELECT price FROM "MarketPrice" mp
      WHERE mp."productId" = p.id AND mp.source = 'cardmarket' AND mp.date > ${date}::date - 7
      ORDER BY mp.date DESC LIMIT 1
    ) m ON true
    GROUP BY 1`;
  const all = [
    { key: 'cards', value: cards[0]?.value, count: cards[0]?.count ?? 0n },
    ...sealed,
    {
      key: 'sealed',
      value: sealed.reduce((s, r) => s.add(r.value ?? 0), new Prisma.Decimal(0)),
      count: sealed.reduce((s, r) => s + r.count, 0n),
    },
  ];
  for (const row of all) {
    if (row.key === 'other') continue;
    const data = { value: row.value ?? 0, count: Number(row.count) };
    await prisma.marketIndexSnapshot.upsert({
      where: { date_key: { date, key: row.key } },
      update: data,
      create: { date, key: row.key, ...data },
    });
  }
}

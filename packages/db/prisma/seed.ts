/**
 * Données initiales : extension Règne Delta (ME06) et produits scellés associés,
 * coffrets 30e anniversaire, et les 4 revendeurs de la V1.
 *
 * Idempotent : peut être relancé sans créer de doublons.
 * Les dates non confirmées sont laissées vides (à compléter dans l'UI ou via les revendeurs).
 */
import { prisma } from '../src/index';

const RETAILERS = [
  {
    slug: 'play-in',
    name: 'Play-In',
    domain: 'play-in.com',
    adapterKey: 'playin',
    minDelayMs: 3000,
  },
  {
    slug: 'philibert',
    name: 'Philibert',
    domain: 'philibertnet.com',
    adapterKey: 'philibert',
    minDelayMs: 3000,
  },
  {
    slug: 'cultura',
    name: 'Cultura',
    domain: 'cultura.com',
    adapterKey: 'cultura',
    minDelayMs: 5000,
  },
  {
    slug: 'smyths',
    name: 'Smyths Toys',
    domain: 'smythstoys.com',
    adapterKey: 'smyths',
    minDelayMs: 5000,
  },
] as const;

async function main() {
  // `--if-empty` : ne rien faire si la base contient déjà des revendeurs (démarrage Docker).
  if (process.argv.includes('--if-empty') && (await prisma.retailer.count()) > 0) {
    console.log('Seed ignoré : la base contient déjà des données.');
    return;
  }

  for (const r of RETAILERS) {
    await prisma.retailer.upsert({ where: { slug: r.slug }, update: {}, create: r });
  }

  // Extension Règne Delta — date FR issue de TCGdex (api.tcgdex.net/v2/fr/sets/me06)
  const me06 = await prisma.release.upsert({
    where: { tcgdexId: 'me06' },
    update: {},
    create: {
      nameFr: 'Règne Delta',
      setCode: 'ME06',
      tcgdexId: 'me06',
      serie: 'Méga-Évolution',
      releaseDate: new Date('2026-11-06T00:00:00Z'),
      source: 'SEED',
      sourceUrl: 'https://api.tcgdex.net/v2/fr/sets/me06',
      status: 'VALIDATED',
    },
  });

  // Coffrets du 30e anniversaire : releases propres à un type de produit, date à confirmer.
  const upc30 = await upsertProductRelease({
    nameFr: 'Ultra Premium Collection 30e anniversaire',
    productType: 'UPC',
    notes: 'Date de sortie FR à confirmer.',
  });
  const lucario30 = await upsertProductRelease({
    nameFr: 'Collection autocollant 30 ans Lucario',
    productType: 'COFFRET',
    notes: 'Date de sortie FR à confirmer.',
  });

  const products = [
    {
      slug: 'etb-regne-delta-me06',
      name: 'Coffret Dresseur d’Élite Règne Delta (ME06)',
      type: 'ETB',
      releaseId: me06.id,
    },
    {
      slug: 'display-regne-delta-me06',
      name: 'Display 36 boosters Règne Delta (ME06)',
      type: 'DISPLAY',
      releaseId: me06.id,
    },
    {
      slug: 'tripack-regne-delta-me06',
      name: 'Tripack Règne Delta (ME06)',
      type: 'TRIPACK',
      releaseId: me06.id,
      ean: '196214144071',
    },
    {
      slug: 'upc-30e-anniversaire',
      name: 'Ultra Premium Collection 30e anniversaire',
      type: 'UPC',
      releaseId: upc30.id,
    },
    {
      slug: 'collection-autocollant-30-ans-lucario',
      name: 'Collection autocollant 30 ans Lucario',
      type: 'COFFRET',
      releaseId: lucario30.id,
    },
  ] as const;

  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  // Une fiche réelle pour pouvoir tester le suivi dès l'installation.
  const philibert = await prisma.retailer.findUniqueOrThrow({ where: { slug: 'philibert' } });
  const tripack = await prisma.product.findUniqueOrThrow({
    where: { slug: 'tripack-regne-delta-me06' },
  });
  await prisma.listing.upsert({
    where: {
      url: 'https://www.philibertnet.com/fr/pokemon/184181-pokemon-me06-regne-delta-pack-3-boosters-196214144071.html',
    },
    update: {},
    create: {
      productId: tripack.id,
      retailerId: philibert.id,
      url: 'https://www.philibertnet.com/fr/pokemon/184181-pokemon-me06-regne-delta-pack-3-boosters-196214144071.html',
    },
  });

  console.log('Seed terminé : %d revendeurs, %d produits.', RETAILERS.length, products.length);
}

async function upsertProductRelease(data: {
  nameFr: string;
  productType: 'UPC' | 'COFFRET';
  notes: string;
}) {
  const existing = await prisma.release.findFirst({
    where: { nameFr: data.nameFr, productType: data.productType },
  });
  if (existing) return existing;
  return prisma.release.create({ data: { ...data, source: 'SEED', status: 'AUTO' } });
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

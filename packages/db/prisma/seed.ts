/**
 * Données initiales : les revendeurs à adaptateur dédié. Les autres sites de l'annuaire, le
 * calendrier (TCGdex, Pokécardex) et le catalogue produits sont importés par le worker.
 *
 * Idempotent : peut être relancé sans créer de doublons.
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

  // Les produits ne sont plus créés ici : le worker importe le catalogue réel des sorties FR
  // (Pokécardex) et découvre automatiquement leurs fiches chez les revendeurs.
  console.log('Seed terminé : %d revendeurs.', RETAILERS.length);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

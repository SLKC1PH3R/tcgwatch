import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';
export * from './generated/prisma/enums';

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL est obligatoire pour se connecter à PostgreSQL');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Singleton : évite de multiplier les pools en développement (rechargement à chaud de Next.js).
const globalForPrisma = globalThis as unknown as { __tcgwatchPrisma?: PrismaClient };

/** Client Prisma paresseux : la connexion n'est créée qu'au premier accès. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = (globalForPrisma.__tcgwatchPrisma ??= createClient());
    const value: unknown = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

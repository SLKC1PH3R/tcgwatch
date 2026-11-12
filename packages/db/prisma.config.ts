import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Charge le .env racine du monorepo (puis un éventuel .env local au package).
config({
  path: [path.resolve(process.cwd(), '../../.env'), path.resolve(process.cwd(), '.env')],
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` n'a pas besoin d'une vraie base : valeur factice si absente.
    url:
      process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});

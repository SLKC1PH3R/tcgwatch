#!/bin/sh
# Démarrage du worker : migrations Prisma, seed initial (base vide uniquement), puis le process.
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "→ prisma migrate deploy"
  node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
fi

if [ "${SEED_IF_EMPTY:-false}" = "true" ]; then
  echo "→ seed (si base vide)"
  node dist/seed.js --if-empty
fi

exec "$@"

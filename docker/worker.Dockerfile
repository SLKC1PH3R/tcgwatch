# syntax=docker/dockerfile:1.7
# ─── TCGWatch — worker (relevés, imports, notifications) ─────────

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/adapters/package.json packages/adapters/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/market/package.json packages/market/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Bundle du worker + dossier autonome avec ses seules dépendances de production
# (Playwright, Prisma, pg, pino, node-cron) ; schéma et migrations pour `migrate deploy`.
RUN pnpm --filter @tcgwatch/db generate \
  && pnpm --filter @tcgwatch/worker build \
  && pnpm --filter @tcgwatch/worker deploy --prod /out \
  && cp -r packages/db/prisma /out/prisma \
  && cp packages/db/prisma.config.ts /out/prisma.config.ts \
  && node -p "require('./apps/worker/node_modules/playwright/package.json').version" > /playwright-version

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright WORKER_HEALTH_PORT=3001
WORKDIR /app
# Chromium + dépendances système, pour les sites rendus en JavaScript (Cultura, Smyths…).
# Installé AVANT le code : la couche reste en cache tant que la version de Playwright ne
# change pas (sinon ~7 min de paquets et de téléchargement à chaque déploiement).
COPY --from=build /playwright-version /tmp/playwright-version
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && npx -y "playwright@$(cat /tmp/playwright-version)" install --with-deps --only-shell chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/playwright-version \
  && chown -R node:node /ms-playwright && chown node:node /app
# --chown à la copie : un `chown -R` sur node_modules recopie chaque fichier dans une
# nouvelle couche (très long, sans aucune sortie dans les logs de build).
COPY --from=build --chown=node:node /out ./
COPY --chmod=755 docker/worker-entrypoint.sh /usr/local/bin/worker-entrypoint
USER node
EXPOSE 3001
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["worker-entrypoint"]
CMD ["node", "dist/index.js"]

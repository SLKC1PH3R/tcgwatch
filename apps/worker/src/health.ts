import { createServer, type Server } from 'node:http';
import { prisma } from '@tcgwatch/db';
import type { WorkerContext } from './context';

/** Le tick des listings tourne chaque minute : au-delà de 5 min sans tick, le worker est « dégradé ». */
const STALE_TICK_MS = 5 * 60 * 1000;

export function startHealthServer(ctx: WorkerContext): Server {
  const server = createServer(async (req, res) => {
    if (req.url !== '/api/health' && req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    let database = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }
    const lastTick = ctx.status.lastListingsTick;
    const uptimeMs = Date.now() - ctx.status.startedAt.getTime();
    const stale = lastTick
      ? Date.now() - lastTick.getTime() > STALE_TICK_MS
      : uptimeMs > STALE_TICK_MS;
    const ok = database === 'ok' && !stale;
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: ok ? 'ok' : 'degraded',
        service: 'worker',
        database,
        uptimeSeconds: Math.round(uptimeMs / 1000),
        ...ctx.status,
      }),
    );
  });
  server.listen(ctx.env.WORKER_HEALTH_PORT, () =>
    ctx.logger.info({ port: ctx.env.WORKER_HEALTH_PORT }, 'Healthcheck du worker démarré'),
  );
  return server;
}

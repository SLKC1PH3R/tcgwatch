import { prisma } from '@tcgwatch/db';

export const dynamic = 'force-dynamic';

/** Healthcheck (Docker / Dokploy) : 200 si l'app et la base répondent. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: 'ok',
      service: 'web',
      database: 'ok',
      latencyMs: Date.now() - started,
    });
  } catch {
    return Response.json({ status: 'error', service: 'web', database: 'error' }, { status: 503 });
  }
}

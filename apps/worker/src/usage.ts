import { prisma } from '@tcgwatch/db';
import { todayUtc } from '@tcgwatch/shared';

/** Ajoute des appels au compteur du jour d'une API à quota (tableau de bord des sources). */
export async function recordApiCalls(source: string, calls: number): Promise<void> {
  if (calls <= 0) return;
  const day = todayUtc();
  await prisma.apiUsage
    .upsert({
      where: { source_day: { source, day } },
      create: { source, day, calls },
      update: { calls: { increment: calls } },
    })
    .catch(() => undefined);
}

/** Début d'un passage de tâche ; la fonction renvoyée l'enregistre comme terminé. */
export async function startJobRun(job: string) {
  const run = await prisma.jobRun.create({ data: { job } }).catch(() => null);
  return async (error?: string) => {
    if (!run) return;
    await prisma.jobRun
      .update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: !error, error: error?.slice(0, 500) ?? null },
      })
      .catch(() => undefined);
  };
}

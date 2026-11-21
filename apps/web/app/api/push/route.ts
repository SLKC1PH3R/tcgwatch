import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { getCurrentUser } from '@/lib/auth';

const subscription = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});

/** Abonne cet appareil aux notifications de l'utilisateur connecté. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Non autorisé', { status: 401 });
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Abonnement invalide', { status: 400 });
  const { endpoint, keys } = parsed.data;
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  return Response.json({ ok: true });
}

/** Désabonne cet appareil. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Non autorisé', { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return Response.json({ ok: true });
}

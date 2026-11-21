import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { matchCardHash } from '@/lib/data/card-scan';

const body = z.object({
  hash: z.string().regex(/^[0-9a-f]{16}$/),
  release: z.string().max(40).optional(),
});

/** Scanner : cartes dont l'illustration ressemble à la photo (empreinte calculée par le navigateur). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Non autorisé', { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Requête invalide', { status: 400 });
  const matches = await matchCardHash(user.id, parsed.data.hash, parsed.data.release || undefined);
  return Response.json({ matches });
}

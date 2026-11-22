import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { matchCardScan } from '@/lib/data/card-scan';

const signature = z.object({
  hash: z.string().regex(/^[0-9a-f]{16}$/),
  color: z.string().regex(/^[0-9a-f]{64}$/),
});
const body = z.object({
  candidates: z.array(signature).min(1).max(16),
  release: z.string().max(40).optional(),
});

/**
 * Scanner : cartes dont l'illustration ressemble à la photo. Le navigateur envoie l'empreinte et
 * les couleurs de plusieurs cadrages possibles de la carte.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Non autorisé', { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Requête invalide', { status: 400 });
  const result = await matchCardScan(
    user.id,
    parsed.data.candidates,
    parsed.data.release || undefined,
  );
  return Response.json(result);
}

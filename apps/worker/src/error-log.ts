import { createHash } from 'node:crypto';
import { prisma } from '@tcgwatch/db';

/** Source d'une erreur, d'après le message et l'objet du log. */
export function errorSource(obj: Record<string, unknown>, msg: string, detail: string): string {
  const text = `${msg} ${detail}`;
  if (/ebay/i.test(text)) return 'ebay';
  if (/tcgdex|pokemontcg/i.test(text) || 'set' in obj || 'serie' in obj) return 'tcgdex';
  if (/pok[ée]cardex/i.test(text)) return 'pokecardex';
  if (/cardmarket|provider|cartes phares|cotation/i.test(text) || 'provider' in obj) {
    return 'cardmarket';
  }
  if ('retailer' in obj || 'listing' in obj || /revendeur|boutique|découverte/i.test(text)) {
    return 'boutiques';
  }
  if (/notification|telegram|ntfy/i.test(text) || 'channel' in obj) return 'notifications';
  return 'worker';
}

/** Objet concerné, lisible : boutique, extension, carte, produit… */
function subjectOf(obj: Record<string, unknown>): string | null {
  for (const k of ['retailer', 'set', 'serie', 'card', 'product', 'release', 'provider', 'job']) {
    const v = obj[k];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

function detailOf(obj: Record<string, unknown>): string {
  const err = obj.err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String(err.message);
  return typeof err === 'string' ? err : '';
}

/**
 * Enregistre un avertissement ou une erreur du worker (sans attendre, sans jamais échouer).
 * Les répétitions sont regroupées : même source, message, détail et objet → compteur.
 */
export function recordWorkerProblem(
  level: 'warn' | 'error',
  obj: Record<string, unknown>,
  msg: string,
): void {
  // Ni le journal lui-même ni les messages sans erreur (avertissements de configuration).
  if (!msg || obj.workerErrorLog === false) return;
  const detail = detailOf(obj).slice(0, 500);
  const source = errorSource(obj, msg, detail);
  const subject = subjectOf(obj);
  // Les numéros variables (ids, durées) ne doivent pas multiplier les groupes.
  const shape = detail.replace(/\d{4,}/g, '#');
  const key = createHash('sha1')
    .update([source, msg, shape, subject ?? ''].join('\u0000'))
    .digest('hex');
  void prisma.workerError
    .upsert({
      where: { key },
      create: { key, source, level, message: msg.slice(0, 300), detail: detail || null, subject },
      update: { count: { increment: 1 }, lastAt: new Date(), level, detail: detail || null },
    })
    .catch(() => {});
}

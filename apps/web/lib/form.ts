import { z } from 'zod';

/** Champ texte optionnel : chaîne vide → undefined. */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

/** Prix optionnel saisi en français ("54,90") ou anglais ("54.90"). */
export const optionalPrice = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: `Prix invalide : ${v}` });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const requiredPrice = z
  .string()
  .trim()
  .min(1, 'Prix requis')
  .transform((v, ctx) => {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: `Prix invalide : ${v}` });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

/** Date "AAAA-MM-JJ" d'un <input type="date"> → Date UTC minuit, ou null. */
export const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      ctx.addIssue({ code: 'custom', message: `Date invalide : ${v}` });
      return z.NEVER;
    }
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  });

/** Convertit un FormData en objet simple (valeurs texte uniquement). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Formulaire invalide';
}

/** Date → valeur d'<input type="date">. */
export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

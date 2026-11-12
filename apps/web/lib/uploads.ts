import 'server-only';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from '@tcgwatch/shared/env';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function uploadRoot(): string {
  return path.resolve(getEnv().UPLOAD_DIR);
}

/** Vérifie la signature binaire (le type MIME envoyé par le navigateur n'est pas fiable). */
function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (buf.subarray(4, 12).toString() === 'ftypavif') return 'image/avif';
  return null;
}

/** Enregistre une photo de collection ; renvoie son chemin relatif (ex. "collection/ab12.jpg"). */
export async function saveCollectionPhoto(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('Photo trop lourde (5 Mo maximum).');
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type || !TYPES[type]) throw new Error('Format non pris en charge (JPEG, PNG, WebP, AVIF).');
  const relative = `collection/${randomBytes(12).toString('hex')}.${TYPES[type]}`;
  const target = path.join(uploadRoot(), relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buf);
  return relative;
}

export async function deleteUpload(relative: string | null | undefined) {
  if (!relative) return;
  const target = resolveUpload(relative);
  if (target) await unlink(target).catch(() => undefined);
}

/** Résout un chemin relatif en refusant toute sortie du dossier d'uploads. */
export function resolveUpload(relative: string): string | null {
  const root = uploadRoot();
  const target = path.resolve(root, relative);
  return target.startsWith(root + path.sep) ? target : null;
}

export const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

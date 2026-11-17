import { z } from 'zod';

/**
 * API publique Pokémon TCG (pokemontcg.io) : images des cartes en anglais. Source de secours
 * quand TCGdex n'a pas d'image (promos, kits du dresseur, galeries, cartes spéciales).
 */
export const POKEMONTCG_BASE_URL = 'https://api.pokemontcg.io/v2';
const USER_AGENT = 'Mozilla/5.0 (compatible; TCGWatch/1.0; self-hosted price tracker)';

const setSchema = z.object({
  id: z.string(),
  name: z.string(),
  total: z.number().nullish(),
  printedTotal: z.number().nullish(),
});
const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string(),
  images: z.object({ small: z.string().optional(), large: z.string().optional() }).optional(),
});
export type PokemonTcgSet = z.infer<typeof setSchema>;
export type PokemonTcgCard = z.infer<typeof cardSchema>;

export class PokemonTcgClient {
  constructor(
    private readonly baseUrl = POKEMONTCG_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Requête retentée (502/429 fréquents sur cette API gratuite). */
  private async get(path: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return res.json();
      if (attempt >= 3 || ![429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(`pokemontcg.io ${path} : HTTP ${res.status}`);
      }
      await new Promise((r) => setTimeout(r, 2000 * 3 ** attempt));
    }
  }

  private sets?: Promise<PokemonTcgSet[]>;

  /** Toutes les extensions (une seule requête par instance). */
  listSets(): Promise<PokemonTcgSet[]> {
    this.sets ??= this.get('/sets?pageSize=250&select=id,name,total,printedTotal').then(
      (b) => z.object({ data: z.array(setSchema) }).parse(b).data,
    );
    this.sets.catch(() => (this.sets = undefined));
    return this.sets;
  }

  async setCards(setId: string): Promise<PokemonTcgCard[]> {
    const out: PokemonTcgCard[] = [];
    for (let page = 1; page < 20; page++) {
      const q = new URLSearchParams({
        q: `set.id:${setId}`,
        select: 'id,name,number,images',
        pageSize: '250',
        page: String(page),
      });
      const body = z
        .object({ data: z.array(cardSchema), totalCount: z.number().optional() })
        .parse(await this.get(`/cards?${q}`));
      out.push(...body.data);
      if (body.data.length < 250 || out.length >= (body.totalCount ?? 0)) break;
    }
    return out;
  }
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const squash = (s: string) => norm(s).replace(/ /g, '');
const tokens = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const subset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

/**
 * Extension pokemontcg.io correspondant à une extension TCGdex (nom anglais, nombre de
 * cartes) : même nom ; sinon un nom contenu dans l'autre avec le même nombre de cartes ;
 * sinon le même identifiant sans points (« sm7.5 » → « sm75 ») et le même nombre de cartes.
 * Un seul candidat, sinon rien.
 */
export function matchPokemonTcgSet(
  set: { id: string; name: string; total?: number | null },
  sets: PokemonTcgSet[],
): PokemonTcgSet | null {
  const one = (list: PokemonTcgSet[]) => (list.length === 1 ? list[0]! : null);
  const sameCount = (s: PokemonTcgSet) =>
    set.total != null && (s.total === set.total || s.printedTotal === set.total);
  const exact = one(sets.filter((s) => squash(s.name) === squash(set.name)));
  if (exact) return exact;
  const ours = tokens(set.name);
  const contained = one(
    sets.filter((s) => {
      const theirs = tokens(s.name);
      return sameCount(s) && (subset(ours, theirs) || subset(theirs, ours));
    }),
  );
  if (contained) return contained;
  const id = set.id.replace(/\./g, '').toLowerCase();
  return one(sets.filter((s) => s.id.toLowerCase() === id && sameCount(s)));
}

const numberKey = (n: string) => n.replace(/^0+(?=.)/, '').toUpperCase();

/**
 * Image pokemontcg.io de chaque carte TCGdex (numéro et nom anglais) : même numéro et même
 * nom ; sinon le seul homonyme de l'extension (numérotations différentes, ex. collection
 * classique). Renvoie l'URL de la petite image (`/small` ou `.png`).
 */
export function matchPokemonTcgImages(
  cards: { id: string; localId: string; name: string }[],
  theirs: PokemonTcgCard[],
): Map<string, string> {
  const byNumber = new Map(theirs.map((c) => [numberKey(c.number), c]));
  const byName = new Map<string, PokemonTcgCard[]>();
  for (const c of theirs) byName.set(squash(c.name), [...(byName.get(squash(c.name)) ?? []), c]);
  const ourNames = new Map<string, number>();
  for (const c of cards) ourNames.set(squash(c.name), (ourNames.get(squash(c.name)) ?? 0) + 1);

  const out = new Map<string, string>();
  for (const c of cards) {
    const sameNumber = byNumber.get(numberKey(c.localId));
    const named = byName.get(squash(c.name)) ?? [];
    const match =
      sameNumber && squash(sameNumber.name) === squash(c.name)
        ? sameNumber
        : named.length === 1 && ourNames.get(squash(c.name)) === 1
          ? named[0]
          : undefined;
    const image = match?.images?.small;
    if (image) out.set(c.id, image);
  }
  return out;
}

/** Grande image pokemontcg.io à partir de la petite. */
export function pokemonTcgLargeImage(small: string): string {
  return small.replace(/\/small$/, '/large').replace(/(\/[^/]+)\.png$/, '$1_hires.png');
}

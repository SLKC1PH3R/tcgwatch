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
  images: z.object({ logo: z.string().optional(), symbol: z.string().optional() }).optional(),
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
    this.sets ??= this.get('/sets?pageSize=250&select=id,name,total,printedTotal,images').then(
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
 * sinon le même identifiant normalisé (« me06 » = « me6 », « sv08.5 » = « sv8pt5 »).
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
  const id = setIdKey(set.id);
  return one(sets.filter((s) => setIdKey(s.id) === id));
}

/** Identifiant d'extension comparable entre TCGdex et pokemontcg.io. */
export const setIdKey = (id: string) =>
  id
    .toLowerCase()
    .replace(/pt(?=\d)|\./g, '')
    .replace(/\d+/g, (n) => String(Number(n)));

const numberKey = (n: string) => n.replace(/^0+(?=.)/, '').toUpperCase();

/** Nom sans mention de niveau ni de format (« Palkia LV.X » → « palkia »). */
const coreName = (s: string) => squash(s.replace(/\b(?:lv\.?\s*x|legend|l[ée]gende)\b/gi, ''));

/** Numéro comparable : « 99 » < « 100 », lettres après les chiffres. */
const numberOrder = (n: string) => {
  const m = /^(\d+)/.exec(n);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/**
 * Image pokemontcg.io de chaque carte TCGdex (numéro et nom anglais) :
 * 1. même numéro et même nom ;
 * 2. homonymes en nombre égal des deux côtés (les deux moitiés d'une carte LÉGENDE, ou un nom
 *    unique) : appariés dans l'ordre des numéros (numérotations différentes, ex. collection
 *    classique qui reprend les numéros d'origine) ;
 * 3. même nom sans mention de niveau (« Palkia » ↔ « Palkia LV.X »), unique des deux côtés.
 * Renvoie l'URL de la petite image (`/small` ou `.png`).
 */
export function matchPokemonTcgImages(
  cards: { id: string; localId: string; name: string }[],
  theirs: PokemonTcgCard[],
): Map<string, string> {
  const byNumber = new Map(theirs.map((c) => [numberKey(c.number), c]));
  const group = <T>(items: T[], key: (t: T) => string) => {
    const m = new Map<string, T[]>();
    for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it]);
    return m;
  };
  const theirByName = group(theirs, (c) => squash(c.name));
  const ourByName = group(cards, (c) => squash(c.name));
  const theirByCore = group(theirs, (c) => coreName(c.name));
  const ourByCore = group(cards, (c) => coreName(c.name));

  const out = new Map<string, string>();
  const used = new Set<PokemonTcgCard>();
  const take = (c: { id: string }, match: PokemonTcgCard | undefined) => {
    if (!match || used.has(match) || !match.images?.small) return;
    used.add(match);
    out.set(c.id, match.images.small);
  };

  // 1. Même numéro, même nom.
  for (const c of cards) {
    const same = byNumber.get(numberKey(c.localId));
    if (same && squash(same.name) === squash(c.name)) take(c, same);
  }
  // 2 et 3. Homonymes appariés dans l'ordre des numéros.
  const pair = (
    ours: Map<string, typeof cards>,
    their: Map<string, PokemonTcgCard[]>,
    unique: boolean,
  ) => {
    for (const [name, group] of ours) {
      const mine = group.filter((c) => !out.has(c.id));
      const candidates = (their.get(name) ?? []).filter((t) => !used.has(t));
      if (mine.length === 0 || mine.length !== candidates.length) continue;
      if (unique && mine.length !== 1) continue;
      const a = [...mine].sort((x, y) => numberOrder(x.localId) - numberOrder(y.localId));
      const b = [...candidates].sort((x, y) => numberOrder(x.number) - numberOrder(y.number));
      a.forEach((c, i) => take(c, b[i]));
    }
  };
  pair(ourByName, theirByName, false);
  pair(ourByCore, theirByCore, true);
  return out;
}

/** Grande image pokemontcg.io à partir de la petite. */
export function pokemonTcgLargeImage(small: string): string {
  return small.replace(/\/small$/, '/large').replace(/(\/[^/]+)\.png$/, '$1_hires.png');
}

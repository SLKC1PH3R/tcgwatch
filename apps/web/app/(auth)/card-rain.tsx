import Image from 'next/image';
import { connection } from 'next/server';
import { TcgdexClient, tcgdexAsset } from '@tcgwatch/market';

/** Nombre de cartes du fond animé de la page de connexion. */
const CARD_COUNT = 50;
const COLUMNS = 7;
const TTL_MS = 24 * 60 * 60 * 1000;

type RainCard = { id: string; src: string };

/** Mémoire du processus : un seul appel TCGdex par jour, même si la page est très consultée. */
let cache: { at: number; cards: RainCard[] } | undefined;

/** Mélange déterministe (graine = jour) : le même tirage toute la journée. */
function shuffleOfTheDay<T>(items: T[]): T[] {
  let seed = Math.floor(Date.now() / TTL_MS) || 1;
  const rand = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function loadCards(): Promise<RainCard[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cards;
  try {
    const client = new TcgdexClient(undefined, (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
    );
    const found = await client.searchCardsByRarity('Illustration');
    const cards = shuffleOfTheDay(
      found.flatMap((c) => {
        const src = tcgdexAsset(c.image, '/low.webp');
        return src ? [{ id: c.id, src }] : [];
      }),
    ).slice(0, CARD_COUNT);
    cache = { at: Date.now(), cards };
    return cards;
  } catch {
    // TCGdex indisponible : pas de fond animé, la page reste utilisable.
    // On réessaiera dans 10 minutes plutôt qu'à chaque visite.
    cache = { at: Date.now() - TTL_MS + 10 * 60 * 1000, cards: cache?.cards ?? [] };
    return cache.cards;
  }
}

/**
 * Fond décoratif : colonnes de cartes rares « full art » qui défilent en semi-transparence,
 * avec un fondu vers le bas. Animation 100 % CSS, coupée si l'utilisateur réduit les animations.
 */
export async function CardRain() {
  // Rendu à la requête, jamais au build (l'image Docker est construite hors-ligne).
  await connection();
  const cards = await loadCards();
  if (cards.length < COLUMNS) return null;

  const columns = Array.from({ length: COLUMNS }, (_, col) =>
    cards.filter((_, i) => i % COLUMNS === col),
  );

  return (
    <div aria-hidden className="card-rain pointer-events-none absolute inset-0 overflow-hidden">
      <div className="card-rain-grid">
        {columns.map((column, col) => (
          <div
            key={col}
            className="card-rain-column"
            style={
              {
                '--rain-duration': `${70 + ((col * 17) % 40)}s`,
                '--rain-direction': col % 2 === 0 ? 'normal' : 'reverse',
                '--rain-offset': `${-((col * 23) % 60)}s`,
              } as React.CSSProperties
            }
          >
            {/* Liste doublée : la boucle de translateY(-50 %) est sans à-coup. */}
            {[...column, ...column].map((card, i) => (
              <Image
                key={`${card.id}-${i}`}
                src={card.src}
                alt=""
                width={245}
                height={337}
                loading="lazy"
                className="card-rain-card"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

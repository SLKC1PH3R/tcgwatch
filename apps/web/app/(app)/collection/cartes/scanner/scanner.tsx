'use client';

import { Camera, CameraOff, Check, ImageUp, Layers, Minus, Plus, ScanLine, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  cardCrops,
  formatPrice,
  GUIDE_HEIGHT,
  scanSignature,
  type ScanSignature,
} from '@tcgwatch/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addOwnedCardsAction, adjustOwnedCardAction } from '../actions';

interface Match {
  id: string;
  name: string;
  localId: string;
  image: string | null;
  release: string;
  price: number | null;
  owned: number;
  score: number;
  variants: string[];
}

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Holo',
  firstEdition: '1re éd.',
};

/** Image analysée : réduite à 720 px de haut au plus (largement assez pour une empreinte 32 × 32). */
const MAX_SIDE = 720;

/**
 * Empreintes de la carte selon plusieurs cadrages possibles (cadre de visée, variations de taille
 * et de position, image entière si elle est déjà recadrée sur la carte) : le serveur garde le plus
 * proche pour chaque carte connue.
 */
function signatures(source: CanvasImageSource, width: number, height: number): ScanSignature[] {
  const k = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return cardCrops(w, h).map((crop) => scanSignature(data, w, h, crop));
}

/** Carte en attente dans la pile du mode rafale. */
interface PileItem {
  match: Match;
  variant: string;
  quantity: number;
}

const defaultVariant = (m: Match) => (m.variants.includes('normal') ? 'normal' : m.variants[0]!);

/** Libellé de ressemblance d'un résultat. */
function likeness(score: number, sure: boolean) {
  if (sure) return 'Carte reconnue';
  if (score <= 14) return 'Très ressemblante';
  if (score <= 20) return 'Ressemblante';
  return 'Ressemblance faible';
}

export function CardScanner({ releases }: { releases: { code: string; name: string }[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [camera, setCamera] = useState<'off' | 'on' | 'denied'>('off');
  const [auto, setAuto] = useState(true);
  const [release, setRelease] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [confident, setConfident] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Mode rafale : les cartes reconnues avec certitude s'empilent, enregistrées en une fois.
  const [burst, setBurst] = useState(false);
  const [pile, setPile] = useState<PileItem[]>([]);
  // Dernière carte empilée : pas de doublon tant qu'elle reste devant la caméra.
  const last = useRef<{ id: string; gone: boolean } | null>(null);

  const push = useCallback((m: Match, variant = defaultVariant(m)) => {
    setPile((p) => {
      const i = p.findIndex((x) => x.match.id === m.id && x.variant === variant);
      if (i === -1) return [{ match: m, variant, quantity: 1 }, ...p];
      const next = [...p];
      next[i] = { ...next[i]!, quantity: next[i]!.quantity + 1 };
      return next;
    });
    setAdded(`${m.name} ajoutée à la pile`);
  }, []);

  const lookup = useCallback(
    async (candidates: ScanSignature[]) => {
      if (candidates.length === 0 || busy.current) return;
      busy.current = true;
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidates, release: release || undefined }),
        });
        if (!res.ok) return;
        const result = (await res.json()) as { matches: Match[]; confident: boolean };
        setMatches(result.matches);
        setConfident(result.confident);
        const top = result.matches[0];
        if (burst) {
          // Carte retirée ou changée : la suivante pourra être la même (deuxième exemplaire).
          if (last.current && (!result.confident || top?.id !== last.current.id)) {
            last.current.gone = true;
          }
          if (result.confident && top && (last.current?.id !== top.id || last.current.gone)) {
            push(top);
            last.current = { id: top.id, gone: false };
          }
        } else if (result.confident) {
          setAuto(false);
        }
      } finally {
        busy.current = false;
      }
    },
    [release, burst, push],
  );

  const scan = useCallback(() => {
    const v = video.current;
    if (!v || v.readyState < 2) return;
    void lookup(signatures(v, v.videoWidth, v.videoHeight));
  }, [lookup]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setCamera('on');
      setAuto(true);
    } catch {
      setCamera('denied');
    }
  };

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera('off');
  };

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  // Scan automatique : une image toutes les 900 ms tant qu'aucune carte n'est reconnue.
  useEffect(() => {
    if (camera !== 'on' || !auto) return;
    const t = setInterval(scan, 900);
    return () => clearInterval(t);
  }, [camera, auto, scan]);

  const fromFile = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    await lookup(signatures(bitmap, bitmap.width, bitmap.height));
    bitmap.close();
  };

  const fromFiles = async (files: FileList) => {
    for (const f of Array.from(files)) {
      // Chaque photo est une carte distincte, même si c'est la même carte.
      if (last.current) last.current.gone = true;
      await fromFile(f);
    }
  };

  const savePile = () =>
    start(async () => {
      const res = await addOwnedCardsAction(
        pile.map((p) => ({ cardId: p.match.id, variant: p.variant, quantity: p.quantity })),
      );
      if (res.error) {
        setAdded(res.error);
        return;
      }
      setAdded(
        `${res.saved} carte${res.saved > 1 ? 's' : ''} ajoutée${res.saved > 1 ? 's' : ''} à ta collection`,
      );
      setPile([]);
      last.current = null;
    });

  const updatePile = (index: number, patch: Partial<PileItem> | null) =>
    setPile((p) =>
      patch === null
        ? p.filter((_, i) => i !== index)
        : p.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    );

  const add = (m: Match, variant: string) => {
    if (burst) {
      push(m, variant);
      return;
    }
    start(async () => {
      await adjustOwnedCardAction(m.id, 1, variant);
      setAdded(`${m.name} (${VARIANT_LABELS[variant] ?? variant}) ajoutée`);
      setMatches(null);
      setConfident(false);
      setAuto(true);
    });
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-2xl border bg-black">
          <video ref={video} playsInline muted className="size-full object-cover" />
          {camera === 'on' ? (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute top-1/2 left-1/2 aspect-[63/88] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]',
                confident ? 'border-success' : 'border-white/80',
              )}
              style={{ height: `${GUIDE_HEIGHT * 100}%` }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
              {camera === 'denied'
                ? 'Caméra indisponible ou refusée : utilise une photo à la place.'
                : 'Place la carte dans le cadre, bien à plat, sans reflet.'}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {camera === 'on' ? (
            <>
              <Button type="button" onClick={scan} disabled={pending}>
                <ScanLine /> Scanner
              </Button>
              <Button type="button" variant="outline" onClick={() => setAuto((a) => !a)}>
                {auto ? 'Pause du scan auto' : 'Reprendre le scan auto'}
              </Button>
              <Button type="button" variant="ghost" onClick={stopCamera}>
                <CameraOff /> Couper
              </Button>
            </>
          ) : (
            <Button type="button" onClick={startCamera}>
              <Camera /> Ouvrir la caméra
            </Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
            <ImageUp className="size-4" /> {burst ? 'Photos' : 'Photo'}
            <input
              type="file"
              accept="image/*"
              multiple={burst}
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void fromFiles(files);
                e.target.value = '';
              }}
            />
          </label>
          <Button
            type="button"
            variant={burst ? 'default' : 'outline'}
            aria-pressed={burst}
            onClick={() => {
              setBurst((b) => !b);
              setAuto(true);
              last.current = null;
            }}
            title="Les cartes reconnues s'empilent sans validation, enregistrées en une fois"
          >
            <Layers /> Rafale
          </Button>
          <select
            value={release}
            onChange={(e) => setRelease(e.target.value)}
            aria-label="Extension (facultatif)"
            className="h-9 max-w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Toutes les extensions</option>
            {releases.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Astuce : choisir l’extension rend la reconnaissance encore plus sûre. Pour une photo,
          cadre la carte au centre, ou importe une image recadrée sur la carte. En rafale, passe les
          cartes une à une devant la caméra (ou importe plusieurs photos) : chaque carte reconnue
          avec certitude s’empile, vérifie la pile puis enregistre tout.
        </p>
      </div>

      <div className="space-y-3">
        {(burst || pile.length > 0) && (
          <section aria-label="Pile du mode rafale" className="space-y-2 rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">
                Pile{' '}
                <span className="font-sans text-sm text-muted-foreground">
                  · {pile.reduce((n, p) => n + p.quantity, 0)}
                </span>
              </h2>
              <div className="flex gap-1.5">
                {pile.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPile([])}>
                    Vider
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || pile.length === 0}
                  onClick={savePile}
                >
                  <Check /> Tout enregistrer
                </Button>
              </div>
            </div>
            {pile.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Les cartes reconnues avec certitude arrivent ici. Retire la carte du cadre avant de
                passer la suivante ; pour un deuxième exemplaire, retire-la puis remontre-la.
              </p>
            ) : (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {pile.map((p, i) => (
                  <li
                    key={`${p.match.id}:${p.variant}`}
                    className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
                  >
                    {p.match.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.match.image} alt="" className="h-12 w-auto shrink-0 rounded" />
                    ) : (
                      <div className="h-12 w-[2.15rem] shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {p.match.name}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {p.match.localId}
                        </span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.match.variants.map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={p.variant === v}
                            onClick={() => updatePile(i, { variant: v })}
                            className={cn(
                              'rounded-full border px-2 text-[11px]',
                              p.variant === v &&
                                (v === 'reverse'
                                  ? 'border-info bg-info text-black'
                                  : 'border-primary bg-primary text-primary-foreground'),
                            )}
                          >
                            {VARIANT_LABELS[v] ?? v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Un exemplaire de moins : ${p.match.name}`}
                        onClick={() =>
                          updatePile(i, p.quantity > 1 ? { quantity: p.quantity - 1 } : null)
                        }
                        className="grid size-6 place-items-center rounded-md border hover:bg-accent"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">×{p.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Un exemplaire de plus : ${p.match.name}`}
                        onClick={() => updatePile(i, { quantity: p.quantity + 1 })}
                        className="grid size-6 place-items-center rounded-md border hover:bg-accent"
                      >
                        <Plus className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Retirer ${p.match.name} de la pile`}
                        onClick={() => updatePile(i, null)}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {added && (
          <p className="flex items-center gap-2 rounded-xl bg-success/15 px-3 py-2 text-sm text-success">
            <Check className="size-4" /> {added}
          </p>
        )}
        {matches === null ? (
          <p className="text-sm text-muted-foreground">
            Les cartes reconnues s’affichent ici ; touche « Ajouter » pour la mettre dans ta
            collection.
          </p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune carte reconnue. Rapproche la carte, évite les reflets, ou choisis l’extension.
          </p>
        ) : (
          <>
            {!confident && (
              <p className="text-xs text-muted-foreground">
                Pas de certitude : vérifie la carte avant de l’ajouter. Choisir l’extension ou
                recadrer la photo sur la carte aide beaucoup.
              </p>
            )}
            <ul className="space-y-2">
              {matches.map((m, i) => (
                <li
                  key={m.id}
                  className={cn(
                    'flex gap-3 rounded-xl border p-2.5',
                    i === 0 && confident && 'border-success/60 bg-success/5',
                  )}
                >
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="h-24 w-auto shrink-0 rounded-md" />
                  ) : (
                    <div className="h-24 w-[4.3rem] shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold">
                      {m.name}{' '}
                      <span className="font-normal text-muted-foreground">· {m.localId}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.release}
                      {m.price !== null ? ` · cote ${formatPrice(m.price)}` : ''}
                      {m.owned > 0 ? ` · déjà ×${m.owned}` : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {likeness(m.score, i === 0 && confident)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.variants.map((v) => (
                        <Button
                          key={v}
                          type="button"
                          size="sm"
                          variant={i === 0 ? 'default' : 'outline'}
                          className="h-7 rounded-full text-xs"
                          disabled={pending}
                          onClick={() => add(m, v)}
                        >
                          <Plus /> {VARIANT_LABELS[v] ?? v}
                        </Button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

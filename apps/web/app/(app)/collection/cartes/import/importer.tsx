'use client';

import { Check, CircleAlert, CircleHelp, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { ImportPreviewRow } from '@/lib/data/collection-import';
import { cn } from '@/lib/utils';
import { importCardsAction, previewImportAction } from '../actions';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  number: 'Numéro',
  set: 'Extension',
  setCode: 'Sigle',
  quantity: 'Quantité',
  variant: 'Version',
  price: 'Prix d’achat',
  language: 'Langue',
};
const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Holo',
  firstEdition: '1re édition',
};

/** Variante enregistrable pour la carte choisie (holo d'une carte sans « normale »…). */
const variantFor = (wanted: string, variants: string[]) =>
  variants.includes(wanted)
    ? wanted
    : wanted === 'reverse' && variants.includes('reverse')
      ? 'reverse'
      : (variants.find((v) => v !== 'reverse') ?? variants[0] ?? 'normal');

/** Import d'un fichier CSV : analyse, vérification ligne par ligne, puis import. */
export function CollectionImporter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [skip, setSkip] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'ambiguous' | 'missing'>('all');
  const [pending, start] = useTransition();

  const analyse = (text: string) =>
    start(async () => {
      setMessage(null);
      const res = await previewImportAction(text);
      if ('error' in res && res.error) {
        setRows(null);
        setMessage({ ok: false, text: res.error });
        return;
      }
      if (!('rows' in res)) return;
      setRows(res.rows);
      setColumns(Object.keys(res.columns));
      setChoice({});
      setSkip({});
      setFilter(res.rows.some((r) => r.status !== 'ok') ? 'ambiguous' : 'all');
    });

  const counts = useMemo(() => {
    const c = { ok: 0, ambiguous: 0, missing: 0 };
    for (const r of rows ?? []) c[r.status]++;
    return c;
  }, [rows]);

  /** Lignes prêtes : carte trouvée (ou choisie parmi plusieurs) et non écartée. */
  const ready = (rows ?? []).flatMap((r) => {
    if (skip[r.line]) return [];
    const id = r.status === 'ok' ? r.candidates[0]!.id : choice[r.line];
    const card = r.candidates.find((c) => c.id === id);
    if (!card) return [];
    return [
      {
        cardId: card.id,
        variant: variantFor(r.variant, card.variants),
        quantity: r.quantity,
        price: r.price,
      },
    ];
  });
  const copies = ready.reduce((n, r) => n + r.quantity, 0);

  const doImport = () =>
    start(async () => {
      const res = await importCardsAction(ready);
      if (res.error) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({
        ok: true,
        text: `${res.saved} exemplaire${res.saved > 1 ? 's' : ''} ajouté${res.saved > 1 ? 's' : ''} à votre collection.`,
      });
      setRows(null);
      setFileName(null);
    });

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <FileUp className="size-4" /> {fileName ? 'Changer de fichier' : 'Choisir un fichier CSV'}
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setFileName(f.name);
              analyse(await f.text());
            }}
          />
        </label>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        {pending && <span className="text-sm text-muted-foreground">Analyse…</span>}
        <a
          href="/modele-import-cartes.csv"
          download
          className="ml-auto text-sm text-primary hover:underline"
        >
          Télécharger un modèle
        </a>
      </div>

      {message && (
        <p
          className={cn(
            'shrink-0 rounded-xl border px-4 py-2 text-sm',
            message.ok
              ? 'border-success/40 text-success'
              : 'border-destructive/40 text-destructive',
          )}
        >
          {message.text}{' '}
          {message.ok && (
            <Link href="/collection/cartes" className="underline">
              Voir mes cartes
            </Link>
          )}
        </p>
      )}

      {rows && (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Colonnes reconnues : {columns.map((c) => FIELD_LABELS[c] ?? c).join(', ')}
            </span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', `Toutes · ${rows.length}`],
                  ['ok', `Reconnues · ${counts.ok}`],
                  ['ambiguous', `À choisir · ${counts.ambiguous}`],
                  ['missing', `Introuvables · ${counts.missing}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-sm',
                    filter === k && 'border-primary bg-primary/15 text-primary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              className="ml-auto"
              disabled={pending || ready.length === 0}
              onClick={doImport}
            >
              <Check /> Importer {copies} exemplaire{copies > 1 ? 's' : ''}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-card text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-semibold">Ligne</th>
                  <th className="px-3 py-2 text-left font-semibold">Dans le fichier</th>
                  <th className="px-3 py-2 text-left font-semibold">Carte</th>
                  <th className="px-3 py-2 text-right font-semibold">Qté</th>
                  <th className="px-3 py-2 text-left font-semibold">Version</th>
                  <th className="px-3 py-2 text-right font-semibold">Prix</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r) => {
                  const picked =
                    r.status === 'ok'
                      ? r.candidates[0]
                      : r.candidates.find((c) => c.id === choice[r.line]);
                  return (
                    <tr key={r.line} className={cn(skip[r.line] && 'opacity-40')}>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.line}</td>
                      <td className="px-3 py-2">
                        <span className="block max-w-56 truncate">
                          {[r.set ?? r.setCode, r.number && `n° ${r.number}`, r.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'missing' ? (
                          <span className="inline-flex items-center gap-1.5 text-destructive">
                            <CircleAlert className="size-4" /> {r.reason}
                          </span>
                        ) : r.status === 'ambiguous' ? (
                          <span className="flex items-center gap-1.5">
                            <CircleHelp className="size-4 shrink-0 text-warning" />
                            <select
                              value={choice[r.line] ?? ''}
                              onChange={(e) =>
                                setChoice((c) => ({ ...c, [r.line]: e.target.value }))
                              }
                              aria-label={`Carte de la ligne ${r.line}`}
                              className="h-8 max-w-72 rounded-md border bg-transparent px-2 text-sm"
                            >
                              <option value="">Choisir parmi {r.candidates.length}…</option>
                              {r.candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} · {c.localId} · {c.release}
                                </option>
                              ))}
                            </select>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Check className="size-4 shrink-0 text-success" />
                            <span className="truncate">
                              {picked!.name}{' '}
                              <span className="text-muted-foreground">
                                · {picked!.localId} · {picked!.release}
                              </span>
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.quantity}</td>
                      <td className="px-3 py-2">
                        {
                          VARIANT_LABELS[
                            picked ? variantFor(r.variant, picked.variants) : r.variant
                          ]
                        }
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.price !== null ? `${r.price.toFixed(2).replace('.', ',')} €` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.status !== 'missing' && (
                          <button
                            type="button"
                            onClick={() => setSkip((s) => ({ ...s, [r.line]: !s[r.line] }))}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {skip[r.line] ? 'Reprendre' : 'Écarter'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

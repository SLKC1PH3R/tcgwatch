import { Plus, Search } from 'lucide-react';
import { CollectionCardTile } from '@/components/collection-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchCards } from '@/lib/data/card-collection';

/**
 * Recherche de cartes par nom (formulaire GET `?q=`) et bouton « Ajouter » pour chacune.
 * `addAction(cardId)` renvoie l'action serveur à lancer.
 */
export async function CardPicker({
  q,
  mine,
  basePath,
  exclude,
  addAction,
}: {
  q?: string;
  mine: boolean;
  basePath: string;
  exclude: Set<string>;
  addAction: (cardId: string) => () => Promise<void>;
}) {
  const results = q ? await searchCards(q, mine) : [];
  return (
    // Conteneur de référence : la grille suit la largeur disponible (colonne étroite ou page).
    <div className="@container space-y-4">
      <form action={basePath} className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Nom de la carte : Dracaufeu, Évoli…"
            className="pl-9"
            aria-label="Chercher une carte"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-4" />
          Seulement mes cartes
        </label>
        <Button type="submit" variant="secondary">
          Chercher
        </Button>
      </form>
      {q &&
        (results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune carte trouvée pour « {q} ».</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 @lg:grid-cols-4 @3xl:grid-cols-6">
            {results.map((c) => (
              <CollectionCardTile key={c.id} card={c} link={false}>
                {exclude.has(c.id) ? (
                  <p className="text-center text-xs text-muted-foreground">Déjà ajoutée</p>
                ) : (
                  <form action={addAction(c.id)}>
                    <Button type="submit" size="sm" variant="secondary" className="w-full">
                      <Plus /> Ajouter
                    </Button>
                  </form>
                )}
              </CollectionCardTile>
            ))}
          </div>
        ))}
    </div>
  );
}

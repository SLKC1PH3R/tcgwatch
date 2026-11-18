/**
 * Familles de rareté pour filtrer les cartes : TCGdex donne une trentaine de libellés selon les
 * époques (« Holo Rare V », « Rare Holo LV.X », « Illustration spéciale rare »…), regroupés ici
 * comme un collectionneur trie son classeur.
 */
export const RARITY_GROUPS = [
  { key: 'commune', label: 'Communes' },
  { key: 'peu-commune', label: 'Peu communes' },
  { key: 'rare', label: 'Rares' },
  { key: 'holo', label: 'Holo' },
  { key: 'ultra', label: 'Ultra rares · Full Art' },
  { key: 'illustration', label: 'Illustrations' },
  { key: 'secrete', label: 'Secrètes · Gold' },
  { key: 'shiny', label: 'Shiny' },
  { key: 'promo', label: 'Promo' },
  { key: 'autre', label: 'Autres' },
] as const;

export type RarityGroup = (typeof RARITY_GROUPS)[number]['key'];

/** Famille d'un libellé de rareté TCGdex (français ou anglais). */
export function rarityGroup(rarity: string | null | undefined): RarityGroup {
  const r = (rarity ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (!r || r === 'none' || r === 'sans rarete') return 'autre';
  if (r === 'commune' || r === 'common') return 'commune';
  if (r === 'peu commune' || r === 'uncommon') return 'peu-commune';
  if (r === 'rare') return 'rare';
  if (r.includes('promo')) return 'promo';
  if (r.includes('shiny') || r.includes('chromatique')) return 'shiny';
  if (/hyper|secr|gold|mega attack/.test(r)) return 'secrete';
  if (/illustration|magnifique/.test(r)) return 'illustration';
  if (
    /ultra|double|full art|high-tech|rgb|futuristic|collection classique| v(max|star)?$/.test(r)
  ) {
    return 'ultra';
  }
  if (/holo|prime|radieux|legende|noir blanc|pikachu/.test(r)) return 'holo';
  return 'autre';
}

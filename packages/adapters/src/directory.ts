import { getAdapterForUrl } from './registry';

export type RetailerKind = 'SPECIALIST' | 'CULTURE' | 'TOYS' | 'SUPERMARKET' | 'OTHER';
export type RetailerAccess = 'OK' | 'BROWSER' | 'LIMITED' | 'UNTESTED';

/** Fiche d'annuaire d'un site français vendant du Pokémon TCG scellé. */
export interface RetailerInfo {
  slug: string;
  name: string;
  /** Domaine sans « www. ». */
  domain: string;
  kind: RetailerKind;
  /**
   * Relevé automatique, constaté sur le site réel :
   * OK = HTTP simple vérifié sur une vraie fiche ; BROWSER = rendu JavaScript/anti-bot,
   * Chromium nécessaire ; LIMITED = bloqué (403, Cloudflare…) ; UNTESTED = non vérifié.
   */
  access: RetailerAccess;
  websiteUrl: string;
  /** Rayon Pokémon (ou recherche « pokemon ») du site. */
  pokemonUrl: string;
  /** Modèle de recherche : « {q} » est remplacé par les termes encodés. */
  searchUrl?: string;
  minDelayMs: number;
  notes?: string;
  /** Découverte automatique des fiches (pages autorisées par le robots.txt du site). */
  discovery?: RetailerDiscovery;
  /**
   * Port affiché par le site (relevé le 13/11/2026 sur sa page d'accueil) : `cost` = tarif
   * le moins cher annoncé (« dès X € »), `freeFrom` = port offert à partir de ce montant.
   * Absent ou null = inconnu (le prix livré n'est alors pas calculé).
   */
  shipping?: { cost: number | null; freeFrom: number | null };
}

export interface RetailerDiscovery {
  /** URL d'une fiche produit du site (les autres liens sont ignorés). */
  productUrl: RegExp;
  /** Pages de rayon Pokémon ; « {page} » = numéro de page (1, 2, …). */
  pages?: string[];
  /** Nombre maximal de pages parcourues par rayon. */
  maxPages?: number;
  /** Recherche du site, si son robots.txt l'autorise ; « {q} » = termes recherchés. */
  search?: string;
  /** La recherche n'est rendue qu'en JavaScript (Chromium). */
  searchNeedsBrowser?: boolean;
}

/**
 * Annuaire des revendeurs (vérifié le 12/11/2026).
 * Amazon, Fnac et Cdiscount sont volontairement absents (voir BLOCKED_DOMAINS).
 */
export const RETAILER_DIRECTORY: RetailerInfo[] = [
  // ── Boutiques spécialisées ────────────────────────────────
  {
    slug: 'play-in',
    name: 'Play-In',
    domain: 'play-in.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.play-in.com/fr',
    pokemonUrl: 'https://www.play-in.com/fr/gamme/3/pokemon/catalogue',
    searchUrl: 'https://www.play-in.com/fr/recherche?q={q}',
    minDelayMs: 3000,
    shipping: { cost: 1.9, freeFrom: 50 },
    notes:
      'Date « Sortie prévue le » sur la fiche, alerte de retour en stock. A repris Magic Bazar (magicbazar.fr redirige ici).',
    discovery: {
      productUrl: /^https:\/\/www\.play-in\.com\/fr\/produit\/\d+\//,
      // Rayons « français » (8 produits mis en avant chacun) + recherche, autorisée par robots.txt.
      pages: [
        'https://www.play-in.com/fr/categorie/361/booster-pokemon-francais',
        'https://www.play-in.com/fr/categorie/193/display-pokemon-francais',
        'https://www.play-in.com/fr/categorie/194/coffret-pokemon',
        'https://www.play-in.com/fr/categorie/195/deck-pokemon',
        'https://www.play-in.com/fr/categorie/357/pokebox-tin-box',
      ],
      search: 'https://www.play-in.com/fr/recherche?q={q}',
      searchNeedsBrowser: true,
    },
  },
  {
    slug: 'philibert',
    name: 'Philibert',
    domain: 'philibertnet.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.philibertnet.com/fr/',
    pokemonUrl: 'https://www.philibertnet.com/fr/212-pokemon',
    searchUrl: 'https://www.philibertnet.com/fr/recherche?controller=search&search_query={q}',
    minDelayMs: 3000,
    shipping: { cost: 1.95, freeFrom: 60 },
    notes: 'Précommandes ouvertes tôt ; « À venir » sans bouton = pas encore commandable.',
    discovery: {
      productUrl: /^https:\/\/www\.philibertnet\.com\/fr\/[a-z0-9-]+\/\d+-[^/]+\.html$/,
      // Rayon mêlant FR, JP et CN : seuls les produits du catalogue FR sont retenus.
      pages: ['https://www.philibertnet.com/fr/212-pokemon?p={page}'],
      maxPages: 10,
    },
  },
  {
    slug: 'agorajeux',
    name: 'Agorajeux',
    domain: 'agorajeux.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.agorajeux.com/',
    pokemonUrl: 'https://www.agorajeux.com/recherche?controller=search&s=pokemon',
    searchUrl: 'https://www.agorajeux.com/recherche?controller=search&s={q}',
    minDelayMs: 3000,
    notes: 'PrestaShop : disponibilité lue sur le bouton panier de la fiche.',
    discovery: {
      productUrl: /^https:\/\/www\.agorajeux\.com\/\d+-[^/]+\.html$/,
      pages: ['https://www.agorajeux.com/50-pokemon-jcc?page={page}'],
      maxPages: 10,
    },
  },
  {
    slug: 'ludifolie',
    name: 'Ludifolie',
    domain: 'ludifolie.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.ludifolie.com/',
    pokemonUrl: 'https://www.ludifolie.com/recherche?controller=search&s=pokemon',
    searchUrl: 'https://www.ludifolie.com/recherche?controller=search&s={q}',
    minDelayMs: 3000,
    shipping: { cost: null, freeFrom: 60 },
    notes: 'PrestaShop. Rubrique précommandes dédiée.',
    discovery: {
      productUrl: /^https:\/\/www\.ludifolie\.com\/\d+-[^/]+\.html$/,
      pages: ['https://www.ludifolie.com/59-cartes-pokemon?page={page}'],
      maxPages: 8,
    },
  },
  {
    slug: 'bcd-jeux',
    name: 'BCD Jeux',
    domain: 'bcd-jeux.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.bcd-jeux.fr/',
    pokemonUrl: 'https://www.bcd-jeux.fr/recherche?controller=search&s=pokemon',
    searchUrl: 'https://www.bcd-jeux.fr/recherche?controller=search&s={q}',
    minDelayMs: 3000,
    shipping: { cost: null, freeFrom: 49 },
    notes: 'PrestaShop : « En Stock, Expédié sous 24h » affiché sur la fiche.',
    discovery: {
      productUrl: /^https:\/\/www\.bcd-jeux\.fr\/pokemon-tcg\/\d+-[^/]+\.html$/,
      pages: ['https://www.bcd-jeux.fr/511809-pokemon-tcg?page={page}'],
      maxPages: 8,
    },
  },
  {
    slug: 'akilon',
    name: 'Akilon',
    domain: 'akilon.eu',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://akilon.eu/',
    pokemonUrl: 'https://akilon.eu/categorie-produit/cartes-pokemon-tcg-figurines/',
    searchUrl: 'https://akilon.eu/?s={q}&post_type=product',
    minDelayMs: 3000,
    notes:
      'WooCommerce. Rayon mêlant cartes, figurines et accessoires : seuls les produits scellés du catalogue FR sont suivis (protections, Poké Balls, sleeves ignorés).',
    discovery: {
      productUrl: /^https:\/\/akilon\.eu\/produit\/[^/]+\/$/,
      pages: ['https://akilon.eu/categorie-produit/cartes-pokemon-tcg-figurines/page/{page}/'],
      maxPages: 12,
    },
  },
  {
    slug: 'masterset',
    name: 'Masterset',
    domain: 'masterset.store',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://masterset.store/',
    pokemonUrl: 'https://masterset.store/collections/pokemon',
    searchUrl: 'https://masterset.store/search?q={q}&type=product',
    // Shopify répond 429 au-delà de quelques requêtes rapprochées.
    minDelayMs: 8000,
    shipping: { cost: null, freeFrom: 150 },
    notes:
      'Shopify. Rayon mêlant FR, japonais, chinois, coréen, figurines et autres jeux : seuls les produits FR du catalogue sont suivis. Limites d’achat par client fréquentes.',
    discovery: {
      productUrl: /^https:\/\/masterset\.store\/products\/[^/]+$/,
      pages: ['https://masterset.store/collections/pokemon?page={page}'],
      maxPages: 30,
    },
  },
  {
    slug: 'tradingcardsxxx',
    name: 'Trading Cards XXX',
    domain: 'tradingcardsxxx.fr',
    kind: 'SPECIALIST',
    // Shopify répond 429 à toute requête HTTP simple sur les rayons et fiches : Chromium seulement.
    access: 'BROWSER',
    websiteUrl: 'https://tradingcardsxxx.fr/',
    pokemonUrl: 'https://tradingcardsxxx.fr/collections/pokemon',
    searchUrl: 'https://tradingcardsxxx.fr/search?q={q}&type=product',
    minDelayMs: 10000,
    notes:
      'Shopify, relevé via Chromium (les requêtes HTTP simples sont refusées). JSON-LD complet : prix, stock, EAN, date de sortie.',
    discovery: {
      productUrl: /^https:\/\/tradingcardsxxx\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://tradingcardsxxx.fr/collections/pokemon?page={page}'],
      maxPages: 10,
    },
  },
  {
    slug: 'destock-tcg',
    name: 'Destock TCG',
    domain: 'destocktcg.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.destocktcg.fr/',
    pokemonUrl: 'https://www.destocktcg.fr/jeux-de-cartes-a-collectionner/pokemon/',
    // Pas de searchUrl : /search est interdit par le robots.txt.
    minDelayMs: 4000,
    notes:
      'JSON-LD complet (prix, stock, EAN) et alerte de retour en stock sur la fiche. Rayon mêlant FR, imports chinois/japonais et accessoires : seuls les produits FR du catalogue sont suivis.',
    discovery: {
      productUrl: /^https:\/\/www\.destocktcg\.fr\/product\/[a-z0-9-]+$/,
      pages: ['https://www.destocktcg.fr/jeux-de-cartes-a-collectionner/pokemon/?page={page}'],
      maxPages: 12,
    },
  },
  {
    slug: 'esprit-jeu',
    name: 'Esprit Jeu',
    domain: 'espritjeu.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.espritjeu.com/',
    pokemonUrl: 'https://www.espritjeu.com/dhtml/resultat_recherche.php?keywords=pokemon',
    searchUrl: 'https://www.espritjeu.com/dhtml/resultat_recherche.php?keywords={q}',
    minDelayMs: 3000,
    shipping: { cost: 2.9, freeFrom: 49 },
    notes: 'JSON-LD complet (prix, stock, EAN).',
  },
  {
    slug: 'fantasy-sphere',
    name: 'Fantasy Sphere',
    domain: 'fantasysphere.net',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.fantasysphere.net/',
    pokemonUrl: 'https://www.fantasysphere.net/jeux-de-cartes-a-collectionner/pokemon/',
    searchUrl: 'https://www.fantasysphere.net/search?q={q}',
    minDelayMs: 3000,
    shipping: { cost: null, freeFrom: 100 },
    notes: 'Large rayon Pokémon (dont produits japonais).',
  },
  {
    slug: 'le-coin-des-barons',
    name: 'Le Coin des Barons',
    domain: 'lecoindesbarons.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://lecoindesbarons.com/',
    pokemonUrl: 'https://lecoindesbarons.com/',
    minDelayMs: 5000,
    shipping: { cost: null, freeFrom: 70 },
    notes: 'Protégé par Cloudflare : relevés automatiques généralement bloqués.',
  },
  // ── Grandes enseignes culturelles ─────────────────────────
  {
    slug: 'cultura',
    name: 'Cultura',
    domain: 'cultura.com',
    kind: 'CULTURE',
    access: 'BROWSER',
    websiteUrl: 'https://www.cultura.com/',
    pokemonUrl: 'https://www.cultura.com/search/results?search_query=pokemon',
    searchUrl: 'https://www.cultura.com/search/results?search_query={q}',
    minDelayMs: 5000,
    notes: 'Refuse les requêtes simples (403) : relevé via Chromium, sans garantie.',
  },
  {
    slug: 'micromania',
    name: 'Micromania',
    domain: 'micromania.fr',
    kind: 'CULTURE',
    access: 'BROWSER',
    websiteUrl: 'https://www.micromania.fr/',
    pokemonUrl: 'https://www.micromania.fr/search?q=pokemon',
    searchUrl: 'https://www.micromania.fr/search?q={q}',
    minDelayMs: 5000,
    notes: 'Contenu chargé en JavaScript.',
  },
  {
    slug: 'maison-de-la-presse',
    name: 'Maison de la Presse',
    domain: 'maisondelapresse.com',
    kind: 'CULTURE',
    access: 'LIMITED',
    websiteUrl: 'https://www.maisondelapresse.com/',
    pokemonUrl:
      'https://www.maisondelapresse.com/jeux-jouets/cartes-collectionner/cartes-pokemon.html',
    minDelayMs: 5000,
    notes:
      'Protégé par Cloudflare, y compris contre Chromium : à surveiller via le rayon Pokémon (relevés automatiques bloqués).',
  },
  // ── Magasins de jouets ────────────────────────────────────
  {
    slug: 'smyths',
    name: 'Smyths Toys',
    domain: 'smythstoys.com',
    kind: 'TOYS',
    access: 'BROWSER',
    websiteUrl: 'https://www.smythstoys.com/fr/fr-fr',
    pokemonUrl: 'https://www.smythstoys.com/fr/fr-fr/search/?text=pokemon',
    searchUrl: 'https://www.smythstoys.com/fr/fr-fr/search/?text={q}',
    minDelayMs: 5000,
    notes: 'Anti-bot Imperva : relevé via Chromium, sans garantie. Alerte de stock sur la fiche.',
  },
  {
    slug: 'king-jouet',
    name: 'King Jouet',
    domain: 'king-jouet.com',
    kind: 'TOYS',
    access: 'LIMITED',
    websiteUrl: 'https://www.king-jouet.com/',
    pokemonUrl: 'https://www.king-jouet.com/',
    minDelayMs: 5000,
    notes: 'Refuse les requêtes automatisées (403).',
  },
  {
    slug: 'joueclub',
    name: 'JouéClub',
    domain: 'joueclub.fr',
    kind: 'TOYS',
    access: 'UNTESTED',
    websiteUrl: 'https://www.joueclub.fr/',
    pokemonUrl: 'https://www.joueclub.fr/nos-heros/pokemon.html',
    minDelayMs: 5000,
  },
  {
    slug: 'la-grande-recre',
    name: 'La Grande Récré',
    domain: 'lagranderecre.fr',
    kind: 'TOYS',
    access: 'UNTESTED',
    websiteUrl: 'https://www.lagranderecre.fr/',
    pokemonUrl: 'https://www.lagranderecre.fr/jouet-pokemon.html',
    minDelayMs: 5000,
  },
  // ── Grandes surfaces et places de marché ──────────────────
  {
    slug: 'e-leclerc',
    name: 'E.Leclerc',
    domain: 'e.leclerc',
    kind: 'SUPERMARKET',
    access: 'OK',
    websiteUrl: 'https://www.e.leclerc/',
    pokemonUrl: 'https://www.e.leclerc/recherche?q=pokemon',
    searchUrl: 'https://www.e.leclerc/recherche?q={q}',
    minDelayMs: 5000,
    notes:
      'Place de marché : le prix relevé est la meilleure offre, vendeurs tiers compris (souvent au-dessus du prix public).',
  },
  {
    slug: 'auchan',
    name: 'Auchan',
    domain: 'auchan.fr',
    kind: 'SUPERMARKET',
    access: 'BROWSER',
    websiteUrl: 'https://www.auchan.fr/',
    pokemonUrl: 'https://www.auchan.fr/recherche?text=pokemon',
    searchUrl: 'https://www.auchan.fr/recherche?text={q}',
    minDelayMs: 5000,
    notes: 'Fiches rendues en JavaScript ; place de marché avec vendeurs tiers.',
  },
  {
    slug: 'carrefour',
    name: 'Carrefour',
    domain: 'carrefour.fr',
    kind: 'SUPERMARKET',
    access: 'LIMITED',
    websiteUrl: 'https://www.carrefour.fr/',
    pokemonUrl: 'https://www.carrefour.fr/s?q=pokemon',
    searchUrl: 'https://www.carrefour.fr/s?q={q}',
    minDelayMs: 5000,
    notes: 'Refuse les requêtes automatisées (403).',
  },
];

/** Clé d'adaptateur à enregistrer pour un revendeur de l'annuaire. */
export function adapterKeyFor(info: RetailerInfo): string {
  return getAdapterForUrl(info.websiteUrl).key;
}

/** URL de recherche d'un produit sur un site ; undefined si le site n'a pas de modèle connu. */
/**
 * Grandes enseignes jamais relevées (CGU et anti-bot, voir BLOCKED_DOMAINS) : un simple lien
 * vers leur recherche, ouvert par l'utilisateur. Aucune page n'est lue par TCGWatch.
 */
export const LINK_ONLY_SEARCHES = [
  { name: 'Amazon', searchUrl: 'https://www.amazon.fr/s?k={q}' },
  { name: 'Fnac', searchUrl: 'https://www.fnac.com/SearchResult/ResultList.aspx?Search={q}' },
  { name: 'Cdiscount', searchUrl: 'https://www.cdiscount.com/search/10/{q}.html' },
] as const;

export function buildSearchUrl(
  template: string | null | undefined,
  query: string,
): string | undefined {
  if (!template?.includes('{q}')) return undefined;
  const q = encodeURIComponent(query.trim().replace(/\s+/g, ' ')).replace(/%20/g, '+');
  return template.replace('{q}', q);
}

/**
 * Termes de recherche d'un produit : le nom sans le bruit des intitulés revendeurs
 * (crochets, « - FR », ponctuation), pour maximiser les résultats sur les moteurs des sites.
 */
export function searchTermsFor(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(?:fr|vf|version fran[çc]aise)\b/gi, ' ')
    .replace(/[–—:|()]/g, ' ')
    .replace(/\s-\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const RETAILER_KIND_LABELS: Record<RetailerKind, string> = {
  SPECIALIST: 'Boutique spécialisée',
  CULTURE: 'Enseigne culturelle',
  TOYS: 'Jouets',
  SUPERMARKET: 'Grande surface',
  OTHER: 'Autre',
};

export const RETAILER_ACCESS_LABELS: Record<RetailerAccess, string> = {
  OK: 'Relevé fiable',
  BROWSER: 'Via Chromium',
  LIMITED: 'Bloqué',
  UNTESTED: 'Non testé',
};

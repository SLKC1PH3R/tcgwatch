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
  /**
   * Boutique vérifiée par PokéScam (pokescam.com/sites-fiables, relevé le 15/11/2026) :
   * leur présentation de la boutique. Absent = pas dans leur liste.
   */
  pokescam?: string;
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
    pokescam: 'Jeux de société et cartes à collectionner (Magic, Pokémon, Yu-Gi-Oh!, Lorcana).',
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
    pokescam: 'Jeux de société, plus de 40 000 références.',
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
    pokescam: 'Jeux, jouets, décoration et loisirs créatifs pour tous les âges.',
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
    pokescam: 'Boutique de cartes à collectionner en ligne, magasin à Strasbourg.',
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
    pokescam: 'Cartes Dragon Ball, Yu-Gi-Oh!, Magic, Lorcana et autres.',
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
    access: 'OK',
    websiteUrl: 'https://www.fantasysphere.net/',
    pokemonUrl: 'https://www.fantasysphere.net/jeux-de-cartes-a-collectionner/pokemon/',
    // Pas de searchUrl : /search est interdit par le robots.txt.
    pokescam: 'Boutique en ligne, nombreux produits Pokémon.',
    minDelayMs: 4000,
    shipping: { cost: null, freeFrom: 100 },
    notes:
      'Boutique de Toulouse. Pas de JSON-LD produit : prix (balise product:price) et stock (bloc « Livraison à domicile ») lus par un adaptateur dédié. Rayon mêlant FR, japonais et accessoires : seuls les produits FR du catalogue sont suivis.',
    discovery: {
      productUrl: /^https:\/\/www\.fantasysphere\.net\/product\/[a-z0-9-]+$/,
      pages: ['https://www.fantasysphere.net/jeux-de-cartes-a-collectionner/pokemon/?page={page}'],
      maxPages: 8,
    },
  },
  {
    slug: 'pikastore',
    name: 'Pikastore',
    domain: 'pikastore.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.pikastore.fr/',
    pokemonUrl: 'https://www.pikastore.fr/1422-pokemon',
    pokescam: 'Boutique de cartes Pokémon en ligne et physique.',
    minDelayMs: 4000,
    notes:
      'PrestaShop, JSON-LD complet (prix, stock, EAN). Rayon scellé « 1422-pokemon » (la catégorie 1442 ne contient que des cartes à l’unité).',
    discovery: {
      productUrl: /^https:\/\/www\.pikastore\.fr\/pokemon\/\d+-[a-z0-9-]+\.html$/,
      pages: ['https://www.pikastore.fr/1422-pokemon?page={page}'],
      maxPages: 8,
    },
  },
  {
    slug: 'tales-of-games',
    name: 'Tales of Games',
    domain: 'tales-of-games.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.tales-of-games.fr/',
    pokemonUrl: 'https://www.tales-of-games.fr/41-jcc-pokemon',
    minDelayMs: 4000,
    notes:
      'PrestaShop, JSON-LD complet. Rayon mêlant scellé et accessoires : seules les fiches « jcc-pokemon » sont lues.',
    discovery: {
      productUrl: /^https:\/\/www\.tales-of-games\.fr\/jcc-pokemon\/\d+-[a-z0-9-]+\.html$/,
      pages: ['https://www.tales-of-games.fr/41-jcc-pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'plaza-tcg',
    name: 'Plaza TCG',
    domain: 'plazatcg.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://plazatcg.com/',
    pokemonUrl: 'https://plazatcg.com/3-pokemon',
    pokescam: 'Cartes gradées et pré-gradées, nouveautés chaque semaine.',
    minDelayMs: 4000,
    notes: 'PrestaShop, JSON-LD complet (prix, stock, EAN, galerie).',
    discovery: {
      productUrl: /^https:\/\/plazatcg\.com\/[a-z0-9-]+\/\d+-pokemon-[a-z0-9-]+\.html$/,
      pages: ['https://plazatcg.com/3-pokemon?page={page}'],
      maxPages: 8,
    },
  },
  {
    slug: 'mondes-fantastiques',
    name: 'Mondes Fantastiques',
    domain: 'mondes-fantastiques.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.mondes-fantastiques.com/',
    pokemonUrl: 'https://www.mondes-fantastiques.com/5102278-cartes-pokemon',
    minDelayMs: 4000,
    notes: 'PrestaShop, JSON-LD complet. Petit rayon Pokémon (une dizaine de produits).',
    discovery: {
      productUrl: /^https:\/\/www\.mondes-fantastiques\.com\/cartes-pokemon\/\d+-[a-z0-9-]+\.html$/,
      pages: ['https://www.mondes-fantastiques.com/5102278-cartes-pokemon?page={page}'],
      maxPages: 2,
    },
  },
  {
    slug: 'eldar-tcg',
    name: 'Eldar TCG',
    domain: 'eldartcg.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://eldartcg.com/',
    pokemonUrl: 'https://eldartcg.com/collections/produits-scellees-pokemon',
    minDelayMs: 6000,
    notes:
      'Shopify : répond « 429 » aux requêtes automatisées (vérifié le 15/11/2026). Lien vers le rayon seulement, aucun relevé.',
  },
  {
    slug: 'manamecha',
    name: 'Manamecha',
    domain: 'manamecha.fr',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://manamecha.fr/',
    pokemonUrl: 'https://manamecha.fr/collections/pokemon-tcg',
    minDelayMs: 6000,
    notes:
      'Shopify : répond « 429 » aux requêtes automatisées (vérifié le 15/11/2026). Lien vers le rayon seulement, aucun relevé.',
  },
  // ── Ajouts du 15/11/2026 (liste PokéScam des sites fiables + boutiques signalées) ──
  {
    slug: '1001hobbies',
    name: '1001hobbies',
    domain: '1001hobbies.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.1001hobbies.fr/',
    pokemonUrl: 'https://www.1001hobbies.fr/56137-pokemon',
    pokescam: 'Culture pop et cartes Pokémon en ligne.',
    minDelayMs: 4000,
    notes: 'Rayon Pokémon mêlant scellé et produits dérivés.',
    discovery: {
      productUrl: /^https:\/\/www\.1001hobbies\.fr\/(?:[^/]+\/)?\d+(?:-\d+)?-[^/]+\.html$/,
      pages: ['https://www.1001hobbies.fr/56137-pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'blazing-tail',
    name: 'Blazing Tail',
    domain: 'blazingtail.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.blazingtail.fr/',
    pokemonUrl: 'https://www.blazingtail.fr/1321-display-pokemon',
    pokescam: 'Achat et vente de cartes TCG.',
    minDelayMs: 4000,
    notes: 'Displays, ETB et coffrets FR, JP et CN ; rachat de collections.',
    discovery: {
      productUrl: /^https:\/\/www\.blazingtail\.fr\/(?:[^/]+\/)?\d+(?:-\d+)?-[^/]+\.html$/,
      pages: [
        'https://www.blazingtail.fr/1321-display-pokemon?page={page}',
        'https://www.blazingtail.fr/1319-etb-pokemon?page={page}',
        'https://www.blazingtail.fr/1324-coffret-pokemon?page={page}',
        'https://www.blazingtail.fr/1320-tripack-pokemon?page={page}',
        'https://www.blazingtail.fr/1318-booster-pokemon?page={page}',
        'https://www.blazingtail.fr/3233-blisters-pokemon?page={page}',
        'https://www.blazingtail.fr/1323-upc-pokemon?page={page}',
      ],
      maxPages: 6,
    },
  },
  {
    slug: 'boostrclub',
    name: 'Boostrclub',
    domain: 'boostrclub.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://boostrclub.com/',
    pokemonUrl: 'https://boostrclub.com/collections/pokemon',
    minDelayMs: 4000,
    notes: 'Displays scellés des extensions récentes.',
    discovery: {
      productUrl: /^https:\/\/boostrclub\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://boostrclub.com/collections/pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'cards-game-collect',
    name: 'Cards Game Collect',
    domain: 'cardsgamecollect.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://cardsgamecollect.fr/',
    pokemonUrl: 'https://cardsgamecollect.fr/collections/pokemon',
    pokescam: 'Boutique de cartes en ligne, magasin à Toul.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/cardsgamecollect\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://cardsgamecollect.fr/collections/pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'cardshunter',
    name: 'Cards Hunter',
    domain: 'cardshunter.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.cardshunter.fr/',
    pokemonUrl: 'https://www.cardshunter.fr/categorie-produit/produits-scelles/',
    pokescam: 'Contenus YouTube hebdomadaires sur Pokémon, Lorcana, One Piece.',
    minDelayMs: 4000,
    notes: 'Displays, ETB et cases ; beaucoup de produits japonais et chinois (écartés).',
    discovery: {
      productUrl: /^https:\/\/www\.cardshunter\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: ['https://www.cardshunter.fr/categorie-produit/produits-scelles/page/{page}/'],
      maxPages: 6,
    },
  },
  {
    slug: 'dracaugames',
    name: 'DracauGames',
    domain: 'dracaugames.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.dracaugames.com/',
    pokemonUrl:
      'https://www.dracaugames.com/collections/jeux-de-carte-pokemon-displays-boites-de-boosters',
    pokescam: 'En ligne : Pokémon, Magic, Yu-Gi-Oh!, Dragon Ball, Final Fantasy, Vanguard.',
    minDelayMs: 4000,
    notes: 'Displays, demi-displays et lots FR et JP.',
    discovery: {
      productUrl: /^https:\/\/www\.dracaugames\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: [
        'https://www.dracaugames.com/collections/jeux-de-carte-pokemon-displays-boites-de-boosters?page={page}',
        'https://www.dracaugames.com/collections/jeux-de-carte-pokemon-boosters?page={page}',
        'https://www.dracaugames.com/collections/coffrets-pokemon?page={page}',
        'https://www.dracaugames.com/collections/jeux-de-carte-pokemon-decks?page={page}',
        'https://www.dracaugames.com/collections/jeux-de-carte-pokemon-pokebox?page={page}',
      ],
      maxPages: 6,
    },
  },
  {
    slug: 'fuji-store',
    name: 'Fuji Store',
    domain: 'fuji-store.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://fuji-store.fr/',
    pokemonUrl:
      'https://fuji-store.fr/nos-produits/franchise-pokemon/articles-scelles-pokemon-francais/',
    pokescam: 'Cartes Pokémon FR et JP et autres TCG ; paiements sécurisés.',
    minDelayMs: 4000,
    notes: 'Très vaste catalogue scellé, séries récentes et anciennes.',
    discovery: {
      productUrl: /^https:\/\/fuji-store\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: [
        'https://fuji-store.fr/nos-produits/franchise-pokemon/articles-scelles-pokemon-francais/page/{page}/',
      ],
      maxPages: 6,
    },
  },
  {
    slug: 'hikaru-distribution',
    name: 'Hikaru Distribution',
    domain: 'hikarudistribution.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://hikarudistribution.com/',
    pokemonUrl: 'https://hikarudistribution.com/collections/pokemon-francais',
    pokescam:
      'Grand catalogue de displays, cartes à l’unité et gradées ; expédition en 24 h annoncée.',
    minDelayMs: 4000,
    notes: 'Displays 36 boosters, ETB et coffrets FR.',
    discovery: {
      productUrl: /^https:\/\/hikarudistribution\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://hikarudistribution.com/collections/pokemon-francais?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'hitndrop',
    name: "Hit'N Drop",
    domain: 'hitndrop.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://hitndrop.com/',
    pokemonUrl: 'https://hitndrop.com/collections/tcg-pokemon-tous-les-produits',
    pokescam: 'Spécialiste TCG (Pokémon, One Piece, Riftbound, Lorcana) et accessoires.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/hitndrop\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://hitndrop.com/collections/tcg-pokemon-tous-les-produits?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'kingdultes',
    name: 'Kingdultes',
    domain: 'kingdultes.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.kingdultes.com/',
    pokemonUrl: 'https://www.kingdultes.com/collections/tcg-pokemon',
    pokescam: 'Culture pop et cartes Pokémon ; groupe King Jouet.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/www\.kingdultes\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://www.kingdultes.com/collections/tcg-pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'la-carte-rare',
    name: 'La Carte Rare',
    domain: 'lacarterare.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://lacarterare.com/',
    pokemonUrl: 'https://lacarterare.com/collections/pokemon-francais',
    pokescam: 'Boutique TCG en ligne et physique.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/lacarterare\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://lacarterare.com/collections/pokemon-francais?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'le-bordel-magique',
    name: 'Le Bordel Magique',
    domain: 'lebordelmagique.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://lebordelmagique.com/',
    pokemonUrl: 'https://lebordelmagique.com/collections/pokemon-fr',
    pokescam: 'Boutique TCG, magasin à Chambly (60).',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/lebordelmagique\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://lebordelmagique.com/collections/pokemon-fr?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'le-repaire-du-collectionneur',
    name: 'Le Repaire du Collectionneur',
    domain: 'lerepaireducollectionneur.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.lerepaireducollectionneur.fr/',
    pokemonUrl: 'https://www.lerepaireducollectionneur.fr/collections/pokemon-francais',
    pokescam: 'Boutique de cartes Pokémon en ligne et physique.',
    minDelayMs: 4000,
    discovery: {
      productUrl:
        /^https:\/\/www\.lerepaireducollectionneur\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://www.lerepaireducollectionneur.fr/collections/pokemon-francais?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'les-gentlemen-du-jeu',
    name: 'Les Gentlemen du Jeu',
    domain: 'lesgentlemendujeu.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://lesgentlemendujeu.com/',
    pokemonUrl: 'https://lesgentlemendujeu.com/31-pokemon',
    pokescam: 'Boutique de jeux à Pigalle et Gambetta (Paris).',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/lesgentlemendujeu\.com\/(?:[^/]+\/)?\d+(?:-\d+)?-[^/]+\.html$/,
      pages: ['https://lesgentlemendujeu.com/31-pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'ludotrotter',
    name: 'Ludotrotter',
    domain: 'ludotrotter.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://ludotrotter.fr/',
    pokemonUrl: 'https://ludotrotter.fr/categorie-produit/magasin/cartes/pokemon/',
    pokescam: 'Jeux de cartes en ligne ; 11 magasins en France et en Belgique.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/ludotrotter\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: ['https://ludotrotter.fr/categorie-produit/magasin/cartes/pokemon/page/{page}/'],
      maxPages: 6,
    },
  },
  {
    slug: 'monpokestore',
    name: 'Monpokestore',
    domain: 'monpokestore.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.monpokestore.fr/',
    pokemonUrl: 'https://www.monpokestore.fr/collections/pokemon',
    minDelayMs: 4000,
    notes: 'Scellé FR (displays, ETB, coffrets spéciaux) et protections acryliques.',
    discovery: {
      productUrl: /^https:\/\/www\.monpokestore\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://www.monpokestore.fr/collections/pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'pikatchuss',
    name: 'Pikatchuss',
    domain: 'pikatchuss.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://pikatchuss.fr/',
    pokemonUrl: 'https://pikatchuss.fr/collections/pokemon-francais',
    pokescam: 'Boutique en ligne de cartes Pokémon.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/pikatchuss\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://pikatchuss.fr/collections/pokemon-francais?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'poke-geek',
    name: 'Poké-Geek',
    domain: 'poke-geek.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.poke-geek.fr/',
    pokemonUrl: 'https://www.poke-geek.fr/collections/coffrets-pokemon',
    pokescam: 'Pokémon, Yu-Gi-Oh!, Lorcana, Magic, One Piece et figurines.',
    minDelayMs: 4000,
    notes: 'Displays, ETB, coffrets, précommandes ; retrait en Île-de-France.',
    discovery: {
      productUrl: /^https:\/\/www\.poke-geek\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: [
        'https://www.poke-geek.fr/collections/coffrets-pokemon?page={page}',
        'https://www.poke-geek.fr/collections/pokemon-jcc-30e-anniversaire-2026-produits-disponibilites?page={page}',
      ],
      maxPages: 6,
    },
  },
  {
    slug: 'pokedream',
    name: 'Pokédream',
    domain: 'pokedream.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://pokedream.fr/',
    pokemonUrl: 'https://pokedream.fr/collections/pokemon-france',
    pokescam: 'Boutique en ligne de cartes Pokémon.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/pokedream\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://pokedream.fr/collections/pokemon-france?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'pokelite',
    name: 'Pokelite',
    domain: 'pokelite.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.pokelite.fr/',
    pokemonUrl: 'https://www.pokelite.fr/product-category/produits-pokemon/',
    pokescam: 'Boutique en ligne de cartes à collectionner.',
    minDelayMs: 4000,
    notes: 'Pokémon, Lorcana et One Piece ; prix parfois absent de la fiche lue.',
    discovery: {
      productUrl: /^https:\/\/www\.pokelite\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: ['https://www.pokelite.fr/product-category/produits-pokemon/page/{page}/'],
      maxPages: 6,
    },
  },
  {
    slug: 'pokemoms',
    name: 'Pokémoms',
    domain: 'pokemoms.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://pokemoms.fr/',
    pokemonUrl: 'https://pokemoms.fr/categorie-produit/pokemon/coffrets-boosters/',
    pokescam: 'Pokémon, Lorcana, One Piece et autres produits sous licence.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/pokemoms\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: ['https://pokemoms.fr/categorie-produit/pokemon/coffrets-boosters/page/{page}/'],
      maxPages: 6,
    },
  },
  {
    slug: 'pokesumo',
    name: 'PokeSumo',
    domain: 'pokesumo.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://pokesumo.com/',
    pokemonUrl: 'https://pokesumo.com/19-pokemon-jcc',
    pokescam: 'Cartes, boosters et displays Pokémon, Yu-Gi-Oh! et One Piece.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/pokesumo\.com\/(?:[^/]+\/)?\d+(?:-\d+)?-[^/]+\.html$/,
      pages: ['https://pokesumo.com/19-pokemon-jcc?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'pokezenith',
    name: 'Pokézénith',
    domain: 'pokezenith.com',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://www.pokezenith.com/',
    pokemonUrl: 'https://www.pokezenith.com/9-cartes-pokemon',
    pokescam: 'Boutique en ligne de cartes à collectionner.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/www\.pokezenith\.com\/(?:[^/]+\/)?\d+(?:-\d+)?-[^/]+\.html$/,
      pages: ['https://www.pokezenith.com/9-cartes-pokemon?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'relic-tcg',
    name: 'Relic TCG',
    domain: 'relictcg.com',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.relictcg.com/',
    pokemonUrl: 'https://www.relictcg.com/collections/pokemon-display-boosters',
    pokescam: 'Jeux de société et cartes à collectionner, plus de 1 000 références.',
    minDelayMs: 4000,
    notes:
      'Magasin à Toulouse ; displays, UPC et précommandes. Liste des produits rendue en JavaScript : peu de fiches trouvées.',
    discovery: {
      productUrl: /^https:\/\/www\.relictcg\.com\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: [
        'https://www.relictcg.com/collections/pokemon-display-boosters?page={page}',
        'https://www.relictcg.com/collections/pokemon-coffrets?page={page}',
      ],
      maxPages: 6,
    },
  },
  {
    slug: 'upc-tcg',
    name: 'UPC TCG',
    domain: 'upc-tcg.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://upc-tcg.fr/',
    pokemonUrl: 'https://upc-tcg.fr/categorie-produit/pokemon/',
    minDelayMs: 4000,
    notes: 'Précommandes, displays et coffrets Ultra Premium FR.',
    discovery: {
      productUrl: /^https:\/\/upc-tcg\.fr\/(?:produit|boutique|product)\/[^/?#]+\/?$/,
      pages: ['https://upc-tcg.fr/categorie-produit/pokemon/page/{page}/'],
      maxPages: 6,
    },
  },
  {
    slug: 'vcollect',
    name: 'VCollect',
    domain: 'vcollect.fr',
    kind: 'SPECIALIST',
    access: 'OK',
    websiteUrl: 'https://vcollect.fr/',
    pokemonUrl: 'https://vcollect.fr/collections/pokemon-francais',
    pokescam: 'Boosters, displays, produits japonais et chinois.',
    minDelayMs: 4000,
    discovery: {
      productUrl: /^https:\/\/vcollect\.fr\/(?:collections\/[^/]+\/)?products\/[^/?#]+$/,
      pages: ['https://vcollect.fr/collections/pokemon-francais?page={page}'],
      maxPages: 6,
    },
  },
  {
    slug: 'aux-trois-koalas',
    name: 'Aux Trois Koalas',
    domain: 'auxtroiskoalas.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.auxtroiskoalas.fr/',
    pokemonUrl: 'https://www.auxtroiskoalas.fr/shop/category/pokemon-312',
    pokescam: 'En ligne : coffrets, ETB, displays et cartes Pokémon.',
    minDelayMs: 6000,
    notes: 'Boutique Odoo : rayon non lu automatiquement.',
  },
  {
    slug: 'big-hit',
    name: 'Big Hit',
    domain: 'bighit.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://bighit.fr/',
    pokemonUrl: 'https://bighit.fr/cat%C3%A9gorie/pokemon-fr',
    pokescam: 'En ligne : articles Pokémon japonais et français.',
    minDelayMs: 6000,
    notes: 'Liste des produits rendue en JavaScript : lien seulement.',
  },
  {
    slug: 'tcg-legendes',
    name: 'TCG Légendes',
    domain: 'tcglegendes.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://tcglegendes.fr/',
    pokemonUrl: 'https://tcglegendes.fr/collections/produits-scelles-pokemon',
    pokescam: 'Cartes et accessoires Pokémon en ligne.',
    minDelayMs: 6000,
    notes: 'Liste des produits rendue en JavaScript : lien seulement.',
  },
  {
    slug: 'pokestation',
    name: 'PokeStation',
    domain: 'pokestation.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://pokestation.fr/',
    pokemonUrl: 'https://pokestation.fr/collections/all',
    minDelayMs: 6000,
    notes: 'Surtout cartes gradées et accessoires : lien seulement.',
  },
  {
    slug: 'kairyu',
    name: 'Kairyu',
    domain: 'kairyu.fr',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://kairyu.fr/',
    pokemonUrl: 'https://kairyu.fr/',
    pokescam: 'Spécialiste du JCC Pokémon.',
    minDelayMs: 6000,
    notes: 'Rayon Pokémon non trouvé automatiquement : lien seulement.',
  },
  {
    slug: 'ultrajeux',
    name: 'Ultrajeux',
    domain: 'ultrajeux.com',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.ultrajeux.com/',
    pokemonUrl: 'https://www.ultrajeux.com/',
    pokescam:
      'Jeux de société et cartes à collectionner (Pokémon, Yu-Gi-Oh!, Altered, Lorcana, One Piece).',
    minDelayMs: 6000,
    notes: 'Rayon Pokémon non trouvé automatiquement : lien seulement.',
  },
  {
    slug: 'variantes',
    name: 'Variantes',
    domain: 'variantes.com',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.variantes.com/',
    pokemonUrl: 'https://www.variantes.com/',
    pokescam: 'Boutique de jeux et cartes à collectionner en ligne et physique.',
    minDelayMs: 6000,
    notes: 'Rayon Pokémon non trouvé automatiquement : lien seulement.',
  },
  {
    slug: 'parkage',
    name: 'Parkage',
    domain: 'parkage.com',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://www.parkage.com/',
    pokemonUrl: 'https://www.parkage.com/',
    pokescam: 'Jeux de société et cartes ; magasins à Paris, Vitrolles et Pertuis.',
    minDelayMs: 6000,
    notes: 'Rayon Pokémon non trouvé automatiquement : lien seulement.',
  },
  {
    slug: 'pokegourou',
    name: 'Pokégourou',
    domain: 'pokegourou.com',
    kind: 'SPECIALIST',
    access: 'UNTESTED',
    websiteUrl: 'https://pokegourou.com/',
    pokemonUrl: 'https://pokegourou.com/display-pokemon/',
    pokescam: 'Displays, boosters et cartes gradées.',
    minDelayMs: 6000,
    notes: 'Surtout lots de cartes et codes JCC Online : lien seulement.',
  },
  {
    slug: 'hama-cards',
    name: 'Hama Cards',
    domain: 'hamacards.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://hamacards.com/',
    pokemonUrl: 'https://hamacards.com/',
    pokescam: 'Pokémon et multi-TCG, des cartes anciennes aux récentes.',
    minDelayMs: 6000,
    notes: 'Refuse les requêtes automatisées (403, vérifié le 15/11/2026).',
  },
  {
    slug: 'investcollect',
    name: 'InvestCollect',
    domain: 'investcollect.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://investcollect.com/',
    pokemonUrl: 'https://investcollect.com/',
    pokescam: 'En ligne ; deux magasins au Vigen et à Limoges.',
    minDelayMs: 6000,
    notes: 'Refuse les requêtes automatisées (403, vérifié le 15/11/2026).',
  },
  {
    slug: 'les-7-royaumes',
    name: 'Les 7 Royaumes',
    domain: 'les7royaumes.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://les7royaumes.com/',
    pokemonUrl: 'https://les7royaumes.com/',
    pokescam: 'Jeux de société et cartes à collectionner.',
    minDelayMs: 6000,
    notes: 'Refuse les requêtes automatisées (403, vérifié le 15/11/2026).',
  },
  {
    slug: 'guizette-family',
    name: 'Guizette Family',
    domain: 'guizettefamily.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://guizettefamily.com/',
    pokemonUrl: 'https://guizettefamily.com/categorie/pokemon/items-produits/display-pokemon/',
    pokescam: 'Pokémon, One Piece, Lorcana et accessoires de protection.',
    minDelayMs: 6000,
    notes: 'Rayon refusé aux requêtes automatisées (403, vérifié le 15/11/2026).',
  },
  {
    slug: 'le-coin-des-barons',
    name: 'Le Coin des Barons',
    domain: 'lecoindesbarons.com',
    kind: 'SPECIALIST',
    access: 'LIMITED',
    websiteUrl: 'https://lecoindesbarons.com/',
    pokemonUrl: 'https://lecoindesbarons.com/',
    pokescam: 'Yu-Gi-Oh!, Pokémon, Digimon, DBZ ; achat et revente.',
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
    pokescam: 'Livres, loisirs créatifs, jeux, papeterie, musique, DVD.',
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
    pokescam: 'Jeux vidéo, cartes à jouer et produits dérivés ; magasins et en ligne.',
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
    pokescam: 'Livres, jeux, jouets, papeterie, presse.',
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
    pokescam: 'Enseigne de jouets irlandaise multinationale.',
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
    pokescam: 'Jeux et jouets, plus de 20 000 références.',
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
    pokescam: 'Jouets de 0 à 12 ans, magasins physiques.',
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
    pokescam: 'Jeux et jouets, plus de 10 000 références dont LEGO.',
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
    pokescam: 'Produits culturels en ligne, livraison à domicile ou retrait gratuit en magasin.',
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

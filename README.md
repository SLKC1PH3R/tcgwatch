# TCGWatch

Dashboard **self-hosted** pour suivre les produits **scellés Pokémon TCG en français** (ETB, displays,
tripacks, coffrets, UPC) : calendrier des sorties, stock et prix chez les revendeurs, alertes,
prix du marché secondaire et valorisation de sa collection.

> Outil personnel et mono-utilisateur. Il **n'achète jamais rien automatiquement** : il relève les
> fiches produits à un rythme raisonnable et propose des liens « Acheter » vers les sites.

![Tableau de bord](docs/screenshots/dashboard.png)

| Produits suivis                                   | Fiche produit                                  |
| ------------------------------------------------- | ---------------------------------------------- |
| ![Produits suivis](docs/screenshots/produits.png) | ![Fiche produit](docs/screenshots/produit.png) |
| **Calendrier**                                    | **Collection**                                 |
| ![Calendrier](docs/screenshots/calendrier.png)    | ![Collection](docs/screenshots/collection.png) |

## Fonctionnalités

- **Calendrier des sorties** : import quotidien des extensions FR depuis l'API [TCGdex](https://tcgdex.dev)
  (gratuite, sans clé) et des **produits scellés FR** (displays, ETB, tripacks, coffrets, UPC…, avec
  image et prix conseillé) depuis le [calendrier Pokécardex](https://www.pokecardex.com/calendrier),
  enrichi par les dates « Sortie prévue le … » détectées sur les fiches revendeurs.
  Vue mensuelle filtrable par type, détail d'un jour, liste « à venir » avec compte à rebours,
  édition et validation manuelles (statuts `auto` / `validé` : une sortie validée n'est plus modifiée
  par les imports).
- **Catalogue 100 % automatique et 100 % français** : chaque sortie FR du calendrier Pokécardex
  devient un produit suivi (nom, type, image, date, prix conseillé). Chaque jour, le worker parcourt
  les rayons Pokémon des boutiques (Play-In, Philibert, Agorajeux, Ludifolie, BCD Jeux — uniquement
  les pages autorisées par leur `robots.txt`) et la recherche Play-In, puis rattache les fiches
  trouvées aux produits du catalogue : même type et mêmes mots distinctifs, versions EN/JP/KO et
  accessoires écartés, aucun rattachement en cas de doute. Aucune saisie n'est nécessaire.
- **Anciennes collections (2022 → 2025)** : produits et **prix conseillés d'époque** lus dans les
  sujets publics « Calendrier des sorties » du forum Pokécardex, extensions FR depuis Noir et Blanc
  via TCGdex. Leur prix actuel est relevé chez les revendeurs ; le **prix de revente** (ventes FR sur
  Cardmarket) vient de l'API PokeTrace (clé gratuite). Les pages `/series` de Pokécardex sont
  chiffrées par le site : elles ne sont pas exploitées.
- **Suivi stock & prix** : une architecture d'adaptateurs par site (JSON-LD schema.org générique, plus
  Play-In, Philibert, Cultura et Smyths Toys), une fréquence configurable par fiche, un délai aléatoire,
  une seule requête à la fois par domaine, un backoff exponentiel et le respect de `robots.txt`.
  Formulaire « ajouter une URL » avec détection du revendeur et test immédiat. Chaque relevé récupère
  le maximum d'infos de la fiche : **galerie d'images** (dans la plus grande taille disponible),
  description, marque, EAN normalisé, référence et rayon du site.
- **Annuaire des revendeurs** : 18 sites français vendant du Pokémon TCG (boutiques spécialisées,
  enseignes culturelles, jouets, grandes surfaces), chacun avec son lien vers le rayon Pokémon et
  son statut de relevé vérifié (fiable, via Chromium, bloqué, non testé). Depuis une fiche produit,
  un clic lance la recherche du produit sur chaque site où il n'est pas encore suivi.
- **Alertes** [ntfy](https://ntfy.sh), et Telegram en option : retour en stock, prix ≤ prix cible
  (défini **par produit** et **par fiche revendeur**, la fiche est prioritaire), ouverture d'une
  précommande. Anti-doublon de 6 h.
- **Marché secondaire** : meilleur prix boutique comparé au prix conseillé, historique quotidien des
  prix, graphique « prix boutiques vs prix marché », ratio prix marché / prix d'achat. **Cartes phares
  choisies automatiquement** (cartes secrètes les mieux cotées des 4 dernières extensions) et cotées
  chaque jour via TCGdex. Le prix marché des produits scellés n'a pas de source automatique autorisée :
  saisie manuelle ou PokeTrace. Provider PokeTrace prévu (squelette). **Cardmarket n'est jamais scrapé.**
- **Ma collection** : quantité, prix d'achat, date, magasin, état du scellé, photo ; valeur estimée,
  plus-value latente, export CSV (compatible Excel FR).
- **Tableau de bord** : prochaines sorties, derniers retours en stock, alertes actives, valeur de la
  collection, top variations de prix sur 30 jours.
- **Compte et connexion** : le premier compte créé devient propriétaire de l'instance. Les inscriptions
  sont ensuite fermées, sauf si `ALLOW_REGISTRATION=true`.

## Stack

| Couche      | Technologies                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Web         | Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| Données     | PostgreSQL, Prisma 7 (driver adapter `pg`)                                                         |
| Worker      | Node.js 24, node-cron, Playwright (Chromium headless, en repli), cheerio                           |
| Qualité     | Vitest, ESLint, Prettier, pino (logs JSON), GitHub Actions                                         |
| Déploiement | Docker Compose, Dokploy, Traefik (HTTPS Let's Encrypt)                                             |

### Architecture

```
apps/
  web/        Interface Next.js + Server Actions + /api/health
  worker/     Planificateur : relevés revendeurs, import TCGdex, prix marché, notifications
packages/
  db/         Schéma Prisma, migrations, seed, client partagé
  adapters/   Adaptateurs revendeurs, client HTTP « poli », robots.txt, fixtures + tests
  market/     Providers de prix marché (manuel, PokeTrace, TCGdex), valorisation
  shared/     Config d'environnement (zod), logger pino, formats FR
```

```
             ┌──────────── Traefik (tcg.digitalstack.cloud, HTTPS) ────────────┐
             │                                                                 │
        ┌────▼────┐   Server Actions   ┌────────────┐   relevés planifiés   ┌──┴───────┐
        │   web   │ ─────────────────▶ │ PostgreSQL │ ◀──────────────────── │  worker  │
        └─────────┘                    └────────────┘                       └────┬─────┘
                                                                                 │
                       TCGdex · Play-In · Philibert · Cultura · Smyths · ntfy ◀──┘
```

**Pourquoi node-cron et pas BullMQ/Redis ?** Il n'y a qu'un utilisateur et quelques dizaines de fiches.
L'état de planification (`Listing.nextCheckAt`) vit en base : un redémarrage ne perd rien, et Redis
ajouterait un service sans rien apporter.

## Installation locale

Prérequis : **Node.js 24**, **pnpm 12** (`corepack enable`) et une base PostgreSQL.

```bash
git clone https://github.com/SLKC1PH3R/tcgwatch.git
cd tcgwatch
pnpm install                  # génère aussi le client Prisma
cp .env.example .env          # puis adapter DATABASE_URL, etc.
```

Pas de PostgreSQL sous la main ? Prisma fournit une base locale intégrée :

```bash
pnpm --filter @tcgwatch/db exec prisma dev -d
# copier l'URL "TCP" affichée (postgres://postgres:postgres@localhost:…/template1) dans DATABASE_URL
# et ajouter DATABASE_POOL_MAX=1 : cette base n'accepte qu'une connexion à la fois
```

Ou avec Docker : `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=change-me -e POSTGRES_USER=tcgwatch postgres:17-alpine`.

```bash
pnpm db:deploy                # applique les migrations
pnpm db:seed                  # Règne Delta (ME06), coffrets 30 ans, revendeurs V1
pnpm --filter @tcgwatch/worker exec playwright install chromium   # optionnel (sites rendus en JS)
pnpm dev                      # web sur http://localhost:3000 + worker
```

À la première visite, créez le compte propriétaire sur `/inscription`.

Commandes utiles :

| Commande                                                         | Rôle                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm test`                                                      | Tests unitaires (adaptateurs sur fixtures HTML, alertes, notifications, valorisation) |
| `pnpm lint` · `pnpm typecheck` · `pnpm format`                   | Qualité                                                                               |
| `pnpm db:migrate`                                                | Nouvelle migration après modification du schéma                                       |
| `pnpm --filter @tcgwatch/worker check-once all-now`              | Relève immédiatement toutes les fiches                                                |
| `pnpm --filter @tcgwatch/worker check-once tcgdex`               | Lance l'import TCGdex                                                                 |
| `pnpm fixtures:record <url> <nom> [--browser] [--strip-classes]` | Enregistre une fiche comme fixture de test                                            |

## Variables d'environnement

La liste complète et commentée est dans [`.env.example`](.env.example). Aucun secret n'est présent dans le code.

| Variable                                        | Défaut                                   | Rôle                                                                                                              |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | **obligatoire**                          | Connexion PostgreSQL (Internal Connection URL de la base Dokploy)                                                 |
| `APP_URL`                                       | `https://tcg.digitalstack.cloud`         | URL publique                                                                                                      |
| `TZ`                                            | `Europe/Paris`                           | Fuseau des crons et de l'affichage                                                                                |
| `ALLOW_REGISTRATION`                            | `false`                                  | Autorise d'autres inscriptions après le premier compte                                                            |
| `SESSION_TTL_DAYS`                              | `30`                                     | Durée des sessions                                                                                                |
| `COOKIE_SECURE`                                 | `true`                                   | Cookie HTTPS uniquement (`false` en local sans HTTPS)                                                             |
| `NTFY_URL` / `NTFY_TOKEN`                       | —                                        | Topic ntfy (ex. `https://ntfy.sh/mon-topic-secret`) et jeton optionnel                                            |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`       | —                                        | Notifications Telegram (optionnel)                                                                                |
| `DEFAULT_CHECK_INTERVAL_MIN`                    | `30`                                     | Fréquence par défaut d'un relevé                                                                                  |
| `SCRAPER_USER_AGENT`                            | Chrome récent                            | User-agent envoyé aux sites                                                                                       |
| `SCRAPER_MIN_DELAY_MS` / `SCRAPER_MAX_DELAY_MS` | `2000` / `6000`                          | Délai aléatoire entre deux requêtes d'un même domaine                                                             |
| `PLAYWRIGHT_ENABLED`                            | `true`                                   | Repli Chromium pour les sites rendus en JavaScript                                                                |
| `LISTINGS_CRON` / `TCGDEX_CRON` / `MARKET_CRON` | `* * * * *` / `0 6 * * *` / `30 6 * * *` | Planification                                                                                                     |
| `TCGDEX_SERIES`                                 | `me,sv,swsh,sm,xy,bw`                    | Séries TCGdex importées (Méga-Évolution, Écarlate et Violet, Épée et Bouclier, Soleil et Lune, XY, Noir et Blanc) |
| `POKECARDEX_ENABLED` / `POKECARDEX_CRON`        | `true` / `15 6 * * *`                    | Import du calendrier des produits FR de Pokécardex                                                                |
| `CARDNEXUS_API_KEY`                             | —                                        | Clé API CardNexus (gratuite) : annonce FR la moins chère de chaque produit scellé                                 |
| `POKETRACE_API_KEY`                             | —                                        | Clé PokeTrace **offre Pro** (marché EU) : ventes Cardmarket FR                                                    |
| `SEED_IF_EMPTY`                                 | `true` (compose)                         | Seed initial au premier démarrage si la base est vide                                                             |

## Déploiement sur Dokploy

1. **Créer la base** : dans le projet Dokploy, _Create Service_ puis **Database** et **PostgreSQL**.
   Une fois démarrée, copier son _Internal Connection URL_ (onglet _General_). Ses sauvegardes S3
   se configurent dans l'onglet _Backups_.
1. **Créer l'application** : dans le même projet, _Create Service_ puis **Compose**.
1. **Source** : choisir le fournisseur _GitHub_, le dépôt `SLKC1PH3R/tcgwatch`, la branche `main` et le
   chemin du compose `./docker-compose.yml`. Le type de compose est `docker-compose`.
1. **Environment** : coller au minimum :
   ```env
   DATABASE_URL=postgresql://postgres:<mot-de-passe>@<nom-interne-de-la-base>:5432/<base>
   APP_URL=https://tcg.digitalstack.cloud
   NTFY_URL=https://ntfy.sh/<topic-secret>
   ```
1. **Domains** : _Add Domain_, service `web`, host `tcg.digitalstack.cloud`, path `/`, container port
   `3000`, HTTPS activé avec _Let's Encrypt_.
1. **DNS** : un enregistrement `A` de `tcg.digitalstack.cloud` vers l'IP du VPS. Derrière le proxy
   Cloudflare (nuage orange), régler le chiffrement SSL/TLS sur **Full** (ou _Full (strict)_ une fois
   le certificat émis) ; le mode _Flexible_ provoque des boucles de redirection.
1. **Deploy**. Dokploy construit les deux images depuis le dépôt :
   - le **worker** applique les migrations Prisma, fait le seed si la base est vide, puis démarre
     les crons ;
   - le **web** est exposé par Traefik en HTTPS selon le domaine déclaré à l'étape _Domains_.
     Après tout ajout ou changement de domaine, il faut **redéployer** le compose.
1. Ouvrir `https://tcg.digitalstack.cloud` et créer le compte propriétaire.
1. _(Optionnel)_ Activer l'**Auto Deploy** (webhook GitHub) pour redéployer à chaque push sur `main`.

Healthchecks : `GET /api/health` sur le web (port 3000) et sur le worker (port 3001, non exposé).

> La base n'est pas dans le compose : web et worker la joignent via le réseau `dokploy-network`,
> sur lequel Dokploy place ses bases. Le mot de passe ne vit que dans l'onglet _Environment_.

Volume persistant : `uploads` (photos de la collection). Les données sont dans la base Dokploy.

## Ajouter un adaptateur revendeur

Un site qui publie un JSON-LD `schema.org/Product` correct, ou une fiche PrestaShop standard
(formulaire `#add-to-cart-or-refresh`), fonctionne **sans code** : l'adaptateur générique est utilisé
automatiquement.

Pour le faire apparaître dans la page **Revendeurs**, ajoutez-le à `RETAILER_DIRECTORY`
(`packages/adapters/src/directory.ts`) avec son rayon Pokémon, son modèle de recherche (`{q}`) et son
statut de relevé constaté. Le worker synchronise l'annuaire en base à chaque démarrage
(`pnpm --filter @tcgwatch/worker check-once retailers` pour le faire à la main).

Pour un site qui demande une logique spécifique :

1. **Enregistrer une fiche réelle** comme fixture :
   ```bash
   pnpm fixtures:record "https://www.exemple.fr/produit/123" exemple-en-stock
   # --browser pour un site rendu en JavaScript ; --strip-classes pour alléger la fixture
   ```
2. **Créer l'adaptateur** `packages/adapters/src/adapters/exemple.ts` :
   ```ts
   import { load } from 'cheerio';
   import { mergeResults, parseJsonLdFrom, parseOpenGraph } from '../jsonld';
   import { availabilityFromText, findReleaseDate, pickScope, visibleText } from '../heuristics';
   import type { ListingResult, RetailerAdapter } from '../types';

   export function parseExemple(html: string, url: string): ListingResult {
     const $ = load(html);
     const scope = pickScope($, ['.product-buybox', 'main']); // zone d'achat du produit principal
     const extra: Partial<ListingResult> = {
       availability: availabilityFromText(visibleText($, scope.find('button'))),
       releaseDate: findReleaseDate(visibleText($, scope)),
     };
     // Le premier argument a la priorité : ici, le JSON-LD l'emporte sur les heuristiques.
     return mergeResults(parseJsonLdFrom($, url), extra, parseOpenGraph($, url));
   }

   export const exempleAdapter: RetailerAdapter = {
     key: 'exemple',
     name: 'Exemple',
     domains: ['exemple.fr'],
     parse: parseExemple,
     fetchListing: async (url, ctx) => parseExemple(await ctx.fetchHtml(url), url),
   };
   ```
3. **L'inscrire** dans `ADAPTERS` (`packages/adapters/src/registry.ts`) et l'exporter dans `src/index.ts`.
4. **Tester** sur la fixture dans `packages/adapters/test/adapters.test.ts`, puis lancer `pnpm test`.

Le revendeur est créé automatiquement à l'ajout de la première URL. Le réseau (politesse, robots.txt,
Chromium) est géré par `PoliteFetcher` : un adaptateur ne fait qu'analyser du HTML.

## Bonnes pratiques et limites

- **Politesse** : une requête à la fois par domaine, délai aléatoire, `robots.txt` respecté (une fiche
  interdite passe en état « bloqué »), backoff jusqu'à 12 h en cas d'erreurs répétées.
- **Exclus en V1** : Amazon, Fnac et Cdiscount (protections anti-bot, CGU). Cardmarket n'est jamais scrapé.
- **Cultura et Smyths Toys** sont protégés par des anti-bots (403, Imperva). Leurs adaptateurs passent
  par Chromium sans garantie de succès. Leurs fixtures de test sont **synthétiques** : elles sont à
  remplacer par de vraies captures (`pnpm fixtures:record … --browser`). Les fixtures Play-In et
  Philibert sont des pages réelles élaguées.
- Les images produits sont chargées depuis les sites revendeurs (`referrerPolicy="no-referrer"`).

## Licence

[MIT](LICENSE)

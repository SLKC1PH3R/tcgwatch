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
  (gratuite, sans clé), enrichi par les dates « Sortie prévue le … » détectées sur les fiches revendeurs.
  Vue mensuelle, liste « à venir » avec compte à rebours, édition et validation manuelles
  (statuts `auto` / `validé`).
- **Suivi stock & prix** : une architecture d'adaptateurs par site (JSON-LD schema.org générique, plus
  Play-In, Philibert, Cultura et Smyths Toys), une fréquence configurable par fiche, un délai aléatoire,
  une seule requête à la fois par domaine, un backoff exponentiel et le respect de `robots.txt`.
  Formulaire « ajouter une URL » avec détection du revendeur et test immédiat.
- **Alertes** [ntfy](https://ntfy.sh), et Telegram en option : retour en stock, prix ≤ prix cible
  (défini **par produit** et **par fiche revendeur**, la fiche est prioritaire), ouverture d'une
  précommande. Anti-doublon de 6 h.
- **Marché secondaire** : historique quotidien des prix (saisie manuelle du prix Cardmarket constaté),
  graphique « prix boutiques vs prix marché », ratio prix marché / prix d'achat, suivi des cartes phares
  via TCGdex. Provider PokeTrace prévu (squelette). **Cardmarket n'est jamais scrapé.**
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

| Variable                                        | Défaut                                   | Rôle                                                                   |
| ----------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                  | **obligatoire**                          | Connexion PostgreSQL (Internal Connection URL de la base Dokploy)      |
| `APP_DOMAIN`                                    | `tcg.digitalstack.cloud`                 | Domaine routé par Traefik                                              |
| `APP_URL`                                       | `https://tcg.digitalstack.cloud`         | URL publique                                                           |
| `TZ`                                            | `Europe/Paris`                           | Fuseau des crons et de l'affichage                                     |
| `ALLOW_REGISTRATION`                            | `false`                                  | Autorise d'autres inscriptions après le premier compte                 |
| `SESSION_TTL_DAYS`                              | `30`                                     | Durée des sessions                                                     |
| `COOKIE_SECURE`                                 | `true`                                   | Cookie HTTPS uniquement (`false` en local sans HTTPS)                  |
| `NTFY_URL` / `NTFY_TOKEN`                       | —                                        | Topic ntfy (ex. `https://ntfy.sh/mon-topic-secret`) et jeton optionnel |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`       | —                                        | Notifications Telegram (optionnel)                                     |
| `DEFAULT_CHECK_INTERVAL_MIN`                    | `30`                                     | Fréquence par défaut d'un relevé                                       |
| `SCRAPER_USER_AGENT`                            | Chrome récent                            | User-agent envoyé aux sites                                            |
| `SCRAPER_MIN_DELAY_MS` / `SCRAPER_MAX_DELAY_MS` | `2000` / `6000`                          | Délai aléatoire entre deux requêtes d'un même domaine                  |
| `PLAYWRIGHT_ENABLED`                            | `true`                                   | Repli Chromium pour les sites rendus en JavaScript                     |
| `LISTINGS_CRON` / `TCGDEX_CRON` / `MARKET_CRON` | `* * * * *` / `0 6 * * *` / `30 6 * * *` | Planification                                                          |
| `TCGDEX_SERIES`                                 | `me,sv`                                  | Séries TCGdex importées                                                |
| `POKETRACE_API_KEY`                             | —                                        | API PokeTrace (V2)                                                     |
| `SEED_IF_EMPTY`                                 | `true` (compose)                         | Seed initial au premier démarrage si la base est vide                  |

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
   APP_DOMAIN=tcg.digitalstack.cloud
   APP_URL=https://tcg.digitalstack.cloud
   NTFY_URL=https://ntfy.sh/<topic-secret>
   ```
1. **DNS** : un enregistrement `A` de `tcg.digitalstack.cloud` vers l'IP du VPS.
1. **Deploy**. Dokploy construit les deux images depuis le dépôt :
   - le **worker** applique les migrations Prisma, fait le seed si la base est vide, puis démarre
     les crons ;
   - le **web** est exposé par Traefik en HTTPS (certificat Let's Encrypt via les labels du compose,
     redirection HTTP vers HTTPS).
1. Ouvrir `https://tcg.digitalstack.cloud` et créer le compte propriétaire.
1. _(Optionnel)_ Activer l'**Auto Deploy** (webhook GitHub) pour redéployer à chaque push sur `main`.

Healthchecks : `GET /api/health` sur le web (port 3000) et sur le worker (port 3001, non exposé).

> La base n'est pas dans le compose : web et worker la joignent via le réseau `dokploy-network`,
> sur lequel Dokploy place ses bases. Le mot de passe ne vit que dans l'onglet _Environment_.

Volume persistant : `uploads` (photos de la collection). Les données sont dans la base Dokploy.

## Ajouter un adaptateur revendeur

Un site qui publie un JSON-LD `schema.org/Product` correct fonctionne **sans code** : l'adaptateur
générique est utilisé automatiquement. Pour un site qui demande une logique spécifique :

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

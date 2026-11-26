import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';
import { ago } from '@/lib/time';
import { cn } from '@/lib/utils';
import s from './landing.module.css';
import { AlertSwitches, ScannerBand, type ScanCard } from './scanner-band';
import { SectionPager } from './section-pager';
import { TelegramDemo, type DemoAlert } from './telegram-demo';

export const metadata: Metadata = {
  title: 'TCGWatch — stocks, prix et alertes Pokémon JCC en France',
  description:
    'Restocks des ETB, displays et coffrets Pokémon chez les boutiques françaises, prix comparés port compris, cote du marché, scanner et collection de cartes, alertes sur votre téléphone. Gratuit.',
};

/** Cartes de secours quand l'encyclopédie n'a pas encore de cote. */
const LOCAL_CARDS = ['b', 'g', 'r'].map((c) => `/cards/30e-anniversaire-${c}.webp`);

const STEPS = [
  {
    title: 'Scanner',
    text: 'Photographiez une carte ou importez une série de photos : elle est identifiée automatiquement.',
  },
  {
    title: 'Coter',
    text: 'Cote Cardmarket du jour ou prix des ventes eBay en France, au choix.',
  },
  {
    title: 'Classer',
    text: 'La carte rejoint le classeur de son extension, en Full Set ou en Master Set.',
  },
  {
    title: 'Partager',
    text: 'Vitrines, doubles disponibles à l’échange et page de collectionneur publique.',
  },
];

const FAQ = [
  {
    q: 'TCGWatch est-il gratuit ?',
    a: 'Oui. Aucun abonnement, aucune publicité, aucune revente de données.',
  },
  {
    q: 'Quelles boutiques sont surveillées ?',
    a: 'Des boutiques spécialisées et des grandes enseignes françaises, relevées environ toutes les heures. Les sites douteux sont exclus et chaque prix est comparé frais de port compris.',
  },
  {
    q: 'Comment les alertes sont-elles envoyées ?',
    a: 'Par notification sur votre téléphone (après installation de l’application depuis le site), par ntfy ou par Telegram. Vous choisissez les produits suivis, les types d’alerte et, si besoin, un prix cible.',
  },
  {
    q: 'D’où viennent les cotes des cartes ?',
    a: 'De la cote Cardmarket (tendance du jour) et, pour les cartes de votre collection, de la médiane des annonces eBay en France. L’une ou l’autre peut être affichée dans tout le site.',
  },
  {
    q: 'Le scanner reconnaît-il toutes les cartes ?',
    a: 'Il compare la photo aux illustrations de l’encyclopédie, toutes extensions françaises et promos comprises. En cas de doute, les cartes les plus proches sont proposées.',
  },
  {
    q: 'Peut-on importer une collection existante ?',
    a: 'Oui, depuis un export Pokécardex, Dragon Shield ou un tableur au format CSV. Un aperçu ligne par ligne précède l’import.',
  },
  {
    q: 'L’application nécessite-t-elle un store ?',
    a: 'Non. Sur iPhone comme sur Android, elle s’installe depuis le site et se met à jour automatiquement.',
  },
  {
    q: 'Que deviennent mes données ?',
    a: 'Elles vous appartiennent : export complet à tout moment, suppression du compte en un clic. La page de collectionneur n’est publique que si vous l’activez.',
  },
];

const Arrow = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Page d'accueil publique : identité « scanner », avec les vraies cartes et boutiques du site. */
export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/');
  const [retailers, products, cardCount, releases, open, lastCheck, top, restocks, qr] =
    await Promise.all([
      prisma.retailer.count({ where: { enabled: true, listings: { some: {} } } }),
      prisma.product.count({ where: { listings: { some: {} } } }),
      prisma.card.count(),
      prisma.release.count({ where: { cards: { some: {} } } }),
      isRegistrationOpen(),
      prisma.listing.aggregate({ _max: { lastCheckedAt: true } }),
      prisma.card.findMany({
        where: { imageUrl: { not: null }, priceTrend: { not: null }, category: 'Pokémon' },
        orderBy: { priceTrend: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          localId: true,
          imageUrl: true,
          rarity: true,
          priceTrend: true,
          release: { select: { nameFr: true, cardCountOfficial: true } },
        },
      }),
      prisma.alertEvent.findMany({
        where: { type: 'BACK_IN_STOCK', listingId: { not: null } },
        distinct: ['dedupeKey'],
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          createdAt: true,
          price: true,
          product: { select: { name: true } },
          listing: { select: { retailer: { select: { name: true } } } },
        },
      }),
      QRCode.toString(`${getEnv().APP_URL.replace(/\/$/, '')}/installer`, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    ]);

  const fr = new Intl.NumberFormat('fr-FR');
  const signUp = open ? '/inscription' : '/connexion';
  const checkedAt = lastCheck._max.lastCheckedAt;

  const scanCards: ScanCard[] = top.length
    ? top.map((c) => ({
        id: c.id,
        image: tcgdexAsset(c.imageUrl ?? undefined, '/high.webp') ?? LOCAL_CARDS[0]!,
        data: [
          ['NOM', c.name],
          ['EXT', c.release.nameFr],
          [
            'N°',
            c.release.cardCountOfficial ? `${c.localId}/${c.release.cardCountOfficial}` : c.localId,
          ],
          ['RARETÉ', c.rarity ?? '—'],
          ['COTE', formatPrice(toNumber(c.priceTrend)!)],
        ],
      }))
    : LOCAL_CARDS.map((image, i) => ({
        id: `local-${i}`,
        image,
        data: [
          ['NOM', 'Carte'],
          ['EXT', '30ᵉ Anniversaire'],
        ],
      }));
  const [heroA, heroB] = [scanCards[1] ?? scanCards[0]!, scanCards[0]!];

  const ledger = restocks.length
    ? restocks.map((r) => ({
        time: r.createdAt.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        }),
        name: r.product?.name ?? 'Produit',
        shop: r.listing?.retailer.name ?? '',
        price: toNumber(r.price),
      }))
    : [];
  // Alertes de la démonstration : les vrais derniers restocks, complétés par des exemples.
  const demoAlerts: DemoAlert[] = [
    ...ledger
      .filter((r) => r.price !== null)
      .slice(0, 3)
      .map((r) => ({
        kind: 'stock' as const,
        product: r.name,
        shop: r.shop,
        price: `${formatPrice(r.price!)} livré`,
      })),
    { kind: 'preorder', product: 'Display 36 boosters', shop: 'Boutique', price: 'précommande' },
    {
      kind: 'price',
      product: 'Coffret Dresseur d’Élite',
      shop: 'Boutique',
      price: 'sous votre seuil',
    },
  ];

  return (
    <div className={s.page}>
      <SectionPager />
      {/* ---------- Héros ---------- */}
      <section className={cn(s.hero, s.snap)} id="haut" data-snap>
        <div className={s.heroGrid} aria-hidden />
        <div className={s.dust} aria-hidden />

        <nav className={s.nav} aria-label="Navigation principale">
          <Link href="/bienvenue" className={s.brand}>
            <i />
            TCGWATCH
          </Link>
          <div className={s.navLinks}>
            <a href="#scanner">Scanner</a>
            <a href="#outils">Outils</a>
            <a href="#faq">FAQ</a>
            <Link href="/installer">Appli</Link>
          </div>
          <div className={s.navRight}>
            <Link href="/connexion" className={s.navLogin}>
              Connexion
            </Link>
            {open && (
              <Link href="/inscription" className={s.navCta}>
                Créer un compte
              </Link>
            )}
          </div>
        </nav>

        <div className={s.heroMain}>
          <div>
            <p className={cn(s.eyebrow, s.rise)} style={{ '--d': '.1s' } as React.CSSProperties}>
              <i />
              {checkedAt
                ? `Boutiques relevées ${ago(checkedAt)}`
                : 'Boutiques relevées chaque heure'}
            </p>
            <h1
              className={cn(s.headline, s.grad, s.lilac, s.h1, s.rise)}
              style={{ '--d': '.2s' } as React.CSSProperties}
            >
              <span>Le tout-en-un</span> <span>de l’univers</span>{' '}
              <span className={cn(s.grad, s.ember)}>Pokémon</span>
            </h1>
            <p
              className={cn(s.lede, s.rise)}
              style={{ marginTop: 28, maxWidth: 560, '--d': '.35s' } as React.CSSProperties}
            >
              TCGWatch relève les boutiques françaises toutes les heures,{' '}
              <strong>signale les retours en stock</strong> et compare les prix livrés. Le{' '}
              <strong>scanner de cartes</strong> tient votre collection et sa cote à jour. Gratuit
              et sans publicité.
            </p>
            <div
              className={cn(s.heroActions, s.rise)}
              style={{ '--d': '.5s' } as React.CSSProperties}
            >
              <Link href={signUp} className={cn(s.btn, s.btnPrimary)}>
                {open ? 'Créer un compte' : 'Se connecter'} <Arrow />
              </Link>
              <a href="#scanner" className={cn(s.btn, s.btnGhost)}>
                Découvrir le scanner
              </a>
            </div>
          </div>

          <div className={s.scene} aria-hidden>
            <div className={s.sceneInner}>
              <svg className={s.ring} viewBox="0 0 880 640" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tw-ring" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#5b6cff" stopOpacity="0.95" />
                    <stop offset="0.45" stopColor="#c4b5fd" stopOpacity="0.9" />
                    <stop offset="0.7" stopColor="#ffd43b" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#a78bfa" stopOpacity="0.95" />
                  </linearGradient>
                  <filter id="tw-glow" x="-20%" y="-60%" width="140%" height="220%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>
                <g transform="rotate(-13 450 360)">
                  <ellipse
                    cx="450"
                    cy="380"
                    rx="400"
                    ry="120"
                    fill="none"
                    stroke="url(#tw-ring)"
                    strokeWidth="7"
                    filter="url(#tw-glow)"
                    opacity="0.7"
                  />
                  <ellipse
                    cx="450"
                    cy="380"
                    rx="400"
                    ry="120"
                    fill="none"
                    stroke="url(#tw-ring)"
                    strokeWidth="1.6"
                  />
                  <ellipse
                    cx="450"
                    cy="380"
                    rx="372"
                    ry="102"
                    fill="none"
                    stroke="rgba(196,181,253,0.2)"
                    strokeDasharray="2 7"
                  />
                  <ellipse
                    className={s.ringRun}
                    cx="450"
                    cy="380"
                    rx="400"
                    ry="120"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    pathLength={1000}
                    strokeDasharray="70 930"
                  />
                </g>
              </svg>
              <div className={cn(s.heroCard, s.cardA)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroA.image} alt="" referrerPolicy="no-referrer" />
              </div>
              <div className={cn(s.heroCard, s.cardB)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroB.image} alt="" referrerPolicy="no-referrer" />
              </div>
              <div className={s.beam} />
              <pre className={cn(s.glass, s.panelJson)}>
                {'{\n  '}
                <span className={s.k}>&quot;alerte&quot;</span>
                {': "retour_en_stock",\n  '}
                <span className={s.k}>&quot;produit&quot;</span>
                {`: "${(ledger[0]?.name ?? 'Coffret Dresseur d’Élite').slice(0, 26)}",\n  `}
                <span className={s.k}>&quot;boutique&quot;</span>
                {`: "${ledger[0]?.shop ?? 'Boutique'}",\n  `}
                <span className={s.k}>&quot;prix_livré&quot;</span>
                {`: "${ledger[0]?.price ? formatPrice(ledger[0].price) : '—'}"\n}`}
              </pre>
              <div className={cn(s.glass, s.panelCheck)}>
                <ul>
                  <li className={s.done}>
                    <i />
                    Boutique relevée
                  </li>
                  <li className={s.done}>
                    <i />
                    Retour en stock
                  </li>
                  <li className={s.done}>
                    <i />
                    Prix port compris
                  </li>
                  <li className={s.active}>
                    <i />
                    Alerte envoyée
                  </li>
                  <li>
                    <i />
                    Ajouté à la collection
                  </li>
                </ul>
              </div>
              <div className={s.pipeline}>
                <span className={s.on}>Relever</span>
                <em>→</em>
                <span className={s.on}>Comparer</span>
                <em>→</em>
                <span className={s.on}>Alerter</span>
                <em>→</em>
                <span>Collectionner</span>
              </div>
            </div>
          </div>
        </div>

        <div className={s.stats}>
          {[
            [fr.format(retailers), 'boutiques françaises suivies'],
            [fr.format(products), 'produits scellés comparés'],
            [fr.format(cardCount), 'cartes reconnues par le scanner'],
            ['1 h', 'entre deux relevés'],
          ].map(([value, label]) => (
            <div key={label} className={s.stat}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Scanner ---------- */}
      <section
        className={cn(s.scanner, s.snap, s.snapCenter)}
        data-snap
        id="scanner"
        aria-labelledby="scanner-titre"
      >
        <div className={s.scannerHead}>
          <div>
            <p className={s.label} style={{ marginBottom: 20 }}>
              <b>02</b> — Le scanner
            </p>
            <h2 id="scanner-titre" className={cn(s.headline, s.grad, s.indigo, s.h2)}>
              Chaque carte scannée est identifiée, cotée et classée.
            </h2>
          </div>
          <div>
            <p className={s.lede}>
              Photo à l’unité ou en série : le scanner compare l’image aux illustrations de
              l’encyclopédie et ajoute la carte à votre collection, variante comprise.
            </p>
            <div className={s.miniStats}>
              <div>
                <b>{fr.format(cardCount)}</b>
                <span>cartes</span>
              </div>
              <div>
                <b>{fr.format(releases)}</b>
                <span>extensions</span>
              </div>
              <div>
                <b>2</b>
                <span>cotes : Cardmarket, eBay FR</span>
              </div>
            </div>
          </div>
        </div>
        <ScannerBand cards={scanCards} />
        <ol className={s.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              {step.title}
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Outils ---------- */}
      <section
        className={cn(s.sec, s.snap, s.snapCenter)}
        data-snap
        id="outils"
        aria-labelledby="outils-titre"
      >
        <div className={s.secHead}>
          <div>
            <span className={s.label}>
              <b>03</b> — Tout suivre
            </span>
            <h2 id="outils-titre" className={cn(s.headline, s.grad, s.indigo, s.h2)}>
              Le scellé, les cartes,
              <br />
              le marché.
            </h2>
          </div>
          <p className={s.lede}>
            Un seul compte pour guetter les restocks, comparer les prix livrés, suivre la cote et
            mesurer la valeur de votre collection.
          </p>
        </div>

        <div className={s.bento}>
          <article className={cn(s.tile, s.span4)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Retours en stock</span>
                <span className={s.live}>
                  <i />
                  En direct
                </span>
              </div>
              <h3>Derniers retours en stock</h3>
              <p>Boutiques relevées toutes les heures, prix livré indiqué.</p>
              <div className={s.viz}>
                <div className={s.ledger}>
                  <div className={s.ledgerRow}>
                    <span>Heure</span>
                    <span>Produit</span>
                    <span>Boutique</span>
                    <span className={s.ok}>Prix</span>
                  </div>
                  {(ledger.length
                    ? ledger
                    : [
                        {
                          time: '—',
                          name: 'Les prochains restocks s’afficheront ici',
                          shop: '',
                          price: null,
                        },
                      ]
                  ).map((r, i) => (
                    <div key={i} className={s.ledgerRow}>
                      <span className={s.dim}>{r.time}</span>
                      <span>{r.name}</span>
                      <span className={s.dim}>{r.shop}</span>
                      <span className={s.ok}>{r.price !== null ? formatPrice(r.price) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className={cn(s.tile, s.span2)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Telegram</span>
                <span>{fr.format(retailers)} boutiques</span>
              </div>
              <h3>Alertes instantanées</h3>
              <div className={s.viz}>
                <TelegramDemo alerts={demoAlerts} />
              </div>
            </div>
          </article>

          <article className={cn(s.tile, s.span2)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Alertes</span>
                <span>Démonstration</span>
              </div>
              <h3>Alertes paramétrables</h3>
              <div className={s.viz}>
                <AlertSwitches
                  items={[
                    { title: 'Retour en stock', hint: 'produits suivis', on: true },
                    { title: 'Précommande ouverte', hint: 'dès l’ouverture', on: true },
                    { title: 'Prix sous le seuil', hint: 'port compris', on: true },
                    { title: 'Nouvelle sortie', hint: 'au calendrier', on: false },
                  ]}
                />
              </div>
            </div>
          </article>

          <article className={cn(s.tile, s.span2)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Habitudes de réassort</span>
                <span>6 mois</span>
              </div>
              <h3>Fréquence de réassort</h3>
              <p>Jour, horaire et rythme habituels des retours en stock, boutique par boutique.</p>
              <div className={cn(s.viz, s.days)} aria-hidden>
                {['lu', 'ma', 'me', 'je', 've', 'sa', 'di'].map((d, i) => (
                  <div key={d} className={i === 1 ? s.top : undefined}>
                    <i style={{ height: `${[30, 100, 45, 22, 38, 12, 8][i]}%` }} />
                    {d}
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={cn(s.tile, s.span2)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Suivi financier</span>
                <span>Scellé et cartes</span>
              </div>
              <b className={cn(s.headline, s.grad, s.ember, s.big)}>Plus-value</b>
              <p>Prix d’achat, valeur actuelle et plus-values réalisées sur les reventes.</p>
              <div className={cn(s.viz, s.bars)} aria-hidden>
                <div className={s.bar} style={{ '--w': '58%' } as React.CSSProperties}>
                  <span>Investi</span>
                  <i />
                </div>
                <div className={cn(s.bar, s.now)} style={{ '--w': '100%' } as React.CSSProperties}>
                  <span>Valeur</span>
                  <i />
                </div>
              </div>
            </div>
          </article>

          <article className={cn(s.tile, s.span2)}>
            <div className={s.tileIn}>
              <div className={s.tileHead}>
                <span>Profil</span>
                <span>Optionnel</span>
              </div>
              <h3>Page de collectionneur</h3>
              <p>Classeurs complétés, vitrines, doubles et recherches sur une page publique.</p>
              <div className={s.viz}>
                <div className={s.profileCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroA.image} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <b>Pseudo</b>
                    <span>Avatar, couleur et présentation personnalisables</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section
        className={cn(s.sec, s.snap, s.snapCenter)}
        data-snap
        id="faq"
        aria-labelledby="faq-titre"
      >
        <div className={s.faqGrid}>
          <div>
            <span className={s.label} style={{ display: 'block', marginBottom: 20 }}>
              <b>04</b> — FAQ
            </span>
            <h2 id="faq-titre" className={cn(s.headline, s.grad, s.lilac, s.h2)}>
              Questions
              <br />
              fréquentes
            </h2>
            <p className={s.lede} style={{ marginTop: 24 }}>
              Fonctionnement, sources des données et confidentialité.
            </p>
          </div>
          <div>
            {FAQ.map((item, i) => (
              <details key={item.q} className={s.faqItem} open={i === 0}>
                <summary>
                  <small>{String(i + 1).padStart(2, '0')}</small>
                  {item.q}
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Appel final ---------- */}
      <div className={cn(s.snap, s.finale)} data-snap>
        <section className={s.cta} aria-labelledby="cta-titre">
          <span className={cn(s.hud, s.hudTl)} aria-hidden />
          <span className={cn(s.hud, s.hudTr)} aria-hidden />
          <span className={cn(s.hud, s.hudBl)} aria-hidden />
          <span className={cn(s.hud, s.hudBr)} aria-hidden />
          <div>
            <span className={s.label} style={{ display: 'block', marginBottom: 20 }}>
              <b>05</b> — Inscription
            </span>
            <h2 id="cta-titre" className={cn(s.headline, s.grad, s.lilac, s.ctaH2)}>
              Suivez vos produits <span className={cn(s.grad, s.ember)}>dès aujourd’hui.</span>
            </h2>
            <p className={s.lede} style={{ marginTop: 22, maxWidth: 520 }}>
              Création de compte en 30 secondes. Sélectionnez les produits à suivre et ajoutez vos
              premières cartes.
            </p>
            <div style={{ marginTop: 36 }}>
              <Link href={signUp} className={s.glowBtn}>
                <span>
                  {open ? 'Créer un compte' : 'Se connecter'} <Arrow />
                </span>
              </Link>
            </div>
          </div>
          <div className={s.ctaSide}>
            <p className={s.label}>Application mobile, sans store</p>
            <div
              className={s.qr}
              // QR code généré côté serveur à partir de l'adresse du site.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <Link href="/installer" className={cn(s.btn, s.btnGhost)}>
              Installer l’application
            </Link>
          </div>
        </section>

        <p className={cn(s.wordmark, s.headline, s.grad, s.indigo)} aria-hidden>
          TCGWatch
        </p>
        <footer className={s.footer}>
          <p>TCGWatch n’est pas affilié à The Pokémon Company, Nintendo ou aux boutiques citées.</p>
          <nav aria-label="Liens du site">
            <Link href="/installer">Installer l’appli</Link>
            <Link href="/methode">Méthode</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/cgu">CGU</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

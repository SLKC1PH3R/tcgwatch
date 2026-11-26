import {
  CalendarDays,
  FileUp,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { prisma } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';
import { BrandLogo } from '@/components/brand-logo';
import { InstallAppButton } from '@/components/install-app';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';
import { LandingTour, type TourPanel } from './landing-tour';

export const metadata: Metadata = {
  title: 'TCGWatch — stocks, prix et alertes Pokémon JCC en France',
  description:
    'Restocks des ETB, displays et coffrets Pokémon chez les boutiques françaises, prix comparés port compris, cote du marché, collection de cartes et de scellé, alertes sur ton téléphone. Gratuit.',
};

const NOTIFICATIONS = [
  { title: 'Retour en stock', text: 'Coffret Dresseur d’Élite · prix port compris' },
  { title: 'Précommande ouverte', text: 'Display 36 boosters de la prochaine extension' },
  { title: 'Sous ton prix cible', text: 'Tripack · moins cher que ton seuil' },
];

/** Ce qui a changé récemment : à tenir à jour à chaque nouveauté visible. */
const NEWS: { tag: string; title: string; text: string }[] = [
  {
    tag: 'Profil',
    title: 'Page de collectionneur',
    text: 'Classeurs, vitrines, doubles et recherches sur une page à ton image, à partager par un lien.',
  },
  {
    tag: 'Mobile',
    title: 'L’appli sur ton téléphone',
    text: 'Installée en deux gestes depuis le site, sans store, avec notifications et onglets en bas d’écran.',
  },
  {
    tag: 'Restocks',
    title: 'Habitudes de réassort',
    text: 'Le jour, l’heure et le rythme habituels des retours en stock de chaque boutique.',
  },
  {
    tag: 'Cartes',
    title: 'Prix eBay en français',
    text: 'La valeur de tes cartes au prix des ventes françaises, à côté de la cote Cardmarket.',
  },
  {
    tag: 'Collection',
    title: 'Import CSV et Master Set',
    text: 'Reprends ta collection d’un autre outil et complète tes sets, reverses comprises.',
  },
  {
    tag: 'Scellé',
    title: 'Bilan des reventes',
    text: 'Les plus-values de l’année, frais et prix d’achat compris, en CSV ou en PDF.',
  },
];

const ADD_WAYS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ScanLine,
    title: 'Scanner',
    text: 'Vise une carte avec l’appareil photo, ou importe des photos en rafale.',
  },
  {
    icon: Zap,
    title: 'Ajout rapide',
    text: 'Toute une extension à l’écran : un toucher par carte, normale ou reverse.',
  },
  {
    icon: FileUp,
    title: 'Import d’un fichier',
    text: 'Ton export Pokécardex, Dragon Shield ou ton propre tableur.',
  },
];

const CARDS = ['b', 'g', 'r'].map((c) => `/cards/30e-anniversaire-${c}.webp`);

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
      {children}
    </span>
  );
}

/** Page d'un classeur : cartes possédées et emplacements vides, barres Full Set et Master Set. */
function BinderMock() {
  const slots = [0, 1, null, 2, null, 0, 1, 2, null];
  return (
    <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-[0_30px_80px_-40px_rgba(139,124,255,0.6)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">30ᵉ Anniversaire</p>
        <p className="text-xs text-muted-foreground">page 1 / 12</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((s, i) =>
          s === null ? (
            <span
              key={i}
              className="aspect-[63/88] rounded-lg border-2 border-dashed border-border bg-muted/40"
            />
          ) : (
            <Image
              key={i}
              src={CARDS[s]!}
              alt=""
              width={216}
              height={300}
              className="aspect-[63/88] w-full rounded-lg object-cover"
            />
          ),
        )}
      </div>
      {[
        { label: 'Full Set', value: 78, color: 'bg-primary' },
        { label: 'Master Set, reverses comprises', value: 52, color: 'bg-[#4dabf7]' },
      ].map((b) => (
        <div key={b.label} className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{b.label}</span>
            <span className="tabular-nums">{b.value} %</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className={`h-2 rounded-full ${b.color}`} style={{ width: `${b.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Courbe de valeur de la collection face au montant investi. */
function ValueMock() {
  return (
    <div className="space-y-3 rounded-3xl border bg-card p-5 shadow-[0_30px_80px_-40px_rgba(139,124,255,0.6)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Valeur de la collection</p>
        <p className="text-sm font-bold text-success">plus-value latente</p>
      </div>
      <svg viewBox="0 0 320 150" className="h-auto w-full">
        <polyline points="0,140 320,140" fill="none" className="stroke-border" strokeWidth="1" />
        <polyline
          points="0,128 60,128 60,112 180,112 180,100 320,100"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="2.5"
          strokeDasharray="7 7"
        />
        <polyline
          points="0,126 40,122 80,110 120,104 160,86 200,80 240,58 280,50 320,30"
          fill="none"
          className="stroke-primary"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-primary" /> Valeur, Cardmarket ou eBay FR
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" /> Investi
        </span>
      </div>
      <div className="flex gap-2 pt-1">
        {CARDS.map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={216}
            height={300}
            className="aspect-[63/88] w-1/3 rounded-lg object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function OffersMock() {
  return (
    <div className="divide-y rounded-2xl border bg-background/60 px-5">
      {[
        { shop: 'Boutique A', price: '54,90 €', best: true },
        { shop: 'Boutique B', price: '57,40 €' },
        { shop: 'Boutique C', price: '59,90 €' },
        { shop: 'Boutique D', price: 'rupture', muted: true },
      ].map((o) => (
        <div key={o.shop} className="flex justify-between py-3 text-sm">
          <span>{o.shop}</span>
          <span
            className={
              o.best ? 'font-bold text-success' : o.muted ? 'text-muted-foreground' : undefined
            }
          >
            {o.price}
          </span>
        </div>
      ))}
      <p className="py-3 text-xs text-muted-foreground">Prix livrés chez toi, port compris</p>
    </div>
  );
}

function MarketMock() {
  return (
    <div className="space-y-3 rounded-2xl border bg-background/60 p-5">
      <p className="text-sm font-semibold">Indice du marché scellé</p>
      <svg viewBox="0 0 300 110" className="h-auto w-full">
        <polyline
          points="0,90 40,84 80,88 120,70 160,72 200,52 240,48 300,26"
          fill="none"
          className="stroke-primary"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex gap-2 text-xs">
        <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
          Hausses
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
          Baisses
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
          Bons plans
        </span>
      </div>
    </div>
  );
}

function ProfileMock() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-[linear-gradient(120deg,rgb(151_117_250/0.25),transparent_70%)] p-5">
      <Image
        src={CARDS[1]!}
        alt=""
        width={216}
        height={300}
        className="size-20 shrink-0 rounded-2xl border-2 border-[#9775fa] object-cover object-top"
      />
      <div className="min-w-0 space-y-1">
        <p className="font-display text-xl font-bold">Ta page</p>
        <p className="text-sm text-muted-foreground">
          Classeurs complétés · vitrines · doubles à l’échange
        </p>
        <p className="text-sm text-muted-foreground">Plus-value latente et réalisée</p>
      </div>
    </div>
  );
}

/** Page d'accueil publique : restocks, visite du site, collection, nouveautés et appli. */
export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/');
  const [retailers, products, cards, open, qr] = await Promise.all([
    prisma.retailer.count({ where: { enabled: true, listings: { some: {} } } }),
    prisma.product.count({ where: { listings: { some: {} } } }),
    prisma.card.count(),
    isRegistrationOpen(),
    QRCode.toString(`${getEnv().APP_URL.replace(/\/$/, '')}/installer`, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    }),
  ]);
  const fr = new Intl.NumberFormat('fr-FR');
  const stats = [
    { value: fr.format(retailers), label: 'boutiques françaises suivies' },
    { value: fr.format(products), label: 'produits scellés comparés' },
    { value: fr.format(cards), label: 'cartes dans l’encyclopédie' },
  ];
  const signUp = open ? '/inscription' : '/connexion';

  const tour: TourPanel[] = [
    {
      key: 'scelle',
      label: 'Scellé',
      title: 'Les restocks, avant tout le monde',
      text: 'Les boutiques françaises relevées toutes les heures, et une alerte dès qu’un produit que tu suis revient.',
      points: [
        'Alertes sur téléphone, ntfy ou Telegram',
        'Prix comparés port compris, sites douteux écartés',
        'Calendrier des sorties et des précommandes',
        'Habitudes de réassort de chaque boutique',
      ],
      visual: <OffersMock />,
    },
    {
      key: 'cartes',
      label: 'Cartes',
      title: 'Ta collection, carte par carte',
      text: 'Des classeurs par extension, en Full Set ou en Master Set, et la valeur de chaque carte.',
      points: [
        'Scanner, ajout rapide ou import CSV',
        'Ce qu’il manque pour finir un set, et ce que ça coûte',
        'Cote Cardmarket ou prix eBay en français',
        'Vitrines à partager par un lien',
      ],
      visual: <BinderMock />,
    },
    {
      key: 'marche',
      label: 'Marché',
      title: 'La cote du marché, sans tableur',
      text: 'Le prix des produits scellés et des cartes phares, et la tendance générale du marché.',
      points: [
        'Historique des prix de chaque produit',
        'Indice du marché, hausses et baisses',
        'Bons plans repérés automatiquement',
        'Encyclopédie des séries et extensions',
      ],
      visual: <MarketMock />,
    },
    {
      key: 'profil',
      label: 'Mon profil',
      title: 'Ton investissement, au clair',
      text: 'Ce que tu as payé, ce que ça vaut, ce que tes reventes ont rapporté, et une page publique à ton image.',
      points: [
        'Plus-value latente et réalisée',
        'Lots d’achat et demi-displays regroupés',
        'Bilan des reventes en CSV ou PDF',
        'Page de collectionneur personnalisable',
      ],
      visual: <ProfileMock />,
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-8">
        <BrandLogo />
        <nav className="flex flex-wrap items-center gap-1">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <a href="#visite">Fonctionnalités</a>
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <a href="#nouveautes">Nouveautés</a>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/connexion">Se connecter</Link>
          </Button>
          {open && (
            <Button asChild className="rounded-full">
              <Link href="/inscription">Créer un compte</Link>
            </Button>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {/* Accroche : les restocks. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-10 md:px-8 md:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" /> Gratuit · sans pub · fait en
                France
              </p>
              <a
                href="#nouveautes"
                className="inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Pill>Nouveau</Pill> Page de collectionneur, appli mobile
              </a>
            </div>
            <h1 className="font-display text-4xl leading-[1.04] font-bold tracking-tight md:text-6xl">
              Le{' '}
              <span className="bg-[linear-gradient(90deg,#ffd43b,#ff6b9a,#8b7cff,#4fd1ff)] bg-clip-text text-transparent">
                restock
              </span>{' '}
              arrive. Tu es déjà prévenu.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              TCGWatch relève les boutiques françaises toutes les heures et te prévient dès qu’un
              ETB, un display ou un coffret revient, au meilleur prix port compris. Et il tient ta
              collection de cartes et de scellé à jour.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href={signUp}>Commencer gratuitement</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="#visite">Faire le tour</a>
              </Button>
            </div>
            <dl className="grid max-w-xl grid-cols-3 gap-4 pt-2">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums md:text-3xl">
                    {s.value}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mx-auto w-full max-w-80" aria-hidden>
            <div className="space-y-2.5 rounded-[2.75rem] border-[10px] border-[#1d2032] bg-[linear-gradient(180deg,#1a1c2e,#0f1020)] px-3.5 pt-12 pb-7 text-[#f1f2f8] shadow-[0_40px_90px_-30px_rgba(255,212,59,0.35)]">
              <p className="pb-3 text-center font-display text-5xl font-semibold">9:41</p>
              {NOTIFICATIONS.map((n) => (
                <div key={n.title} className="flex gap-2.5 rounded-2xl bg-white/10 px-3.5 py-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#ffd43b] text-[10px] font-extrabold text-[#0c0d16]">
                    TW
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">{n.title}</p>
                    <p className="text-xs text-[#c4c8da]">{n.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Visite par onglets. */}
        <section id="visite" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 md:px-8">
          <h2 className="mb-2 text-center font-display text-2xl font-bold md:text-4xl">
            Le scellé, les cartes et le marché, au même endroit
          </h2>
          <p className="mb-8 text-center text-muted-foreground">
            Quatre espaces, un seul compte gratuit.
          </p>
          <LandingTour panels={tour} />
        </section>

        {/* Savoir quand guetter. */}
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
          <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
            Savoir quand guetter, et où acheter
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="space-y-3 rounded-3xl border bg-card p-6">
              <Pill>Nouveau</Pill>
              <h3 className="font-display text-xl font-bold">Les habitudes des boutiques</h3>
              <p className="text-sm text-muted-foreground">
                Six mois de relevés pour savoir quand guetter : jour, heure et rythme des réassorts.
              </p>
              <div className="space-y-2 rounded-2xl bg-background/60 p-4" aria-hidden>
                <div className="flex h-14 items-end gap-1.5">
                  {[30, 100, 45, 20, 35, 10, 8].map((h, i) => (
                    <span
                      key={i}
                      className={`flex-1 rounded-sm ${i === 1 ? 'bg-success' : 'bg-success/30'}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  « surtout le mardi, entre 8 h et 11 h »
                </p>
              </div>
            </article>
            <article className="space-y-3 rounded-3xl border bg-card p-6">
              <Store className="size-5 text-primary" />
              <h3 className="font-display text-xl font-bold">Le vrai prix, port compris</h3>
              <p className="text-sm text-muted-foreground">
                Toutes les offres côte à côte, livrées chez toi, avec l’écart au prix public. Les
                sites douteux sont écartés.
              </p>
            </article>
            <article className="space-y-3 rounded-3xl border bg-card p-6">
              <CalendarDays className="size-5 text-primary" />
              <h3 className="font-display text-xl font-bold">Le calendrier des sorties</h3>
              <p className="text-sm text-muted-foreground">
                Chaque extension et ses produits, avec la date française et l’ouverture des
                précommandes.
              </p>
            </article>
          </div>
        </section>

        {/* La collection de cartes. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Ta collection, rangée comme dans un vrai classeur
            </h2>
            <p className="text-lg text-muted-foreground">
              Coche tes cartes, vois ce qu’il manque pour finir un set, et suis la valeur de ta
              collection dans le temps, à la cote Cardmarket ou au prix français.
            </p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {ADD_WAYS.map((w) => (
                <li key={w.title} className="space-y-1.5 rounded-2xl border bg-card p-4">
                  <w.icon className="size-5 text-primary" />
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-xs text-muted-foreground">{w.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm" aria-hidden>
            <ValueMock />
          </div>
        </section>

        {/* Page de collectionneur. */}
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
          <div className="grid items-center gap-8 rounded-3xl border bg-card p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-10">
            <div className="space-y-3">
              <Pill>Nouveau</Pill>
              <h2 className="font-display text-2xl font-bold md:text-3xl">
                Ta page de collectionneur
              </h2>
              <p className="text-muted-foreground md:text-lg">
                Un lien à partager : tes classeurs terminés, tes vitrines, tes doubles à l’échange
                et les cartes que tu cherches. Avatar, couleur et présentation à ton goût.
              </p>
            </div>
            <div aria-hidden>
              <ProfileMock />
            </div>
          </div>
        </section>

        {/* Nouveautés. */}
        <section id="nouveautes" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 md:px-8">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold md:text-3xl">
            <Sparkles className="size-6 text-primary" /> Quoi de neuf
          </h2>
          <p className="mt-1 mb-6 text-muted-foreground">
            TCGWatch évolue chaque semaine. Les dernières nouveautés :
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NEWS.map((n) => (
              <li key={n.title} className="space-y-1.5 rounded-2xl border bg-card p-5">
                <p className="text-xs font-semibold text-muted-foreground">{n.tag}</p>
                <h3 className="font-semibold">{n.title}</h3>
                <p className="text-sm text-muted-foreground">{n.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Appli mobile. */}
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
          <div className="holo-frame grid items-center gap-8 rounded-3xl bg-card p-6 md:grid-cols-[minmax(0,1fr)_auto] md:p-10">
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-bold md:text-3xl">
                Une appli, sans passer par un store
              </h2>
              <p className="text-muted-foreground md:text-lg">
                Ajoute TCGWatch à l’écran d’accueil de ton iPhone ou Android : icône, plein écran,
                notifications. Gratuit, et à jour tout seul.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <InstallAppButton size="lg" variant="default" className="rounded-full" />
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link href="/installer">Comment faire</Link>
                </Button>
              </div>
            </div>
            <figure className="mx-auto hidden w-40 space-y-2 text-center md:block">
              <div
                className="rounded-2xl bg-white p-2.5 [&>svg]:h-auto [&>svg]:w-full"
                // QR code généré côté serveur à partir de l'adresse du site.
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <figcaption className="text-xs text-muted-foreground">
                À viser avec ton téléphone
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Appel final. */}
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center md:px-8">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Prêt pour le prochain drop ?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Crée ton compte en 30 secondes, ajoute les produits que tu vises et tes cartes, et
            laisse TCGWatch guetter pour toi.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link href={signUp}>{open ? 'Créer mon compte gratuit' : 'Se connecter'}</Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

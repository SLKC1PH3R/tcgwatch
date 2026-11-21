import {
  BellRing,
  ChartLine,
  Layers,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { BrandLogo } from '@/components/brand-logo';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { getCurrentUser, isRegistrationOpen } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'TCGWatch — stocks, prix et alertes Pokémon JCC en France',
  description:
    'Restocks des ETB, displays et coffrets Pokémon chez les boutiques françaises, prix comparés port compris, cote du marché, collection et alertes sur ton téléphone. Gratuit.',
};

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: BellRing,
    title: 'Alertes de restock',
    text: 'Un ETB revient en stock, une précommande ouvre, un prix passe sous ton seuil : tu es prévenu sur ton téléphone, à la minute.',
  },
  {
    icon: Store,
    title: 'Toutes les boutiques françaises',
    text: 'Des dizaines de boutiques spécialisées relevées en continu, les sites douteux écartés, et le prix comparé port compris.',
  },
  {
    icon: ChartLine,
    title: 'La cote du marché',
    text: 'Historique des prix, cote Cardmarket et médiane eBay : tu sais si c’est le bon moment pour acheter, ou pour revendre.',
  },
  {
    icon: Layers,
    title: 'Ta collection, valorisée',
    text: 'Scellé et cartes à l’unité, prix payé, plus-value latente et réalisée, classeurs par extension et export pour ta compta.',
  },
  {
    icon: ScanLine,
    title: 'Ajout rapide des cartes',
    text: 'Coche tes cartes extension par extension, ou scanne-les avec l’appareil photo.',
  },
  {
    icon: Smartphone,
    title: 'Sur ton téléphone',
    text: 'Installe TCGWatch sur l’écran d’accueil : notifications, collection consultable même hors ligne.',
  },
];

/** Page d'accueil publique : ce que fait le site, en chiffres réels, et l'inscription. */
export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/');
  const [retailers, products, cards, open] = await Promise.all([
    prisma.retailer.count({ where: { enabled: true, listings: { some: {} } } }),
    prisma.product.count({ where: { listings: { some: {} } } }),
    prisma.card.count(),
    isRegistrationOpen(),
  ]);
  const fr = new Intl.NumberFormat('fr-FR');
  const stats = [
    { value: fr.format(retailers), label: 'boutiques françaises suivies' },
    { value: fr.format(products), label: 'produits scellés comparés' },
    { value: fr.format(cards), label: 'cartes dans l’encyclopédie' },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-8">
        <BrandLogo />
        <nav className="flex items-center gap-2">
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
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:px-8 md:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" /> Gratuit · sans pub · fait en France
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
              Ne rate plus aucun{' '}
              <span className="bg-[linear-gradient(90deg,#ffd43b,#ff6b9a,#8b7cff,#4fd1ff)] bg-clip-text text-transparent">
                restock
              </span>{' '}
              Pokémon.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              TCGWatch surveille les boutiques françaises pour toi : stocks, prix port compris, cote
              du marché, sorties à venir. Et il garde ta collection à jour.
            </p>
            <div className="flex flex-wrap gap-3">
              {open && (
                <Button asChild size="lg" className="rounded-full">
                  <Link href="/inscription">Commencer gratuitement</Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link href="/connexion">J’ai déjà un compte</Link>
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
          <div className="relative mx-auto hidden h-96 w-[22rem] sm:block" aria-hidden>
            <div className="absolute top-10 left-0 h-72 w-52 -rotate-12 rounded-2xl bg-border p-1.5">
              <Image
                src="/cards/30e-anniversaire-b.webp"
                alt=""
                width={432}
                height={601}
                className="size-full rounded-xl object-cover"
              />
            </div>
            <div className="absolute top-10 right-0 h-72 w-52 rotate-12 rounded-2xl bg-border p-1.5">
              <Image
                src="/cards/30e-anniversaire-r.webp"
                alt=""
                width={432}
                height={601}
                className="size-full rounded-xl object-cover"
              />
            </div>
            <div className="holo-fill absolute top-2 left-[4.5rem] h-72 w-52 rounded-2xl p-1.5 shadow-[0_30px_80px_rgba(139,124,255,0.4)]">
              <Image
                src="/cards/30e-anniversaire-g.webp"
                alt=""
                width={432}
                height={601}
                priority
                className="size-full rounded-xl object-cover"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <h2 className="mb-6 font-display text-2xl font-bold md:text-3xl">
            Tout ce qu’il faut pour collectionner sereinement
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="space-y-2 rounded-2xl border bg-card p-5">
                <f.icon className="size-5 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <div className="holo-frame flex flex-col items-start gap-4 rounded-3xl bg-card p-6 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold">Prêt pour le prochain drop ?</h2>
              <p className="text-muted-foreground">
                Crée ton compte en 30 secondes, ajoute les produits que tu vises, et laisse TCGWatch
                guetter pour toi.
              </p>
            </div>
            {open && (
              <Button asChild size="lg" className="shrink-0 rounded-full">
                <Link href="/inscription">Créer mon compte</Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

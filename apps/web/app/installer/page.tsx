import { BellRing, EllipsisVertical, Monitor, Smartphone, WifiOff, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import QRCode from 'qrcode';
import { getEnv } from '@tcgwatch/shared/env';
import { BrandLogo } from '@/components/brand-logo';
import { InstallAppButton, IosSteps } from '@/components/install-app';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Installer l’appli TCGWatch',
  description:
    'TCGWatch sur votre téléphone, gratuitement et sans store : icône sur l’écran d’accueil, alertes de restock en notifications, collection hors ligne.',
};

const PERKS = [
  {
    icon: BellRing,
    title: 'Alertes en notifications',
    text: 'Restocks, précommandes, prix sous le seuil.',
  },
  {
    icon: Zap,
    title: 'Plein écran, ouverture instantanée',
    text: 'Une vraie icône, sans barre de navigateur.',
  },
  {
    icon: WifiOff,
    title: 'Collection hors ligne',
    text: 'Votre collection reste consultable sans réseau.',
  },
];

/** Guide d'installation de l'appli (PWA), à partager : QR code et gestes pour chaque appareil. */
export default async function InstallPage() {
  const url = `${getEnv().APP_URL.replace(/\/$/, '')}/installer`;
  const [qr, user] = await Promise.all([
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    getCurrentUser(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href={user ? '/' : '/bienvenue'} aria-label="TCGWatch">
            <BrandLogo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href={user ? '/' : '/connexion'}>
              {user ? 'Ouvrir TCGWatch' : 'Se connecter'}
            </Link>
          </Button>
        </header>

        <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Gratuit, sans store
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              TCGWatch sur votre téléphone
            </h1>
            <p className="max-w-xl text-muted-foreground">
              L’appli s’installe directement depuis le site, en quelques secondes, sur iPhone,
              Android ou ordinateur, et se met à jour automatiquement.
            </p>
            <InstallAppButton size="lg" variant="default" showWhenInstalled />
            <ul className="grid gap-3 pt-2 sm:grid-cols-3">
              {PERKS.map((p) => (
                <li key={p.title} className="space-y-1 rounded-xl border bg-card p-3">
                  <p.icon className="size-5 text-primary" />
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <figure className="mx-auto hidden w-56 space-y-2 text-center md:block">
            <div
              className="rounded-2xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              // QR code généré côté serveur à partir de l'adresse du site (aucune donnée tierce).
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <figcaption className="text-xs text-muted-foreground">
              Depuis un ordinateur : scannez ce code avec l’appareil photo du téléphone.
            </figcaption>
          </figure>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Smartphone className="size-5 text-primary" /> iPhone et iPad
            </h2>
            <p className="text-xs text-muted-foreground">Avec Safari (iOS 16.4 ou plus récent).</p>
            <IosSteps />
          </article>
          <article className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Smartphone className="size-5 text-primary" /> Android
            </h2>
            <p className="text-xs text-muted-foreground">Avec Chrome, Edge ou Samsung Internet.</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Appuyez sur le bouton « Installer l’appli » ci-dessus.</li>
              <li>
                Sinon, ouvrez le menu{' '}
                <EllipsisVertical className="inline size-4 align-text-bottom" /> puis{' '}
                <strong>Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »).
              </li>
              <li>Autorisez les notifications pour recevoir les alertes.</li>
            </ol>
          </article>
          <article className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Monitor className="size-5 text-primary" /> Ordinateur
            </h2>
            <p className="text-xs text-muted-foreground">Avec Chrome ou Edge.</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Cliquez sur l’icône d’installation, à droite de la barre d’adresse.</li>
              <li>
                Ou menu <strong>⋮</strong> puis <strong>Installer TCGWatch</strong> (Edge : «
                Applications »).
              </li>
              <li>TCGWatch s’ouvre dans sa propre fenêtre, épinglable à la barre des tâches.</li>
            </ol>
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

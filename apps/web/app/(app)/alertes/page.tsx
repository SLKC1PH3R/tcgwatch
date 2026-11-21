import { BellOff, Check, ExternalLink, MoonStar, Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma, type Prisma } from '@tcgwatch/db';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ALERT_STYLE, ALERT_TYPES, PRODUCT_ALERT_TYPES, ago, toClock } from '@/lib/alerts';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { getEnv } from '@tcgwatch/shared/env';
import { PushToggle } from '@/components/push-toggle';
import { requireUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  markAllSeenAction,
  saveAlertTypesAction,
  saveQuietHoursAction,
  setAlertSeenAction,
  setProductAlertMuteAction,
} from './actions';

export const metadata: Metadata = { title: 'Alertes' };

type Props = { searchParams: Promise<{ etat?: string; type?: string }> };

const PAGE_SIZE = 150;

export default async function AlertsPage({ searchParams }: Props) {
  const { etat, type: rawType } = await searchParams;
  const user = await requireUser();
  const vapidKey = getEnv().VAPID_PUBLIC_KEY;
  const unreadOnly = etat === 'non-vues';
  const type = ALERT_TYPES.find((t) => t === rawType);
  const where: Prisma.AlertEventWhereInput = {
    userId: user.id,
    ...(unreadOnly ? { acknowledged: false } : {}),
    ...(type ? { type } : {}),
  };

  const [alerts, total, unread, byType, settings, mutedProducts] = await Promise.all([
    prisma.alertEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        url: true,
        price: true,
        acknowledged: true,
        silent: true,
        muted: true,
        sentNtfy: true,
        sentTelegram: true,
        sentPush: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            follows: { where: { userId: user.id }, select: { mutedAlerts: true } },
          },
        },
        chaseCard: { select: { name: true, imageUrl: true } },
      },
    }),
    prisma.alertEvent.count({ where: { userId: user.id } }),
    prisma.alertEvent.count({ where: { userId: user.id, acknowledged: false } }),
    prisma.alertEvent.groupBy({
      by: ['type'],
      where: { userId: user.id, ...(unreadOnly ? { acknowledged: false } : {}) },
      _count: { _all: true },
    }),
    prisma.alertSettings.findUnique({ where: { userId: user.id } }),
    prisma.productFollow
      .findMany({
        where: { userId: user.id, NOT: { mutedAlerts: { isEmpty: true } } },
        select: {
          mutedAlerts: true,
          product: { select: { id: true, name: true, imageUrl: true } },
        },
        orderBy: { product: { name: 'asc' } },
      })
      .then((rows) => rows.map((r) => ({ ...r.product, mutedAlerts: r.mutedAlerts }))),
  ]);
  const typeCount = new Map(byType.map((t) => [t.type, t._count._all]));
  const mutedTypes = new Set(settings?.mutedTypes ?? []);
  const quietOn = settings?.quietStart != null && settings?.quietEnd != null;
  const shownCount = type ? (typeCount.get(type) ?? 0) : unreadOnly ? unread : total;

  const href = (patch: { etat?: string; type?: string }) => {
    const params = new URLSearchParams();
    const next = { etat, type, ...patch };
    if (next.etat) params.set('etat', next.etat);
    if (next.type) params.set('type', next.type);
    const qs = params.toString();
    return qs ? `/alertes?${qs}` : '/alertes';
  };

  return (
    <FitPage>
      <PageHeader
        title="Alertes"
        description="Tout ce que TCGWatch t’a envoyé sur ntfy et Telegram, avec ce que tu as déjà vu. Les réglages décident de ce qui part, et quand."
      />

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[minmax(13rem,1fr)_minmax(0,2.6fr)_minmax(18rem,1.4fr)] xl:grid-cols-[minmax(15rem,1fr)_minmax(0,3.2fr)_minmax(21rem,1.5fr)]',
        )}
      >
        {/* Filtres */}
        <Card className={cn(fitCard, 'px-5')}>
          <div className={cn('space-y-5', fitScroll)}>
            <section className="space-y-1">
              <h2 className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                État
              </h2>
              <FilterRow href={href({ etat: undefined })} on={!unreadOnly} count={total}>
                Toutes
              </FilterRow>
              <FilterRow href={href({ etat: 'non-vues' })} on={unreadOnly} count={unread}>
                Pas encore vues
              </FilterRow>
            </section>
            <section className="space-y-1">
              <h2 className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Type
              </h2>
              <FilterRow
                href={href({ type: undefined })}
                on={!type}
                count={[...typeCount.values()].reduce((s, n) => s + n, 0)}
              >
                Tous les types
              </FilterRow>
              {ALERT_TYPES.filter((t) => typeCount.has(t) || t === type).map((t) => (
                <FilterRow
                  key={t}
                  href={href({ type: t })}
                  on={t === type}
                  count={typeCount.get(t) ?? 0}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full bg-current',
                      ALERT_STYLE[t].className,
                    )}
                  />
                  {ALERT_STYLE[t].label}
                </FilterRow>
              ))}
            </section>
          </div>
        </Card>

        {/* Liste */}
        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>
              {type
                ? ALERT_STYLE[type].label
                : unreadOnly
                  ? 'Pas encore vues'
                  : 'Toutes les alertes'}{' '}
              <span className="text-sm font-normal text-muted-foreground">· {shownCount}</span>
            </CardTitle>
            {unread > 0 && (
              <form action={markAllSeenAction.bind(null, type)}>
                <Button type="submit" size="sm" variant="outline" className="rounded-full">
                  <Check /> Tout marquer comme vu
                </Button>
              </form>
            )}
          </CardHeader>
          <CardContent className={cn('px-3', fitScroll)}>
            {alerts.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {unreadOnly
                  ? 'Tout est vu. Rien de nouveau pour l’instant.'
                  : 'Aucune alerte pour l’instant.'}
              </p>
            ) : (
              <ul className="space-y-1.5 pb-3">
                {alerts.map((a) => {
                  const style = ALERT_STYLE[a.type];
                  const image = a.product?.imageUrl ?? a.chaseCard?.imageUrl ?? null;
                  const productMuted = a.product?.follows[0]?.mutedAlerts.includes(a.type) ?? false;
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        'flex gap-3 rounded-xl border p-3 transition-colors',
                        a.acknowledged ? 'border-transparent opacity-75' : 'bg-accent/40',
                      )}
                    >
                      <Thumb src={image} className="size-12" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          {!a.acknowledged && (
                            <span
                              className="size-2 rounded-full bg-primary"
                              aria-label="Pas encore vue"
                            />
                          )}
                          <span className={cn('font-semibold', style.className)}>
                            {style.label}
                          </span>
                          <span className="text-muted-foreground">{ago(a.createdAt)}</span>
                          {a.muted && (
                            <Badge variant="secondary">
                              <BellOff /> Coupée, non envoyée
                            </Badge>
                          )}
                          {a.silent && (
                            <Badge variant="secondary">
                              <MoonStar /> Envoyée sans son
                            </Badge>
                          )}
                          {!a.muted &&
                            !a.sentNtfy &&
                            !a.sentTelegram &&
                            !a.sentPush &&
                            a.type !== 'RELEASE_DATE' && (
                              <Badge variant="destructive">Pas envoyée</Badge>
                            )}
                        </p>
                        <p className="text-sm font-semibold">
                          {a.product ? (
                            <Link href={`/produits/${a.product.id}`} className="hover:underline">
                              {a.title}
                            </Link>
                          ) : (
                            a.title
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{a.message}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <form action={setAlertSeenAction.bind(null, a.id, !a.acknowledged)}>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full text-xs"
                            >
                              {a.acknowledged ? (
                                <>
                                  <Undo2 /> Marquer pas vue
                                </>
                              ) : (
                                <>
                                  <Check /> Vue
                                </>
                              )}
                            </Button>
                          </form>
                          {a.url && (
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-full text-xs"
                            >
                              <a href={a.url} target="_blank" rel="noopener noreferrer">
                                Ouvrir <ExternalLink />
                              </a>
                            </Button>
                          )}
                          {a.product && (
                            <form
                              action={setProductAlertMuteAction.bind(
                                null,
                                a.product.id,
                                a.type,
                                !productMuted,
                              )}
                            >
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                title={`${productMuted ? 'Réactiver' : 'Couper'} les alertes « ${style.label} » pour ce produit`}
                                className="h-7 rounded-full text-xs text-muted-foreground"
                              >
                                <BellOff />
                                {productMuted
                                  ? 'Réactiver pour ce produit'
                                  : 'Couper pour ce produit'}
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Réglages */}
        <div className={fitColumn}>
          <Card className={cn(fitCard, 'shrink-0')}>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <MoonStar className="size-4" /> Heures silencieuses
                </CardTitle>
                <CardDescription>
                  Les alertes arrivent quand même, mais sans son ni vibration (heure de Paris).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {vapidKey && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Notifications du navigateur</p>
                    <p className="text-xs text-muted-foreground">
                      Alertes sur cet appareil, même site fermé.
                    </p>
                  </div>
                  <PushToggle publicKey={vapidKey} />
                </div>
              )}
              <form action={saveQuietHoursAction} className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="actives" value="1" defaultChecked={quietOn} />
                  Activer
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  De
                  <input
                    type="time"
                    name="debut"
                    defaultValue={toClock(settings?.quietStart) || '22:00'}
                    className="h-9 rounded-md border border-input bg-transparent px-2"
                    aria-label="Début"
                  />
                  à
                  <input
                    type="time"
                    name="fin"
                    defaultValue={toClock(settings?.quietEnd) || '08:00'}
                    className="h-9 rounded-md border border-input bg-transparent px-2"
                    aria-label="Fin"
                  />
                  <Button type="submit" size="sm" className="ml-auto rounded-full">
                    Enregistrer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={fitCard}>
            <CardHeader className="shrink-0">
              <div className="space-y-1">
                <CardTitle>Ce qui est envoyé</CardTitle>
                <CardDescription>
                  Un type décoché reste visible ici, mais ne part plus sur ton téléphone.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn('space-y-5', fitScroll)}>
              <form action={saveAlertTypesAction} className="space-y-2">
                {ALERT_TYPES.map((t) => (
                  <label key={t} className="flex items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      name="type"
                      value={t}
                      defaultChecked={!mutedTypes.has(t)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className={cn('font-semibold', ALERT_STYLE[t].className)}>
                        {ALERT_STYLE[t].label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {ALERT_STYLE[t].hint}
                      </span>
                    </span>
                  </label>
                ))}
                <Button type="submit" size="sm" variant="outline" className="rounded-full">
                  Enregistrer
                </Button>
              </form>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Produits en sourdine · {mutedProducts.length}
                </h3>
                {mutedProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun. Coupe un type pour un produit depuis une alerte ou sa fiche.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {mutedProducts.map((p) => (
                      <li key={p.id} className="flex gap-2.5 py-2">
                        <Thumb src={p.imageUrl} className="size-9" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            href={`/produits/${p.id}`}
                            className="line-clamp-2 text-sm font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                          <div className="flex flex-wrap gap-1">
                            {p.mutedAlerts
                              .filter((t) => PRODUCT_ALERT_TYPES.includes(t))
                              .map((t) => (
                                <form
                                  key={t}
                                  action={setProductAlertMuteAction.bind(null, p.id, t, false)}
                                >
                                  <button
                                    type="submit"
                                    title="Réactiver"
                                    className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold text-muted-foreground hover:bg-accent"
                                  >
                                    {ALERT_STYLE[t].label} ×
                                  </button>
                                </form>
                              ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}

function FilterRow({
  href,
  on,
  count,
  children,
}: {
  href: string;
  on: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent',
        on && 'bg-accent font-semibold',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Link>
  );
}

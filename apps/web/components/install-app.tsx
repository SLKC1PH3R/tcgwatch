'use client';

import { Check, Download, Share, SquarePlus, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Invite d'installation de Chrome / Edge (Android, ordinateur), gardée dès qu'elle arrive. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

type Platform = 'ios' | 'android' | 'desktop';

function snapshot() {
  const standalone =
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  const platform: Platform =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'ios'
      : /Android/.test(ua)
        ? 'android'
        : 'desktop';
  return `${standalone ? 1 : 0}|${platform}|${deferred ? 1 : 0}`;
}

/** État d'installation : déjà installée, plateforme, invite du navigateur disponible. */
export function useInstallState() {
  const key = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const mq = window.matchMedia('(display-mode: standalone)');
      mq.addEventListener('change', cb);
      return () => {
        listeners.delete(cb);
        mq.removeEventListener('change', cb);
      };
    },
    snapshot,
    () => 'server',
  );
  if (key === 'server') return null;
  const [standalone, platform, prompt] = key.split('|');
  return {
    standalone: standalone === '1',
    platform: platform as Platform,
    canPrompt: prompt === '1',
  };
}

/** Les deux gestes d'installation sur iPhone et iPad (Apple ne permet pas de bouton direct). */
export function IosSteps({ className }: { className?: string }) {
  return (
    <ol className={cn('space-y-3 text-sm', className)}>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Share className="size-4" />
        </span>
        <span>
          Appuyez sur le bouton <strong>Partager</strong> de Safari (le carré avec une flèche, en
          bas de l’écran ou à côté de l’adresse).
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <SquarePlus className="size-4" />
        </span>
        <span>
          Choisissez <strong>Sur l’écran d’accueil</strong> (faites défiler la liste si besoin),
          puis <strong>Ajouter</strong>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Check className="size-4" />
        </span>
        <span>
          Ouvrez TCGWatch depuis sa nouvelle icône : les alertes peuvent alors arriver en
          notifications (iOS 16.4 ou plus récent).
        </span>
      </li>
    </ol>
  );
}

/**
 * Bouton « Installer l'appli » : lance l'installation du navigateur quand il le permet
 * (Android, Chrome ou Edge sur ordinateur), montre les gestes à faire sur iPhone, et renvoie
 * vers le guide ailleurs. Invisible une fois l'appli installée.
 */
export function InstallAppButton({
  className,
  size = 'sm',
  variant = 'outline',
  label = 'Installer l’appli',
  showWhenInstalled = false,
}: {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'outline' | 'default' | 'secondary' | 'ghost';
  label?: string;
  showWhenInstalled?: boolean;
}) {
  const state = useInstallState();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  if (state.standalone) {
    return showWhenInstalled ? (
      <p className={cn('inline-flex items-center gap-2 text-sm text-success', className)}>
        <Check className="size-4" /> L’appli est installée sur cet appareil.
      </p>
    ) : null;
  }

  if (state.canPrompt) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={busy}
        onClick={async () => {
          if (!deferred) return;
          setBusy(true);
          await deferred.prompt();
          await deferred.userChoice.catch(() => undefined);
          deferred = null;
          setBusy(false);
          notify();
        }}
      >
        <Download /> {label}
      </Button>
    );
  }

  if (state.platform === 'ios') {
    return (
      <>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          onClick={() => dialog.current?.showModal()}
        >
          <Download /> {label}
        </Button>
        <dialog
          ref={dialog}
          aria-label="Installer TCGWatch"
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
          className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Installer sur l’iPhone</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => dialog.current?.close()}
                aria-label="Fermer"
                className="-mt-1 -mr-2 size-8"
              >
                <X />
              </Button>
            </div>
            <IosSteps />
          </div>
        </dialog>
      </>
    );
  }

  // Navigateur sans invite (Firefox, Safari sur Mac…) : le guide détaille la marche à suivre.
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href="/installer">
        <Download /> {label}
      </Link>
    </Button>
  );
}

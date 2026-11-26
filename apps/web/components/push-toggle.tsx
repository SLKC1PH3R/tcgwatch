'use client';

import { BellRing, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

const toKey = (base64: string) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Active / coupe les notifications du navigateur sur cet appareil. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async (): Promise<State> => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const reg = await navigator.serviceWorker.ready;
      return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
    };
    check()
      .catch((): State => 'off')
      .then(setState);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKey(publicKey),
      });
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? 'on' : 'off');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;
  if (state === 'unsupported') {
    return (
      <p className="text-xs text-muted-foreground">
        Ce navigateur ne gère pas les notifications. Sur iPhone : ajoutez d’abord TCGWatch à l’écran
        d’accueil (Partager › Sur l’écran d’accueil).
      </p>
    );
  }
  if (state === 'denied') {
    return (
      <p className="text-xs text-muted-foreground">
        Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur.
      </p>
    );
  }
  return state === 'on' ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-full"
      onClick={disable}
      disabled={busy}
    >
      <BellOff /> Couper sur cet appareil
    </Button>
  ) : (
    <Button type="button" size="sm" className="rounded-full" onClick={enable} disabled={busy}>
      <BellRing /> Activer sur cet appareil
    </Button>
  );
}

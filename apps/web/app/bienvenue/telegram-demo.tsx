'use client';

import { useEffect, useState } from 'react';
import s from './landing.module.css';

export interface DemoAlert {
  kind: 'stock' | 'preorder' | 'price';
  product: string;
  shop: string;
  price: string;
}

const TITLES: Record<DemoAlert['kind'], string> = {
  stock: 'Retour en stock',
  preorder: 'Précommande ouverte',
  price: 'Prix cible atteint',
};

const STEP = 3200;
const TYPING = 900;

function Bubble({ alert, time }: { alert: DemoAlert; time: string }) {
  return (
    <div className={s.tgBubble}>
      <p className={s.tgTitle}>
        <span className={s.tgIcon} data-kind={alert.kind} aria-hidden>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
            {alert.kind === 'price' ? (
              <path d="M8 3v10M5 6.5h4.5a1.75 1.75 0 0 1 0 3.5H6.5a1.75 1.75 0 0 0 0 3.5H11" />
            ) : alert.kind === 'preorder' ? (
              <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
            ) : (
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
        {TITLES[alert.kind]} : {alert.product}
      </p>
      <p>
        {alert.shop} — {alert.price}
      </p>
      <p className={s.tgLink}>Voir la fiche</p>
      <span className={s.tgTime}>{time}</span>
    </div>
  );
}

/**
 * Démonstration animée des alertes : le bot Telegram écrit, le message arrive dans la
 * conversation et une notification glisse en haut de l'écran. Immobile (deux messages) si
 * l'utilisateur réduit les animations.
 */
export function TelegramDemo({ alerts }: { alerts: DemoAlert[] }) {
  const [step, setStep] = useState(1);
  const [typing, setTyping] = useState(false);
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t1 = 0;
    let t2 = 0;
    const tick = () => {
      setTyping(true);
      t1 = window.setTimeout(() => {
        setTyping(false);
        setStep((n) => n + 1);
        setNotify(true);
        t2 = window.setTimeout(() => setNotify(false), 1800);
      }, TYPING);
    };
    const id = window.setInterval(tick, STEP);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const at = (n: number) => alerts[((n % alerts.length) + alerts.length) % alerts.length]!;
  const latest = at(step);
  // Les deux derniers messages ; la clé change à chaque arrivée pour rejouer l'animation.
  const shown = [step - 1, step];

  return (
    <div className={s.tg} aria-hidden>
      <div className={s.tgNotif} data-show={notify}>
        <span className={s.tgAvatar}>TW</span>
        <div>
          <b>TCGWatch Bot</b>
          <span>
            {TITLES[latest.kind]} : {latest.product}
          </span>
        </div>
        <small>maintenant</small>
      </div>
      <div className={s.tgBar}>
        <span className={s.tgAvatar}>TW</span>
        <div>
          <b>TCGWatch Bot</b>
          <span>{typing ? 'écrit…' : 'bot'}</span>
        </div>
      </div>
      <div className={s.tgBody}>
        {shown.map((n) => (
          <div key={n} className={s.tgIn}>
            <Bubble alert={at(n)} time={n === step ? 'à l’instant' : 'il y a 3 min'} />
          </div>
        ))}
        {typing && (
          <div className={s.tgTyping}>
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
    </div>
  );
}

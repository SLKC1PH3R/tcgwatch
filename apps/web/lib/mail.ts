import 'server-only';
import { getEnv } from '@tcgwatch/shared/env';

export interface Mail {
  to: string;
  subject: string;
  /** Paragraphes du message ; le lien d'action est ajouté sous forme de bouton. */
  lines: string[];
  action?: { label: string; url: string };
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Gabarit sobre, lisible sans images (clients mail stricts). */
export function renderMail(m: Mail): { html: string; text: string } {
  const button = m.action
    ? `<p style="margin:28px 0"><a href="${escape(m.action.url)}" style="background:#ffd43b;color:#14151f;padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none;display:inline-block">${escape(m.action.label)}</a></p><p style="color:#7d8098;font-size:13px">Ou copie ce lien : ${escape(m.action.url)}</p>`
    : '';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f6fb;font-family:Arial,Helvetica,sans-serif;color:#14151f"><div style="max-width:520px;margin:0 auto;padding:32px 24px"><p style="font-weight:800;font-size:18px;margin:0 0 24px">TCG WATCH</p>${m.lines.map((l) => `<p style="font-size:15px;line-height:1.5">${escape(l)}</p>`).join('')}${button}<p style="color:#7d8098;font-size:12px;margin-top:32px">Tu reçois ce message suite à une action sur TCGWatch. Si ce n’est pas toi, ignore-le.</p></div></body></html>`;
  const text = [...m.lines, ...(m.action ? ['', `${m.action.label} : ${m.action.url}`] : [])].join(
    '\n',
  );
  return { html, text };
}

/**
 * Envoie un e-mail via l'API Resend. Sans clé configurée, le message est écrit dans les logs
 * (développement) et l'envoi est considéré comme raté.
 */
export async function sendMail(m: Mail): Promise<boolean> {
  const env = getEnv();
  const { html, text } = renderMail(m);
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[mail] RESEND_API_KEY absente, e-mail non envoyé à ${m.to} : ${m.subject}\n${text}`,
    );
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, html, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[mail] Resend ${res.status} : ${await res.text()}`);
    return res.ok;
  } catch (err) {
    console.error('[mail] envoi impossible', err);
    return false;
  }
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getEnv } from '@tcgwatch/shared/env';
import { PublicPage } from '@/components/public-page';

export const metadata: Metadata = { title: 'Confidentialité et données personnelles' };

export default function PrivacyPage() {
  const contact = getEnv().CONTACT_EMAIL;
  return (
    <PublicPage title="Confidentialité" updated="21 novembre 2026">
      <p>
        TCGWatch collecte le minimum nécessaire pour faire fonctionner ton compte. Aucune donnée
        n’est vendue ni utilisée pour de la publicité.
      </p>
      <h2>Données traitées</h2>
      <table>
        <thead>
          <tr>
            <th>Données</th>
            <th>Pourquoi</th>
            <th>Base légale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Adresse e-mail, nom (facultatif), mot de passe chiffré ou identifiant Google</td>
            <td>Créer le compte, te connecter, récupérer l’accès</td>
            <td>Exécution du service</td>
          </tr>
          <tr>
            <td>Collection, produits suivis, bons prix, vitrines, réglages d’alertes</td>
            <td>Les fonctions que tu utilises</td>
            <td>Exécution du service</td>
          </tr>
          <tr>
            <td>Abonnements aux notifications (par appareil)</td>
            <td>T’envoyer les alertes que tu as demandées</td>
            <td>Consentement (révocable à tout moment)</td>
          </tr>
          <tr>
            <td>Sessions (navigateur, date)</td>
            <td>Sécurité du compte</td>
            <td>Intérêt légitime</td>
          </tr>
        </tbody>
      </table>
      <h2>Cookies</h2>
      <p>
        Uniquement des cookies nécessaires : session de connexion, choix du thème, et état
        temporaire de la connexion Google. Aucun cookie publicitaire ni de mesure d’audience tierce.
      </p>
      <h2>Sous-traitants</h2>
      <ul>
        <li>Hostinger (hébergement, France).</li>
        <li>Resend (envoi des e-mails de confirmation et de mot de passe).</li>
        <li>Google, si tu choisis de te connecter avec Google.</li>
        <li>
          Le service de notifications de ton navigateur (Google, Apple, Mozilla) pour les alertes.
        </li>
      </ul>
      <h2>Durée de conservation</h2>
      <p>
        Tant que ton compte existe. À la suppression du compte, toutes tes données sont effacées
        immédiatement (les sauvegardes sont écrasées sous 30 jours).
      </p>
      <h2>Tes droits</h2>
      <p>
        Accès, rectification, effacement, portabilité, opposition : depuis{' '}
        <Link href="/compte">Mon compte</Link> (export JSON et suppression en un clic), ou en
        écrivant à <a href={`mailto:${contact}`}>{contact}</a>. Tu peux aussi saisir la CNIL
        (cnil.fr).
      </p>
    </PublicPage>
  );
}

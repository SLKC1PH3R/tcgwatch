import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-page';

export const metadata: Metadata = { title: 'Conditions générales d’utilisation' };

export default function TermsPage() {
  return (
    <PublicPage title="Conditions générales d’utilisation" updated="21 novembre 2026">
      <h2>1. Objet</h2>
      <p>
        TCGWatch est un service gratuit d’information sur les produits du jeu de cartes Pokémon :
        disponibilité et prix chez des boutiques en ligne, cote du marché secondaire, calendrier des
        sorties, et outils de suivi de collection. Créer un compte vaut acceptation des présentes
        conditions.
      </p>
      <h2>2. Compte</h2>
      <ul>
        <li>
          Un compte est personnel ; vous êtes responsable de la confidentialité de votre mot de
          passe.
        </li>
        <li>
          Les informations fournies doivent être exactes ; l’adresse e-mail doit être la tienne.
        </li>
        <li>
          Vous pouvez exporter vos données ou supprimer votre compte à tout moment depuis la page{' '}
          <Link href="/compte">Mon compte</Link>.
        </li>
      </ul>
      <h2>3. Informations affichées</h2>
      <p>
        Les prix, stocks, cotes et dates sont collectés automatiquement et fournis « en l’état »,
        sans garantie d’exactitude ni d’exhaustivité. TCGWatch ne vend rien : tout achat se fait sur
        le site du vendeur, selon ses conditions. Une erreur peut être signalée depuis la fiche
        concernée.
      </p>
      <h2>4. Alertes</h2>
      <p>
        Les alertes (navigateur, e-mail) sont envoyées au mieux, sans garantie de délai ni de
        livraison. Vous pouvez les régler ou les couper à tout moment.
      </p>
      <h2>5. Usage acceptable</h2>
      <ul>
        <li>Pas d’accès automatisé massif au site (robots, extraction de données).</li>
        <li>
          Pas de contenu illicite, trompeur ou injurieux dans les vitrines, listes ou signalements.
        </li>
        <li>Pas de tentative de contournement de la sécurité ou d’accès aux données d’autrui.</li>
      </ul>
      <p>Un compte qui ne respecte pas ces règles peut être suspendu ou supprimé.</p>
      <h2>6. Responsabilité</h2>
      <p>
        TCGWatch ne saurait être tenu responsable d’une décision d’achat ou de vente prise sur la
        base des informations affichées, ni d’une indisponibilité du service.
      </p>
      <h2>7. Évolution</h2>
      <p>
        Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de page. Elles sont
        régies par le droit français.
      </p>
    </PublicPage>
  );
}

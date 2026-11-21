import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { getEnv } from '@tcgwatch/shared/env';
import { PublicPage } from '@/components/public-page';

export const metadata: Metadata = {
  title: 'Méthode : d’où viennent les prix',
  description:
    'Sources, fréquence des relevés et calculs de TCGWatch : meilleur prix port compris, cote Cardmarket, médiane eBay, indice du marché.',
};

/** Méthode publique : sources, fréquences, calculs. Chiffres en direct depuis la base. */
export default async function MethodPage() {
  const [retailers, listings, products] = await Promise.all([
    prisma.retailer.count({ where: { enabled: true, listings: { some: {} } } }),
    prisma.listing.count({ where: { state: { not: 'PAUSED' } } }),
    prisma.product.count({ where: { listings: { some: {} } } }),
  ]);
  const interval = getEnv().DEFAULT_CHECK_INTERVAL_MIN;
  const fr = new Intl.NumberFormat('fr-FR');
  return (
    <PublicPage
      title="Méthode"
      intro="D’où viennent les chiffres de TCGWatch, à quelle fréquence ils sont relevés, et comment ils sont calculés."
      updated="21 novembre 2026"
    >
      <h2>Prix et stocks des boutiques</h2>
      <ul>
        <li>
          <b>{fr.format(listings)}</b> fiches produit suivies chez <b>{fr.format(retailers)}</b>{' '}
          boutiques françaises, pour {fr.format(products)} produits scellés.
        </li>
        <li>
          Chaque fiche est relevée environ toutes les {interval} minutes (plus souvent autour des
          sorties), directement sur la page du produit : prix, disponibilité, précommande.
        </li>
        <li>
          Les sites signalés comme douteux sont écartés ; les grandes plateformes (Amazon,
          Cdiscount, Fnac) ne sont pas lues directement, leurs conditions l’interdisant.
        </li>
        <li>
          Chaque prix affiche la boutique et l’heure du dernier relevé. En cas de doute, seul le
          site du vendeur fait foi.
        </li>
      </ul>

      <h2>Meilleur prix</h2>
      <p>
        Le prix le plus bas parmi les offres achetables (en stock ou en précommande),{' '}
        <b>port compris</b> quand les frais de livraison de la boutique sont connus (colis standard,
        France métropolitaine, seuil de port offert pris en compte). Sinon, le prix de l’article
        seul, signalé « hors port ».
      </p>

      <h2>Historique des prix</h2>
      <p>
        Un résumé par jour et par fiche (dernier prix, plus bas prix achetable). Un prix aberrant,
        très éloigné des jours voisins, est mis de côté automatiquement pour ne pas fausser la
        courbe.
      </p>

      <h2>Cote du marché</h2>
      <ul>
        <li>
          <b>Scellé</b> : guide des prix officiel de Cardmarket, publié chaque jour, relié aux
          produits par leur identifiant Cardmarket (avec des contrôles de cohérence : format, année,
          date de sortie).
        </li>
        <li>
          <b>Cartes</b> : tendance Cardmarket du jour, via TCGdex (toutes langues et états
          confondus).
        </li>
        <li>
          <b>Occasion (eBay)</b> : chaque jour, médiane des annonces neuves en achat immédiat, port
          compris, via l’API officielle d’eBay. Les annonces hors de la fourchette « moitié – double
          » de la médiane (lots, boîtes vides, erreurs) sont écartées ; il faut au moins 3 annonces.
        </li>
      </ul>

      <h2>Indice du marché</h2>
      <p>
        Variation sur 30 jours, à périmètre constant : pour le scellé, cote du jour face à celle
        d’il y a 30 jours pour les mêmes produits ; pour les cartes, cote du jour face à la moyenne
        des 30 derniers jours. La valeur d’une extension est la somme des cotes de ses cartes.
      </p>

      <h2>Alertes</h2>
      <p>
        Une alerte part dès qu’un relevé constate le changement (retour en stock, ouverture des
        précommandes, prix sous ton bon prix, plus bas historique). Une même alerte n’est pas
        renvoyée avant 6 heures.
      </p>

      <h2>Une erreur ?</h2>
      <p>
        Chaque fiche a un bouton « Signaler une erreur » : prix faux, stock faux ou produit mal
        rattaché (une boîte de rangement prise pour un coffret, par exemple). Les signalements sont
        vérifiés et corrigés à la main. Voir aussi les <Link href="/guides">guides</Link>.
      </p>
    </PublicPage>
  );
}

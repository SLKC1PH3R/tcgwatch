import type { Metadata } from 'next';
import { getEnv } from '@tcgwatch/shared/env';
import { PublicPage } from '@/components/public-page';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function LegalNoticePage() {
  const contact = getEnv().CONTACT_EMAIL;
  return (
    <PublicPage title="Mentions légales" updated="21 novembre 2026">
      <h2>Éditeur</h2>
      <p>
        TCGWatch est un site non commercial édité par un particulier. Conformément à l’article
        6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique,
        l’identité de l’éditeur a été communiquée à l’hébergeur.
      </p>
      <p>
        Contact : <a href={`mailto:${contact}`}>{contact}</a>
      </p>
      <h2>Hébergement</h2>
      <p>
        Hostinger International Ltd, 61 Lordou Vironos Street, 6023 Larnaca, Chypre —{' '}
        <a href="https://www.hostinger.fr" target="_blank" rel="noopener noreferrer">
          hostinger.fr
        </a>
        . Serveur situé en France.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Pokémon et les noms, images et logos associés sont des marques de Nintendo, Creatures Inc.,
        GAME FREAK inc. et The Pokémon Company. TCGWatch n’est ni affilié ni approuvé par ces
        sociétés. Les images de produits et de cartes appartiennent à leurs ayants droit et sont
        reproduites à titre d’information.
      </p>
      <p>
        Les prix, stocks et liens sont relevés automatiquement sur les sites des boutiques et des
        places de marché ; ils peuvent comporter des erreurs ou des décalages. Seul le site du
        vendeur fait foi au moment de l’achat.
      </p>
      <h2>Liens</h2>
      <p>
        TCGWatch renvoie vers des sites tiers dont il ne contrôle ni le contenu ni les conditions de
        vente. Certains liens peuvent être des liens affiliés : ils ne changent pas le prix payé.
      </p>
    </PublicPage>
  );
}

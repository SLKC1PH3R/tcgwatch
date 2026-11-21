import Link from 'next/link';

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  body: React.ReactNode;
}

/** Guides en français : sujets qui reviennent chez les collectionneurs. */
export const GUIDES: Guide[] = [
  {
    slug: 'reperer-les-faux',
    title: 'Repérer les faux (cartes et scellé)',
    summary:
      'Les signes qui doivent alerter sur une carte, un booster ou un coffret, et les bons réflexes avant d’acheter.',
    body: (
      <>
        <p>
          Les contrefaçons visent surtout les cartes chères et le scellé recherché (ETB, displays,
          coffrets en rupture). Aucun signe isolé ne suffit : c’est l’accumulation qui doit alerter.
        </p>
        <h2>Sur une carte</h2>
        <ul>
          <li>
            <b>Le prix</b> : une carte rare vendue bien sous sa cote est le premier signal.
          </li>
          <li>
            <b>L’impression</b> : couleurs délavées ou trop saturées, textes flous, police qui ne
            ressemble pas à celle des cartes officielles, symboles d’énergie mal dessinés.
          </li>
          <li>
            <b>Le dos</b> : bleu trop clair ou trop violet, tourbillon mal centré, bords
            irréguliers.
          </li>
          <li>
            <b>La matière</b> : carton trop fin, trop brillant ou trop souple ; une vraie carte a
            une couche noire visible sur la tranche (comparer avec une carte commune authentique).
          </li>
          <li>
            <b>L’effet holo</b> : un brillant uniforme « plaqué » au lieu du motif propre à la
            rareté et à l’extension.
          </li>
          <li>
            <b>La loupe</b> : une impression officielle montre une trame de points régulière ; les
            faux sont souvent pixelisés.
          </li>
        </ul>
        <h2>Sur le scellé</h2>
        <ul>
          <li>
            <b>Le film</b> : un film plastique lâche, froissé, ou des soudures irrégulières laissent
            penser à un « re-scellé ».
          </li>
          <li>
            <b>Les boosters</b> : soudures de travers, couleurs différentes entre boosters d’une
            même boîte, booster qui s’ouvre trop facilement.
          </li>
          <li>
            <b>Le vendeur</b> : préférer les boutiques reconnues. TCGWatch écarte les sites signalés
            comme douteux et indique ceux vérifiés par PokéScam sur la page{' '}
            <Link href="/revendeurs">Revendeurs</Link>.
          </li>
        </ul>
        <h2>Les bons réflexes</h2>
        <ul>
          <li>Comparer avec une carte ou un produit authentique de la même extension.</li>
          <li>
            Demander des photos nettes (recto, verso, tranche, film) avant un achat entre
            particuliers.
          </li>
          <li>Payer avec un moyen qui protège l’acheteur, jamais en virement entre amis.</li>
          <li>Pour une carte de valeur, envisager une carte gradée par un organisme reconnu.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'scelle-ou-cartes',
    title: 'Scellé ou cartes à l’unité ?',
    summary:
      'Ouvrir pour le plaisir, garder fermé pour la valeur, ou acheter directement la carte voulue : ce qu’il faut savoir.',
    body: (
      <>
        <p>
          Deux façons de collectionner, qui ne répondent pas aux mêmes envies. Les deux se suivent
          dans TCGWatch : la collection de scellé et la collection de cartes.
        </p>
        <h2>Le scellé (ETB, displays, coffrets)</h2>
        <ul>
          <li>
            <b>Pour</b> : objet fini, facile à stocker et à revendre ; les produits épuisés prennent
            souvent de la valeur avec le temps, surtout les displays.
          </li>
          <li>
            <b>Contre</b> : immobilise de l’argent et de la place ; la hausse n’est jamais garantie
            (réimpressions, extensions surproduites) ; l’état du film compte.
          </li>
          <li>
            <b>Astuce</b> : suis un produit avec un bon prix dans « Mes produits » ; la courbe et la
            cote du marché montrent s’il s’échange au-dessus ou au-dessous du prix conseillé.
          </li>
        </ul>
        <h2>Les cartes à l’unité</h2>
        <ul>
          <li>
            <b>Pour</b> : c’est presque toujours moins cher d’acheter la carte voulue que d’ouvrir
            des boosters pour la tirer.
          </li>
          <li>
            <b>Contre</b> : la valeur dépend beaucoup de l’état (centrage, bords, rayures) ; la cote
            d’une carte peut chuter vite après une réimpression.
          </li>
        </ul>
        <h2>Ouvrir des boosters</h2>
        <p>
          C’est le plaisir du jeu, pas un placement : en moyenne, la valeur des cartes tirées est
          inférieure au prix payé. Le calculateur de{' '}
          <Link href="/calculateurs/rentabilite">rentabilité</Link> estime ce que rapporte
          l’ouverture d’une display d’une extension donnée.
        </p>
      </>
    ),
  },
  {
    slug: 'francais-ou-japonais',
    title: 'Français ou japonais ?',
    summary:
      'Calendrier, contenu des boosters, prix, qualité d’impression : les différences entre les éditions FR et JP.',
    body: (
      <>
        <p>
          Les extensions sortent d’abord au Japon, puis sont adaptées pour le reste du monde. Les
          deux éditions coexistent et n’intéressent pas les mêmes collectionneurs.
        </p>
        <table>
          <thead>
            <tr>
              <th />
              <th>Édition française</th>
              <th>Édition japonaise</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Calendrier</td>
              <td>Quelques mois après le Japon</td>
              <td>En premier</td>
            </tr>
            <tr>
              <td>Extensions</td>
              <td>Souvent plusieurs séries japonaises regroupées en une</td>
              <td>Extensions plus petites et plus fréquentes</td>
            </tr>
            <tr>
              <td>Boosters</td>
              <td>10 cartes</td>
              <td>Généralement 5 cartes, moins chers</td>
            </tr>
            <tr>
              <td>Où acheter</td>
              <td>Boutiques françaises (suivies par TCGWatch)</td>
              <td>Import : boutiques spécialisées, frais et délais en plus</td>
            </tr>
            <tr>
              <td>Pour qui</td>
              <td>Jouer en tournoi en France, collection « locale »</td>
              <td>Illustrations, qualité d’impression réputée, gradation</td>
            </tr>
          </tbody>
        </table>
        <h2>Bon à savoir</h2>
        <ul>
          <li>
            Les cartes japonaises sont légales en tournoi uniquement au Japon ; en France, on joue
            avec les cartes des éditions internationales.
          </li>
          <li>
            Une carte n’a pas la même cote selon la langue : compare toujours la cote de la bonne
            édition avant d’acheter ou de vendre.
          </li>
          <li>
            Les dates des sorties françaises sont dans le <Link href="/calendrier">calendrier</Link>
            , avec les produits de chaque extension.
          </li>
        </ul>
      </>
    ),
  },
];

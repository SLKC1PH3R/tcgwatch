import { expect, test } from './fixtures';

/** Pages « plein écran » : sur un grand écran, la page entière tient sans défiler. */
const FIT_PAGES = [
  '/',
  '/calendrier',
  '/produits',
  '/produits/mes-produits',
  '/produits/bons-plans',
  '/retours-en-stock',
  '/alertes',
  '/produits/prix',
  '/marche',
  '/marche/indice',
  '/series',
  '/cartes',
  '/collection',
  '/collection/cartes',
  '/collection/cartes/manquantes',
  '/collection/cartes/achats',
  '/collection/ouvertures',
  '/collection/bilan',
  '/collection/cartes/import',
  '/sources',
  '/revendeurs',
  '/revendeurs/etat',
  '/calculateurs/budget',
  '/calculateurs/rentabilite',
];

const pageMetrics = () => ({
  scroll: document.scrollingElement!.scrollHeight - window.innerHeight,
  overflowX: document.scrollingElement!.scrollWidth - window.innerWidth,
});

test.describe('plein écran (1440 × 900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const path of FIT_PAGES) {
    test(`${path} tient sans défilement`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), 'réponse HTTP').toBeLessThan(400);
      await expect(page.locator('[data-fit-screen]')).toBeVisible();
      const m = await page.evaluate(pageMetrics);
      expect(m.scroll, 'défilement vertical de la page').toBeLessThanOrEqual(1);
      expect(m.overflowX, 'débordement horizontal').toBeLessThanOrEqual(1);
    });
  }
});

test.describe('mobile (390 × 844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of FIT_PAGES) {
    test(`${path} sans débordement horizontal`, async ({ page }) => {
      await page.goto(path);
      const m = await page.evaluate(pageMetrics);
      expect(m.overflowX, 'débordement horizontal').toBeLessThanOrEqual(1);
    });
  }
});

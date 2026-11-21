import { test as base, expect } from '@playwright/test';
import { OTHER_SESSION_TOKEN, PRODUCT_ID } from './fixtures';

/** Simple utilisateur : ne voit ni la collection ni les alertes de l'administrateur. */
const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await context.addCookies([
      { name: 'tcgwatch_session', value: OTHER_SESSION_TOKEN, url: baseURL! },
    ]);
    await provide(context);
  },
});

test.use({ viewport: { width: 1440, height: 900 } });

test('la collection et les alertes sont propres à chaque compte', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.getByRole('row', { name: /Display E2E Test/ })).toHaveCount(0);
  await page.goto('/alertes');
  await expect(page.getByText('Display E2E Test (36)')).toHaveCount(0);
  // La fiche produit reste visible (catalogue commun), sans les contrôles d'admin.
  const res = await page.goto(`/produits/${PRODUCT_ID}`);
  expect(res?.status()).toBe(200);
});

test('les pages d’administration renvoient 404', async ({ page }) => {
  const res = await page.goto('/revendeurs/etat');
  expect(res?.status()).toBe(404);
});

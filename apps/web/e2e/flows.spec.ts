import { expect, PRODUCT_ID, test } from './fixtures';

test.use({ viewport: { width: 1440, height: 900 } });

test('vendre une partie d’une ligne de la collection', async ({ page }) => {
  await page.goto('/collection?tri=nom');
  const row = page.getByRole('row', { name: /Display E2E Test/ });
  await row.getByRole('button', { name: /Vendre/ }).click();
  const dialog = page.getByRole('dialog', { name: /Vendre/ });
  await dialog.getByLabel('Quantité vendue').fill('1');
  await dialog.getByLabel('Prix de vente (u., €)').fill('260');
  await dialog.getByLabel('Frais (€, total)').fill('13');
  await dialog.getByLabel('Vendu sur').fill('Cardmarket');
  await dialog.getByRole('button', { name: 'Enregistrer la vente' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: /Vendus/ }).click();
  const sold = page.getByRole('row', { name: /Display E2E Test/ });
  // 260 − 13 − 199 = +48,00 €
  await expect(sold).toContainText('48,00');
  await expect(sold).toContainText('Cardmarket');
});

test('marquer une alerte comme vue', async ({ page }) => {
  await page.goto('/alertes?etat=non-vues');
  const alert = page.getByRole('listitem').filter({ hasText: 'Display E2E Test (36)' });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Vue' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Display E2E Test (36)' })).toHaveCount(
    0,
  );
});

test('couper un type d’alerte depuis la fiche produit', async ({ page }) => {
  await page.goto(`/produits/${PRODUCT_ID}`);
  const toggle = page.getByRole('button', { name: 'Retour en stock', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Retour en stock', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // Remise en état pour le passage suivant.
  await page.getByRole('button', { name: 'Retour en stock', exact: true }).click();
});

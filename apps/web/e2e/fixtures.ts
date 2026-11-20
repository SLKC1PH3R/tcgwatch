import { test as base, expect } from '@playwright/test';

/** Jeton de session du compte de test (créé par global-setup.ts). */
export const SESSION_TOKEN = 'e2e-session-token-0123456789';
export const PRODUCT_ID = 'e2e-product-display';
export const ITEM_ID = 'e2e-collection-item';

/** Pages connectées : le cookie de session est posé avant chaque test. */
export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await context.addCookies([{ name: 'tcgwatch_session', value: SESSION_TOKEN, url: baseURL! }]);
    await provide(context);
  },
});

export { expect };

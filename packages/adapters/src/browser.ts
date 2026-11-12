import type { Browser } from 'playwright';
import type { BrowserRenderer } from './fetcher';

/**
 * Rendu via Chromium headless (Playwright), instance unique réutilisée.
 * Importé dynamiquement : l'app web n'embarque pas Playwright.
 */
export class PlaywrightRenderer implements BrowserRenderer {
  private browser: Promise<Browser> | undefined;

  private async getBrowser(): Promise<Browser> {
    this.browser ??= import('playwright').then(({ chromium }) =>
      chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] }),
    );
    return this.browser;
  }

  async render(url: string, { userAgent, timeoutMs }: { userAgent: string; timeoutMs: number }) {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      viewport: { width: 1366, height: 900 },
    });
    try {
      const page = await context.newPage();
      // Pas d'images, polices ni médias : moins de charge pour le site et pour le VPS.
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        return ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page
        .waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 10_000) })
        .catch(() => undefined);
      return await page.content();
    } finally {
      await context.close();
    }
  }

  async close() {
    if (this.browser) {
      const b = await this.browser.catch(() => undefined);
      this.browser = undefined;
      await b?.close();
    }
  }
}

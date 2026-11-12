import { load } from 'cheerio';

/**
 * Élague une page HTML pour en faire une fixture légère et lisible :
 * conserve le JSON-LD, les métadonnées et le contenu, supprime scripts, styles, SVG,
 * navigation et pied de page.
 */
export function trimHtml(html: string, options: { stripClasses?: boolean } = {}): string {
  const $ = load(html);
  $('script').not('[type="application/ld+json"]').remove();
  $('style, svg, noscript, link, iframe, template, header, footer, nav').remove();
  $('meta')
    .not('[property^="og:"], [property^="product:"], [charset], [name="description"]')
    .remove();
  $('*')
    .contents()
    .filter((_, el) => el.type === 'comment')
    .remove();
  $('[style]').removeAttr('style');
  if (options.stripClasses) $('[class]').removeAttr('class');
  $('img').each((_, el) => {
    const img = $(el);
    for (const attr of ['srcset', 'sizes', 'data-srcset', 'loading', 'decoding'])
      img.removeAttr(attr);
  });
  return `<!doctype html>\n${$.html()
    .replace(/\n\s*\n+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')}\n`;
}

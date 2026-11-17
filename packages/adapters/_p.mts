import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { parsePhilibert } from './src/adapters/philibert';
const html = readFileSync(process.argv[2], 'utf8');
console.log(parsePhilibert(html, 'https://x'));
const $ = load(html);
const a = $('.product-actions__container').first();
console.log(a.html()?.replace(/\s+/g, ' ').slice(0, 4000));

import { describe, expect, it } from 'vitest';
import { errorSource } from '../src/error-log';

describe('errorSource', () => {
  it('reconnaît les sources', () => {
    expect(errorSource({}, 'Prix français eBay impossible', '')).toBe('ebay');
    expect(errorSource({ set: 'sv08' }, 'Import des cartes impossible', 'HTTP 503')).toBe('tcgdex');
    expect(errorSource({ retailer: 'Boutique' }, 'Échec du relevé', 'HTTP 500')).toBe('boutiques');
    expect(errorSource({ channel: 'ntfy' }, 'Échec d’envoi', '')).toBe('notifications');
    expect(errorSource({}, 'Échec de la tâche planifiée', '')).toBe('worker');
  });
});

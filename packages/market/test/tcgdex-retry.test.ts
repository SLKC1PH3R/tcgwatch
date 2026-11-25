import { describe, expect, it } from 'vitest';
import { TcgdexClient } from '../src/tcgdex';

const client = (statuses: number[]) => {
  let calls = 0;
  const fetchImpl = (async () => {
    const status = statuses[Math.min(calls++, statuses.length - 1)]!;
    return new Response(JSON.stringify([{ id: 'sv08', name: 'Étincelles Déferlantes' }]), {
      status,
    });
  }) as typeof fetch;
  return {
    c: new TcgdexClient('https://tcgdex.test/v2/fr', fetchImpl, [0, 0]),
    calls: () => calls,
  };
};

describe('TcgdexClient', () => {
  it('réessaie quand TCGdex est indisponible', async () => {
    const { c, calls } = client([503, 502, 200]);
    await expect(c.listSets()).resolves.toHaveLength(1);
    expect(calls()).toBe(3);
  });

  it('abandonne après les essais prévus', async () => {
    const { c, calls } = client([503]);
    await expect(c.listSets()).rejects.toThrow('HTTP 503');
    expect(calls()).toBe(3);
  });

  it('ne réessaie pas une erreur définitive', async () => {
    const { c, calls } = client([404]);
    await expect(c.listSets()).rejects.toThrow('HTTP 404');
    expect(calls()).toBe(1);
  });
});

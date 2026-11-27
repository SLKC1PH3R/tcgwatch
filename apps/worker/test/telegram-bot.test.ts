import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/jobs/telegram-bot';

describe('parseCommand', () => {
  it('lit la commande et son argument', () => {
    expect(parseCommand('/start abc_DEF-123')).toEqual({ cmd: 'start', arg: 'abc_DEF-123' });
    expect(parseCommand('/stop')).toEqual({ cmd: 'stop', arg: '' });
    expect(parseCommand('/start@TcgWatchBot tok')).toEqual({ cmd: 'start', arg: 'tok' });
    expect(parseCommand('bonjour')).toBeNull();
  });
});

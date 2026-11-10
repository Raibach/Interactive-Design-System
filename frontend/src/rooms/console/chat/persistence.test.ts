import { describe, expect, it } from 'vitest';
import { applyPersistenceFailure, classifyPersistenceError, type PersistenceTurn } from './persistence';

describe('turn persistence behavior', () => {
  it('a failed assistant reply is not drawn as a turn', () => {
    const turns: PersistenceTurn[] = [{ role: 'user', content: 'hello' }];
    const effect = applyPersistenceFailure(turns, 'This reply could not be written to this conversation: forced');
    expect(effect.replyNotSaved).toBe(true);
    expect(effect.userNotSaved).toBe(false);
    expect(effect.turns).toEqual(turns);
    expect(effect.turns.some((turn) => turn.notSaved)).toBe(false);
  });

  it('a failed person turn stays visible and is marked not saved', () => {
    const turns: PersistenceTurn[] = [
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ];
    const effect = applyPersistenceFailure(turns, 'Your message could not be written to this conversation: forced');
    expect(effect.userNotSaved).toBe(true);
    expect(effect.replyNotSaved).toBe(false);
    expect(effect.turns[0].notSaved).toBeUndefined();
    expect(effect.turns[1].notSaved).toBe(true);
  });

  it('no persistence error changes nothing', () => {
    const turns: PersistenceTurn[] = [{ role: 'user', content: 'hello' }];
    const effect = applyPersistenceFailure(turns, '');
    expect(classifyPersistenceError('')).toEqual({ replyNotSaved: false, userNotSaved: false });
    expect(effect.turns).toBe(turns);
  });
});

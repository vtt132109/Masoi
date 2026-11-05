import type { PlayerId } from '@masoi/shared';
import { projectFor } from './projection';
import type { Command, GameState } from './state';

/** PRNG riêng của test (tách khỏi RNG của engine để kết quả bot không ảnh hưởng engine). */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T,
    chance: (p: number) => next() < p,
  };
}

type Rng = ReturnType<typeof makeRng>;

/** Một lệnh hợp lệ ngẫu nhiên cho `id`, dựa trên đúng thông tin người đó được thấy. */
export function botCommand(s: GameState, id: PlayerId, rng: Rng): Command | null {
  const v = projectFor(s, id);
  const seq = v.phase.seq;
  const act = (action: Extract<Command, { type: 'ACTION' }>['action']): Command => ({
    type: 'ACTION',
    playerId: id,
    phaseSeq: seq,
    action,
  });
  const a = v.myAction;
  switch (a.kind) {
    case 'ACK_ROLE':
      return a.done ? null : { type: 'ACK_ROLE', playerId: id, phaseSeq: seq };
    case 'WOLF_VOTE':
      if (a.locked) return null;
      if (a.current === null || rng.chance(0.3)) {
        return act({ type: 'WOLF_VOTE', target: rng.chance(0.93) ? rng.pick(a.targets) : null });
      }
      return act({ type: 'WOLF_LOCK' });
    case 'SEER_CHECK':
      return a.done
        ? null
        : act({
            type: 'SEER_CHECK',
            target: rng.chance(0.9) && a.targets.length ? rng.pick(a.targets) : null,
          });
    case 'GUARD_PROTECT':
      return a.done
        ? null
        : act({
            type: 'GUARD_PROTECT',
            target: rng.chance(0.9) && a.targets.length ? rng.pick(a.targets) : null,
          });
    case 'NIGHT_DUMMY':
      return a.done
        ? null
        : act({
            type: 'NIGHT_DUMMY',
            suspect: rng.chance(0.8) && a.targets.length ? rng.pick(a.targets) : null,
          });
    case 'WITCH_ACT':
      if (a.done) return null;
      return act({
        type: 'WITCH_ACT',
        heal: a.canHeal && rng.chance(0.5),
        poison:
          a.canPoison && a.poisonTargets.length && rng.chance(0.3)
            ? rng.pick(a.poisonTargets)
            : null,
      });
    case 'HUNTER_SHOOT':
      return act({
        type: 'HUNTER_SHOOT',
        target: a.targets.length && rng.chance(0.8) ? rng.pick(a.targets) : null,
      });
    case 'VOTE': {
      const r = rng.next();
      if (a.current !== null && r < 0.5) return null;
      if (r < 0.15 && a.skipAllowed) return act({ type: 'VOTE', target: 'SKIP' });
      return act({ type: 'VOTE', target: a.targets.length ? rng.pick(a.targets) : null });
    }
    case 'DISCUSS':
      if (rng.chance(0.5)) return act({ type: 'RAISE_HAND', up: rng.chance(0.5) });
      if (a.isSpeaker) return act({ type: 'DONE_SPEAKING' });
      return act({ type: 'READY_TO_VOTE', ready: rng.chance(0.6) });
    default:
      return null;
  }
}

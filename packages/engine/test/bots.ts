import { defaultConfig, type GameConfig, type PlayerId } from '@masoi/shared';
import { apply, createGame, projectFor, type Command, type GameState } from '../src';

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

export interface BotGameResult {
  state: GameState;
  steps: number;
  commands: number;
  /** Nhật ký lệnh + mốc thời gian, đủ để phát lại ván từ seed. */
  log: { cmd: Command; now: number }[];
  initial: { seed: number; players: number; config: GameConfig; startedAt: number };
}

export interface BotGameOptions {
  seed: number;
  players: number;
  tweak?: (c: GameConfig) => void;
  /** Gọi sau mỗi lệnh thành công để kiểm tra bất biến. */
  onStep?: (prev: GameState, next: GameState) => void;
}

export function playBotGame(opts: BotGameOptions): BotGameResult {
  const rng = makeRng(opts.seed * 7919 + 13);
  const config = defaultConfig(opts.players);
  opts.tweak?.(config);
  const startedAt = 1_700_000_000_000;
  let now = startedAt;
  const log: { cmd: Command; now: number }[] = [];
  let s = createGame({
    id: `bot-${opts.seed}`,
    players: Array.from({ length: opts.players }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    config,
    seed: opts.seed,
    now,
  });

  const ids = Object.keys(s.players);
  let steps = 0;
  let commands = 0;
  const apply1 = (cmd: Command) => {
    const r = apply(s, cmd, now);
    if (!r.ok) {
      throw new Error(
        `Lệnh hợp lệ bị từ chối (${r.error.code}): ${r.error.message} — ${JSON.stringify(cmd)}`,
      );
    }
    opts.onStep?.(s, r.state);
    s = r.state;
    commands++;
    log.push({ cmd, now });
  };

  while (!s.winner) {
    if (++steps > 4000) throw new Error('Ván không kết thúc sau 4000 bước');
    const seqBefore = s.phase.seq;
    const order = [...ids].sort(() => rng.next() - 0.5);
    for (const id of order) {
      if (s.winner || s.phase.seq !== seqBefore) break;
      const cmd = botCommand(s, id, rng);
      if (cmd) apply1(cmd);
    }
    if (s.winner) break;
    if (s.phase.seq === seqBefore) {
      // Không ai làm gì thêm → chờ hết giờ.
      const d = s.phase.deadlineAt;
      if (d === null) throw new Error(`Pha ${s.phase.id} không có hạn chót`);
      now = Math.max(now, d);
      apply1({ type: 'TIMER', phaseSeq: s.phase.seq });
    }
  }
  return {
    state: s,
    steps,
    commands,
    log,
    initial: { seed: opts.seed, players: opts.players, config, startedAt },
  };
}

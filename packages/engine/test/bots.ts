import { defaultConfig, type GameConfig } from '@masoi/shared';
import { apply, createGame, type Command, type GameState } from '../src';
import { botCommand, makeRng } from '../src/bot';

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

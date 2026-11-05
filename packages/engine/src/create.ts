import {
  ROLE_IDS,
  validateConfig,
  type GameConfig,
  type PlayerId,
  type RoleId,
} from '@masoi/shared';
import { freshDay, freshNight, enterRoleReveal } from './phases';
import { shuffle } from './rng';
import type { Ctx, GameState, PlayerState } from './state';

export interface CreateGameInput {
  id: string;
  players: { id: PlayerId; name: string }[];
  config: GameConfig;
  seed: number;
  now: number;
  /** Chỉ dùng cho test/dev: gán vai cố định thay vì xáo ngẫu nhiên. */
  assignments?: Record<PlayerId, RoleId>;
}

export function createGame(input: CreateGameInput): GameState {
  const { players, config, seed, now } = input;
  const problems = validateConfig(config, players.length);
  if (problems.length > 0) {
    throw new Error(`Cấu hình không hợp lệ: ${problems.map((p) => p.code).join(', ')}`);
  }

  const s: GameState = {
    id: input.id,
    seed,
    rng: seed >>> 0,
    config: structuredClone(config),
    phase: {
      id: 'ROLE_REVEAL',
      seq: 0,
      startedAt: now,
      deadlineAt: null,
      minEndAt: null,
      paused: null,
    },
    turn: 0,
    players: {},
    seatOrder: players.map((p) => p.id),
    acked: {},
    night: undefined as never,
    day: freshDay(0),
    dawnDeaths: [],
    pendingShots: [],
    afterHunter: 'DAWN',
    winner: null,
    history: [],
    timeline: [],
  };

  let deck: RoleId[] = [];
  for (const r of ROLE_IDS) for (let i = 0; i < config.roles[r]; i++) deck.push(r);
  deck = shuffle(s, deck);

  players.forEach((pl, i) => {
    const role = input.assignments?.[pl.id] ?? (deck[i] as RoleId);
    const ps: PlayerState = {
      id: pl.id,
      name: pl.name,
      role,
      alive: true,
      removed: false,
      canVote: true,
      seerChecks: [],
      guardLast: null,
      witch: { heal: role === 'WITCH', poison: role === 'WITCH' },
    };
    s.players[pl.id] = ps;
    s.acked[pl.id] = false;
  });

  s.night = freshNight(s, 0);
  const c: Ctx = { now, cues: [] };
  enterRoleReveal(s, c);
  return s;
}

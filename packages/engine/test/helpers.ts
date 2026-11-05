import {
  emptyRoles,
  type GameAction,
  type GameConfig,
  type PlayerId,
  type RoleId,
} from '@masoi/shared';
import { defaultConfig } from '@masoi/shared';
import {
  apply,
  createGame,
  projectFor,
  type ApplyResult,
  type Command,
  type GameState,
} from '../src';
import { expect } from 'vitest';

export const DEFAULT_ROLES: Record<string, RoleId> = {
  A: 'WEREWOLF',
  B: 'WEREWOLF',
  C: 'SEER',
  D: 'GUARD',
  E: 'WITCH',
  F: 'HUNTER',
  G: 'VILLAGER',
  H: 'VILLAGER',
};

export interface SimOptions {
  seed?: number;
  tweak?: (c: GameConfig) => void;
}

/** Bộ mô phỏng ván: điều khiển thời gian và gửi lệnh thay người chơi. */
export class Sim {
  s: GameState;
  now = 1_000_000;

  constructor(roles: Record<string, RoleId> = DEFAULT_ROLES, opts: SimOptions = {}) {
    const ids = Object.keys(roles);
    const config = defaultConfig(ids.length);
    config.roles = emptyRoles();
    for (const r of Object.values(roles)) config.roles[r] += 1;
    opts.tweak?.(config);
    this.s = createGame({
      id: 'test',
      players: ids.map((id) => ({ id, name: `Người ${id}` })),
      config,
      seed: opts.seed ?? 7,
      now: this.now,
      assignments: roles,
    });
  }

  get phase() {
    return this.s.phase.id;
  }

  run(cmd: Command): ApplyResult {
    const r = apply(this.s, cmd, this.now);
    if (r.ok) this.s = r.state;
    return r;
  }

  /** Gửi hành động; mặc định kỳ vọng thành công. */
  act(id: PlayerId, action: GameAction) {
    const r = this.run({ type: 'ACTION', playerId: id, phaseSeq: this.s.phase.seq, action });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    return r;
  }

  tryAct(id: PlayerId, action: GameAction) {
    return this.run({ type: 'ACTION', playerId: id, phaseSeq: this.s.phase.seq, action });
  }

  ackAll() {
    for (const id of this.s.seatOrder) {
      this.run({ type: 'ACK_ROLE', playerId: id, phaseSeq: this.s.phase.seq });
    }
  }

  /** Chạy đến hạn chót của pha hiện tại. */
  tick() {
    const d = this.s.phase.deadlineAt;
    expect(d, 'pha không có hạn chót').not.toBeNull();
    this.now = Math.max(this.now, d as number);
    const r = this.run({ type: 'TIMER', phaseSeq: this.s.phase.seq });
    expect(r.ok).toBe(true);
  }

  tickUntil(phase: GameState['phase']['id'], max = 50) {
    for (let i = 0; i < max && this.phase !== phase; i++) this.tick();
    expect(this.phase).toBe(phase);
  }

  toNight() {
    this.ackAll();
    expect(this.phase).toBe('NIGHT');
  }

  alive(): PlayerId[] {
    return this.s.seatOrder.filter((id) => this.s.players[id]?.alive);
  }

  roleOf(id: PlayerId): RoleId {
    return (this.s.players[id] as { role: RoleId }).role;
  }

  /** Mọi người còn sống hoàn thành bước MAIN của đêm. */
  mainNight(o: { wolf?: PlayerId | null; guard?: PlayerId | null; seer?: PlayerId | null } = {}) {
    for (const id of this.alive()) {
      const role = this.roleOf(id);
      if (role === 'WEREWOLF') {
        this.act(id, { type: 'WOLF_VOTE', target: o.wolf ?? null });
        this.act(id, { type: 'WOLF_LOCK' });
      } else if (role === 'GUARD') {
        this.act(id, { type: 'GUARD_PROTECT', target: o.guard ?? null });
      } else if (role === 'SEER') {
        this.act(id, { type: 'SEER_CHECK', target: o.seer ?? null });
      } else {
        this.act(id, { type: 'NIGHT_DUMMY', suspect: null });
      }
    }
  }

  /** Qua cả đêm (MAIN + bước Phù thủy) đến lúc bình minh. */
  night(
    o: {
      wolf?: PlayerId | null;
      guard?: PlayerId | null;
      seer?: PlayerId | null;
      heal?: boolean;
      poison?: PlayerId | null;
    } = {},
  ) {
    expect(this.phase).toBe('NIGHT');
    this.mainNight(o);
    this.tick(); // hết bước MAIN
    if (this.phase === 'NIGHT') {
      const witch = this.alive().find((id) => this.roleOf(id) === 'WITCH');
      if (witch && this.s.night.step === 'WITCH' && !this.s.night.witchDone) {
        this.act(witch, { type: 'WITCH_ACT', heal: o.heal ?? false, poison: o.poison ?? null });
      }
      this.tick(); // hết bước Phù thủy
    }
    expect(this.phase).toBe('DAWN');
  }

  /** Qua bình minh + thảo luận đến lúc bỏ phiếu. */
  toVote() {
    this.tickUntil('VOTE');
  }

  /** Mọi người còn sống bỏ phiếu cho `target` (trừ chính họ → bỏ qua). */
  voteAll(target: PlayerId | 'SKIP', skipSelf: 'SKIP' | PlayerId = 'SKIP') {
    for (const id of this.alive()) {
      this.act(id, { type: 'VOTE', target: id === target ? skipSelf : target });
    }
  }

  view(id: PlayerId) {
    return projectFor(this.s, id);
  }
}

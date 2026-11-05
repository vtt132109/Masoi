import { describe, expect, it } from 'vitest';
import { ROLE_TEAM, type PlayerView } from '@masoi/shared';
import { projectFor, type GameState } from '../src';
import { Sim } from './helpers';
import { playBotGame } from './bots';

/** Kiểm tra một PlayerView không chứa thông tin người xem không được biết. */
export function assertNoLeak(s: GameState, viewerId: string): void {
  const v: PlayerView = projectFor(s, viewerId);
  const me = s.players[viewerId]!;
  const over = s.winner !== null;
  const viewerIsWolf = ROLE_TEAM[me.role] === 'WOLF';

  for (const vp of v.players) {
    const real = s.players[vp.id]!;
    if (vp.id === viewerId) continue;
    if (!over && real.alive) {
      expect(vp.revealedRole, `${viewerId} thấy vai của ${vp.id} đang sống`).toBeUndefined();
    }
    if (vp.tags.length > 0) {
      expect(viewerIsWolf, `${viewerId} không phải Sói mà thấy thẻ Sói`).toBe(true);
      expect(ROLE_TEAM[real.role]).toBe('WOLF');
    }
  }
  if (!viewerIsWolf) {
    expect(v.privateInfo.wolfVotes).toBeUndefined();
    expect(v.privateInfo.wolfLocked).toBeUndefined();
  }
  if (!me.alive) {
    // D6: người chết không thấy lựa chọn ban đêm của bầy Sói.
    expect(v.privateInfo.wolfVotes).toBeUndefined();
  }
  if (me.role !== 'SEER') expect(v.privateInfo.seerChecks).toBeUndefined();
  if (me.role !== 'GUARD') expect(v.privateInfo.guardLast).toBeUndefined();
  if (me.role !== 'WITCH') expect(v.privateInfo.witchPotions).toBeUndefined();
  if (!over) expect(v.gameOver).toBeUndefined();

  // Nạn nhân của Sói trong đêm chỉ lộ cho Phù thủy.
  const text = JSON.stringify(v);
  if (me.role !== 'WITCH') expect(text).not.toContain('"victim"');
  // Không có trường nội bộ của server.
  for (const forbidden of [
    '"seed"',
    '"rng"',
    '"night":{',
    '"wolfTarget"',
    '"dummyPicks"',
    '"pendingShots"',
  ]) {
    expect(text, `view chứa ${forbidden}`).not.toContain(forbidden);
  }
  // Vai của người còn sống khác không xuất hiện dưới bất kỳ khóa nào ngoài revealedRole đã kiểm tra.
  if (!over) {
    const aliveOthers = Object.values(s.players).filter((p) => p.alive && p.id !== viewerId);
    for (const o of aliveOthers) {
      expect(JSON.stringify(v.publicInfo)).not.toContain(`"id":"${o.id}","role"`);
    }
  }
}

describe('chống lộ thông tin (projection)', () => {
  it('Sói thấy đồng đội và lựa chọn của bầy; Dân thì không', () => {
    const sim = new Sim();
    sim.toNight();
    sim.act('A', { type: 'WOLF_VOTE', target: 'G' });
    const a = sim.view('A');
    expect(a.players.find((p) => p.id === 'B')?.tags).toEqual(['WOLF_ALLY']);
    expect(a.privateInfo.wolfVotes).toEqual({ A: 'G', B: null });
    expect(sim.view('B').privateInfo.wolfVotes?.A).toBe('G');
    expect(sim.view('G').players.every((p) => p.tags.length === 0)).toBe(true);
    expect(sim.view('G').privateInfo.wolfVotes).toBeUndefined();
  });

  it('D6: Sói đã chết không thấy lựa chọn đêm của bầy; người chết thường không thấy thẻ Sói', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: 'G', poison: 'A' });
    sim.tickUntil('NIGHT');
    expect(sim.s.players.A?.alive).toBe(false);
    sim.act('B', { type: 'WOLF_VOTE', target: 'H' });
    const deadWolf = sim.view('A');
    expect(deadWolf.privateInfo.wolfVotes).toBeUndefined();
    expect(deadWolf.myAction.kind).toBe('NONE');
    const deadVillager = sim.view('G');
    expect(deadVillager.players.every((p) => p.tags.length === 0)).toBe(true);
    for (const id of sim.s.seatOrder) assertNoLeak(sim.s, id);
  });

  it('revealRoleOnDeath=false: không lật vai khi chết', () => {
    const sim = new Sim(undefined, { tweak: (c) => (c.rules.revealRoleOnDeath = false) });
    sim.toNight();
    sim.night({ wolf: 'G' });
    const v = sim.view('H');
    expect(v.publicInfo.lastDeaths).toEqual([{ id: 'G' }]);
    expect(v.players.find((p) => p.id === 'G')?.revealedRole).toBeUndefined();
  });

  it('mọi vai trong mọi pha của nhiều ván bot: không rò rỉ', { timeout: 120_000 }, () => {
    for (let seed = 1; seed <= 16; seed++) {
      playBotGame({
        seed,
        players: 5 + (seed % 16),
        onStep: (_prev, next) => {
          for (const id of Object.keys(next.players)) assertNoLeak(next, id);
        },
      });
    }
  });
});

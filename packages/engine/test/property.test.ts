import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ROLE_IDS, ROLE_TEAM } from '@masoi/shared';
import { apply, checkWin, createGame, projectFor, type GameState } from '../src';
import { defaultConfig } from '@masoi/shared';
import { playBotGame } from './bots';

function invariants(prev: GameState, next: GameState) {
  for (const id of Object.keys(next.players)) {
    const a = prev.players[id]!;
    const b = next.players[id]!;
    // Người chết không sống lại; vai không đổi.
    if (!a.alive) expect(b.alive, `${id} sống lại`).toBe(false);
    expect(b.role).toBe(a.role);
    // Bình thuốc chỉ giảm.
    expect(Number(b.witch.heal)).toBeLessThanOrEqual(Number(a.witch.heal));
    expect(Number(b.witch.poison)).toBeLessThanOrEqual(Number(a.witch.poison));
    // Nhật ký soi chỉ tăng.
    expect(b.seerChecks.length).toBeGreaterThanOrEqual(a.seerChecks.length);
  }
  expect(next.phase.seq).toBeGreaterThanOrEqual(prev.phase.seq);
  expect(next.turn).toBeGreaterThanOrEqual(prev.turn);
  // Sau khi có người thắng, không còn pha nào khác.
  if (next.winner) expect(next.phase.id).toBe('GAME_OVER');
}

describe('property: ván bot ngẫu nhiên', () => {
  it('luôn kết thúc, bất biến luôn đúng, người thắng khớp điều kiện', { timeout: 120_000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 5, max: 20 }),
        (seed, n) => {
          const { state } = playBotGame({ seed, players: n, onStep: invariants });
          expect(state.winner).not.toBeNull();
          const win = checkWin(state);
          expect(win?.winner).toBe(state.winner?.winner);

          const alive = Object.values(state.players).filter((p) => p.alive);
          const wolves = alive.filter((p) => ROLE_TEAM[p.role] === 'WOLF').length;
          if (state.winner?.winner === 'VILLAGE') expect(wolves).toBe(0);
          if (state.winner?.winner === 'WOLF')
            expect(wolves).toBeGreaterThanOrEqual(alive.length - wolves);

          // Số lượng vai khớp cấu hình.
          for (const r of ROLE_IDS) {
            expect(Object.values(state.players).filter((p) => p.role === r).length).toBe(
              state.config.roles[r],
            );
          }
          // Mọi người nhìn thấy toàn bộ vai khi hết ván.
          const v = projectFor(state, 'p0');
          expect(Object.keys(v.gameOver?.roles ?? {})).toHaveLength(n);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('các biến thể luật vẫn chạy ổn', { timeout: 120_000 }, () => {
    const variants: ((c: ReturnType<typeof defaultConfig>) => void)[] = [
      (c) => (c.rules.tieBreak = 'REVOTE'),
      (c) => (c.rules.tieBreak = 'RANDOM'),
      (c) => (c.rules.discussionMode = 'TURNS'),
      (c) => (c.rules.absoluteMajority = true),
      (c) => (c.rules.allowSkipVote = false),
      (c) => (c.rules.firstNightNoKill = true),
      (c) => (c.rules.nightTaskForVillagers = false),
      (c) => (c.rules.guardAndWitchSameTargetKills = true),
      (c) => (c.rules.revealRoleOnDeath = false),
    ];
    variants.forEach((tweak, i) => {
      for (let seed = 1; seed <= 12; seed++) {
        const { state } = playBotGame({
          seed: seed * 31 + i,
          players: 6 + ((seed + i) % 12),
          tweak,
          onStep: invariants,
        });
        expect(state.winner).not.toBeNull();
      }
    });
  });

  it('phát lại: cùng seed + cùng chuỗi lệnh → cùng trạng thái cuối', () => {
    const game = playBotGame({ seed: 99, players: 9 });
    let s = createGame({
      id: 'bot-99',
      players: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
      config: game.initial.config,
      seed: game.initial.seed,
      now: game.initial.startedAt,
    });
    for (const { cmd, now } of game.log) {
      const r = apply(s, cmd, now);
      if (!r.ok) throw new Error('phát lại bị lỗi');
      s = r.state;
    }
    expect(JSON.stringify(s)).toBe(JSON.stringify(game.state));
  });
});

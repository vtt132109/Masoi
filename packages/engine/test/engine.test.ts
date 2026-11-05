import { describe, expect, it } from 'vitest';
import { defaultConfig, emptyRoles } from '@masoi/shared';
import { apply, createGame, nextDeadline } from '../src';
import { DEFAULT_ROLES, Sim } from './helpers';

describe('createGame', () => {
  it('chia vai đúng số lượng cấu hình và tất định theo seed', () => {
    const make = (seed: number) =>
      createGame({
        id: 'g',
        players: 'ABCDEFGH'.split('').map((id) => ({ id, name: id })),
        config: defaultConfig(8),
        seed,
        now: 0,
      });
    const a = make(42);
    const b = make(42);
    const c = make(43);
    const roles = (g: ReturnType<typeof make>) => Object.values(g.players).map((p) => p.role);
    expect(roles(a)).toEqual(roles(b));
    expect(roles(a)).not.toEqual(roles(c));
    const count = (r: string) => roles(a).filter((x) => x === r).length;
    expect(count('WEREWOLF')).toBe(2);
    expect(count('SEER')).toBe(1);
    expect(count('VILLAGER')).toBe(2);
  });

  it('từ chối cấu hình sai', () => {
    const cfg = defaultConfig(8);
    cfg.roles = { ...emptyRoles(), VILLAGER: 8 }; // không có Sói
    expect(() =>
      createGame({
        id: 'g',
        players: 'ABCDEFGH'.split('').map((id) => ({ id, name: id })),
        config: cfg,
        seed: 1,
        now: 0,
      }),
    ).toThrow();
  });
});

describe('xem vai', () => {
  it('sang đêm 1 khi mọi người đã xem, hoặc khi hết giờ', () => {
    const sim = new Sim();
    expect(sim.phase).toBe('ROLE_REVEAL');
    sim.ackAll();
    expect(sim.phase).toBe('NIGHT');
    expect(sim.s.turn).toBe(1);

    const sim2 = new Sim();
    sim2.tick();
    expect(sim2.phase).toBe('NIGHT');
  });
});

describe('ban đêm', () => {
  it('Sói cắn trúng dân, bình minh công bố người chết và lật vai', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: 'G' });
    expect(sim.s.players.G?.alive).toBe(false);
    const v = sim.view('H');
    expect(v.publicInfo.lastDeaths).toEqual([{ id: 'G', role: 'VILLAGER' }]);
    expect(v.players.find((p) => p.id === 'G')?.revealedRole).toBe('VILLAGER');
  });

  it('Bảo vệ đỡ đúng người thì không ai chết', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: 'G', guard: 'G' });
    expect(sim.alive()).toHaveLength(8);
    expect(sim.view('H').publicInfo.lastDeaths).toEqual([]);
  });

  it('Bảo vệ không được chọn cùng một người hai đêm liên tiếp', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ guard: 'G' });
    sim.tickUntil('NIGHT');
    const r = sim.tryAct('D', { type: 'GUARD_PROTECT', target: 'G' });
    expect(r.ok).toBe(false);
    expect(sim.tryAct('D', { type: 'GUARD_PROTECT', target: 'H' }).ok).toBe(true);
  });

  it('luật guardSelfProtect=false chặn tự bảo vệ', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.guardSelfProtect = false) });
    sim.toNight();
    expect(sim.tryAct('D', { type: 'GUARD_PROTECT', target: 'D' }).ok).toBe(false);
  });

  it('Sói không được chọn Sói, người chết hay người không tồn tại', () => {
    const sim = new Sim();
    sim.toNight();
    expect(sim.tryAct('A', { type: 'WOLF_VOTE', target: 'B' }).ok).toBe(false);
    expect(sim.tryAct('A', { type: 'WOLF_VOTE', target: 'A' }).ok).toBe(false);
    expect(sim.tryAct('A', { type: 'WOLF_VOTE', target: 'ZZ' }).ok).toBe(false);
    expect(sim.tryAct('A', { type: 'WOLF_VOTE', target: 'G' }).ok).toBe(true);
  });

  it('Sói chọn khác nhau: hòa thì chọn ngẫu nhiên trong số bị chọn, không bao giờ ngoài đó', () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new Sim(DEFAULT_ROLES, { seed });
      sim.toNight();
      sim.act('A', { type: 'WOLF_VOTE', target: 'G' });
      sim.act('A', { type: 'WOLF_LOCK' });
      sim.act('B', { type: 'WOLF_VOTE', target: 'H' });
      sim.act('B', { type: 'WOLF_LOCK' });
      for (const id of ['C', 'D']) {
        sim.act(
          id,
          id === 'C'
            ? { type: 'SEER_CHECK', target: null }
            : { type: 'GUARD_PROTECT', target: null },
        );
      }
      for (const id of ['E', 'F', 'G', 'H']) sim.act(id, { type: 'NIGHT_DUMMY', suspect: null });
      sim.tick();
      picked.add(String(sim.s.night.wolfTarget));
    }
    expect([...picked].sort()).toEqual(['G', 'H']);
  });

  it('không Sói nào chọn thì đêm bình yên', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: null });
    expect(sim.alive()).toHaveLength(8);
  });

  it('firstNightNoKill: đêm 1 không ai bị cắn', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.firstNightNoKill = true) });
    sim.toNight();
    sim.night({ wolf: 'G' });
    expect(sim.alive()).toHaveLength(8);
  });

  it('Tiên tri nhận kết quả đúng và chỉ mình Tiên tri thấy', () => {
    const sim = new Sim();
    sim.toNight();
    sim.act('C', { type: 'SEER_CHECK', target: 'A' });
    const again = sim.tryAct('C', { type: 'SEER_CHECK', target: 'G' });
    expect(again.ok).toBe(false);
    expect(sim.view('C').privateInfo.seerChecks).toEqual([
      { night: 1, target: 'A', result: 'WOLF' },
    ]);
    expect(sim.view('G').privateInfo.seerChecks).toBeUndefined();
  });

  it('seerCanRecheck=false chặn soi lại người đã soi', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.seerCanRecheck = false) });
    sim.toNight();
    sim.night({ seer: 'G' });
    sim.tickUntil('NIGHT');
    expect(sim.tryAct('C', { type: 'SEER_CHECK', target: 'G' }).ok).toBe(false);
    expect(sim.tryAct('C', { type: 'SEER_CHECK', target: 'H' }).ok).toBe(true);
  });
});

describe('Phù thủy', () => {
  it('thấy nạn nhân và cứu được; bình cứu chỉ dùng một lần', () => {
    const sim = new Sim();
    sim.toNight();
    sim.mainNight({ wolf: 'G' });
    sim.tick();
    const v = sim.view('E');
    expect(v.myAction).toMatchObject({ kind: 'WITCH_ACT', victim: 'G', canHeal: true });
    sim.act('E', { type: 'WITCH_ACT', heal: true, poison: null });
    sim.tick();
    expect(sim.s.players.G?.alive).toBe(true);
    expect(sim.s.players.E?.witch.heal).toBe(false);

    sim.tickUntil('NIGHT');
    sim.mainNight({ wolf: 'H' });
    sim.tick();
    const again = sim.tryAct('E', { type: 'WITCH_ACT', heal: true, poison: null });
    expect(again.ok).toBe(false);
  });

  it('đầu độc giết người, bỏ qua Bảo vệ', () => {
    const sim = new Sim();
    sim.toNight();
    sim.mainNight({ guard: 'G' });
    sim.tick();
    sim.act('E', { type: 'WITCH_ACT', heal: false, poison: 'G' });
    sim.tick();
    expect(sim.s.players.G?.alive).toBe(false);
    expect(sim.s.players.G?.death?.cause).toBe('POISON');
  });

  it('người khác không thấy nạn nhân và không hành động được ở bước Phù thủy', () => {
    const sim = new Sim();
    sim.toNight();
    sim.mainNight({ wolf: 'G' });
    sim.tick();
    for (const id of ['A', 'C', 'D', 'F', 'G', 'H']) {
      expect(sim.view(id).myAction.kind).toBe('NIGHT_WAIT');
      expect(JSON.stringify(sim.view(id))).not.toContain('"victim"');
    }
    expect(sim.tryAct('C', { type: 'WITCH_ACT', heal: true, poison: null }).ok).toBe(false);
  });

  it('đỡ trùng: Bảo vệ và Phù thủy cùng cứu một người → chết nếu bật luật', () => {
    const sim = new Sim(DEFAULT_ROLES, {
      tweak: (c) => (c.rules.guardAndWitchSameTargetKills = true),
    });
    sim.toNight();
    sim.mainNight({ wolf: 'G', guard: 'G' });
    sim.tick();
    sim.act('E', { type: 'WITCH_ACT', heal: true, poison: null });
    sim.tick();
    expect(sim.s.players.G?.alive).toBe(false);
  });

  it('witchSelfHeal=false: không tự cứu mình', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.witchSelfHeal = false) });
    sim.toNight();
    sim.mainNight({ wolf: 'E' });
    sim.tick();
    expect(sim.tryAct('E', { type: 'WITCH_ACT', heal: true, poison: null }).ok).toBe(false);
  });

  it('witchBothPotionsSameNight=false chặn dùng cả hai bình', () => {
    const sim = new Sim(DEFAULT_ROLES, {
      tweak: (c) => (c.rules.witchBothPotionsSameNight = false),
    });
    sim.toNight();
    sim.mainNight({ wolf: 'G' });
    sim.tick();
    expect(sim.tryAct('E', { type: 'WITCH_ACT', heal: true, poison: 'H' }).ok).toBe(false);
  });

  it('Phù thủy đã chết thì bước Phù thủy vẫn chạy một khoảng ngẫu nhiên (không lộ qua thời gian)', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: 'E' });
    expect(sim.s.players.E?.alive).toBe(false);
    sim.tickUntil('NIGHT');
    sim.mainNight({ wolf: 'G' });
    sim.tick();
    expect(sim.phase).toBe('NIGHT');
    expect(sim.s.night.step).toBe('WITCH');
    expect(sim.s.night.witchDone).toBe(true);
  });
});

describe('thời gian', () => {
  it('xong sớm vẫn phải chờ tới thời điểm tối thiểu của đêm', () => {
    const sim = new Sim();
    sim.toNight();
    const minEnd = sim.s.phase.minEndAt as number;
    const full = sim.s.phase.deadlineAt as number;
    expect(minEnd).toBeGreaterThan(sim.now);
    expect(minEnd).toBeLessThanOrEqual(full);
    sim.mainNight();
    expect(nextDeadline(sim.s)).toBe(minEnd);
  });

  it('tạm dừng / tiếp tục giữ nguyên thời gian còn lại, và chặn hành động', () => {
    const sim = new Sim();
    sim.toNight();
    const remain = (sim.s.phase.deadlineAt as number) - sim.now;
    sim.run({ type: 'HOST', command: { kind: 'PAUSE' } });
    expect(nextDeadline(sim.s)).toBeNull();
    expect(sim.tryAct('G', { type: 'NIGHT_DUMMY', suspect: null })).toMatchObject({
      ok: false,
      error: { code: 'PAUSED' },
    });
    sim.now += 60_000;
    sim.run({ type: 'HOST', command: { kind: 'RESUME' } });
    expect((sim.s.phase.deadlineAt as number) - sim.now).toBe(remain);
  });

  it('gia hạn thêm giây', () => {
    const sim = new Sim();
    sim.toNight();
    const before = sim.s.phase.deadlineAt as number;
    sim.run({ type: 'HOST', command: { kind: 'EXTEND', seconds: 30 } });
    expect(sim.s.phase.deadlineAt).toBe(before + 30_000);
  });

  it('lệnh của pha cũ bị từ chối, hẹn giờ cũ bị bỏ qua', () => {
    const sim = new Sim();
    sim.toNight();
    const oldSeq = sim.s.phase.seq;
    sim.mainNight();
    sim.tick(); // sang bước Phù thủy: seq tăng
    const r = sim.run({
      type: 'ACTION',
      playerId: 'G',
      phaseSeq: oldSeq,
      action: { type: 'NIGHT_DUMMY', suspect: null },
    });
    expect(r).toMatchObject({ ok: false, error: { code: 'STALE_PHASE' } });

    const stale = apply(sim.s, { type: 'TIMER', phaseSeq: oldSeq }, sim.now + 10_000_000);
    expect(stale.ok && stale.state === sim.s).toBe(true);
  });

  it('chủ phòng bỏ qua pha', () => {
    const sim = new Sim();
    sim.toNight();
    sim.run({ type: 'HOST', command: { kind: 'SKIP' } });
    expect(sim.s.night.step).toBe('WITCH');
  });
});

describe('ban ngày & bỏ phiếu', () => {
  /** 4 phiếu cho G (A,B,C,H) và 4 phiếu cho H (D,E,F,G): hòa. */
  function tie(sim: Sim) {
    for (const id of ['A', 'B', 'C', 'H']) sim.act(id, { type: 'VOTE', target: 'G' });
    for (const id of ['D', 'E', 'F', 'G']) sim.act(id, { type: 'VOTE', target: 'H' });
  }

  function toDay(sim: Sim, wolf: string | null = null) {
    sim.toNight();
    sim.night({ wolf });
    sim.toVote();
  }

  it('đa số phiếu bị treo, vai được lật, rồi sang đêm 2', () => {
    const sim = new Sim();
    toDay(sim);
    sim.voteAll('A', 'B');
    expect(sim.phase).toBe('EXECUTION');
    const v = sim.view('C');
    expect(v.publicInfo.executed).toEqual({ id: 'A', role: 'WEREWOLF' });
    expect(v.publicInfo.voteResult?.tally.A).toBe(7);
    sim.tick();
    expect(sim.phase).toBe('NIGHT');
    expect(sim.s.turn).toBe(2);
  });

  it('"Bỏ qua" nhiều nhất → không ai bị treo', () => {
    const sim = new Sim();
    toDay(sim);
    sim.voteAll('SKIP');
    expect(sim.s.day.executed).toBeNull();
    expect(sim.alive()).toHaveLength(8);
  });

  it('hòa phiếu: NO_LYNCH', () => {
    const sim = new Sim();
    toDay(sim);
    tie(sim);
    expect(sim.phase).toBe('EXECUTION');
    expect(sim.s.day.executed).toBeNull();
  });

  it('hòa phiếu: RANDOM chọn một trong hai người hòa', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const sim = new Sim(DEFAULT_ROLES, { seed, tweak: (c) => (c.rules.tieBreak = 'RANDOM') });
      toDay(sim);
      tie(sim);
      seen.add(String(sim.s.day.executed));
    }
    expect([...seen].sort()).toEqual(['G', 'H']);
  });

  it('hòa phiếu: REVOTE bỏ phiếu lại giữa người hòa; hòa lần hai thì không ai bị treo', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.tieBreak = 'REVOTE') });
    toDay(sim);
    tie(sim);
    expect(sim.phase).toBe('REVOTE');
    expect(sim.s.day.candidates?.sort()).toEqual(['G', 'H']);
    expect(sim.tryAct('A', { type: 'VOTE', target: 'C' }).ok).toBe(false); // ngoài danh sách
    tie(sim);
    expect(sim.phase).toBe('EXECUTION');
    expect(sim.s.day.executed).toBeNull();
  });

  it('absoluteMajority: cần quá nửa số người bỏ phiếu', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.absoluteMajority = true) });
    toDay(sim);
    // G nhận 3/8 phiếu, các phiếu còn lại rải rác -> không đạt quá nửa
    const target: Record<string, string> = {
      A: 'G',
      B: 'G',
      C: 'G',
      D: 'H',
      E: 'H',
      F: 'A',
      G: 'A',
      H: 'B',
    };
    for (const [id, t] of Object.entries(target)) sim.act(id, { type: 'VOTE', target: t });
    expect(sim.s.day.executed).toBeNull();
  });

  it('không tự bỏ phiếu cho mình; người chết không bỏ phiếu', () => {
    const sim = new Sim();
    toDay(sim, 'G');
    expect(sim.tryAct('A', { type: 'VOTE', target: 'A' }).ok).toBe(false);
    expect(sim.tryAct('G', { type: 'VOTE', target: 'A' }).ok).toBe(false);
  });

  it('hết giờ: ai chưa bỏ phiếu coi như bỏ qua', () => {
    const sim = new Sim();
    toDay(sim);
    sim.act('A', { type: 'VOTE', target: 'G' });
    sim.tick();
    expect(sim.s.day.voteResult?.tally).toEqual({ G: 1, SKIP: 7 });
    expect(sim.s.day.executed).toBeNull();
  });

  it('phiếu ẩn đến khi chốt: view không chứa ai bỏ cho ai; liveVotes thì có', () => {
    const sim = new Sim();
    toDay(sim);
    sim.act('A', { type: 'VOTE', target: 'G' });
    const v = sim.view('C');
    expect(v.publicInfo.votedCount).toBe(1);
    expect(v.publicInfo.liveVotes).toBeUndefined();

    const live = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.liveVotes = true) });
    toDay(live);
    live.act('A', { type: 'VOTE', target: 'G' });
    expect(live.view('C').publicInfo.liveVotes?.A).toBe('G');
  });

  it('sẵn sàng bỏ phiếu khi đủ 2/3 người sống thì sang bỏ phiếu sớm', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night();
    expect(sim.phase).toBe('DAWN');
    sim.tick();
    expect(sim.phase).toBe('DISCUSSION');
    expect(sim.s.phase.deadlineAt).toBe(sim.now + 180_000);
    const need = sim.view('A').publicInfo.readyNeeded;
    expect(need).toBe(6);
    for (const id of 'ABCDE'.split('')) sim.act(id, { type: 'READY_TO_VOTE', ready: true });
    expect(sim.phase).toBe('DISCUSSION');
    sim.act('F', { type: 'READY_TO_VOTE', ready: true });
    expect(sim.phase).toBe('VOTE');
  });

  it('thảo luận theo lượt: từng người nói theo thứ tự rồi sang bỏ phiếu', () => {
    const sim = new Sim(DEFAULT_ROLES, { tweak: (c) => (c.rules.discussionMode = 'TURNS') });
    sim.toNight();
    sim.night();
    sim.tick();
    expect(sim.phase).toBe('DISCUSSION');
    expect(sim.view('A').publicInfo.currentSpeaker).toBe('A');
    expect(sim.tryAct('B', { type: 'DONE_SPEAKING' }).ok).toBe(false);
    sim.act('A', { type: 'DONE_SPEAKING' });
    expect(sim.view('A').publicInfo.currentSpeaker).toBe('B');
    sim.tick(); // B hết giờ
    expect(sim.view('A').publicInfo.currentSpeaker).toBe('C');
    for (const id of 'CDEFGH'.split('')) {
      if (sim.phase !== 'DISCUSSION') break;
      sim.act(id, { type: 'DONE_SPEAKING' });
    }
    expect(sim.phase).toBe('VOTE');
  });

  it('giơ tay / hạ tay', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night();
    sim.tick();
    sim.act('G', { type: 'RAISE_HAND', up: true });
    sim.act('H', { type: 'RAISE_HAND', up: true });
    expect(sim.view('A').publicInfo.raisedHands).toEqual(['G', 'H']);
    sim.act('G', { type: 'RAISE_HAND', up: false });
    expect(sim.view('A').publicInfo.raisedHands).toEqual(['H']);
  });
});

describe('Thợ săn', () => {
  it('bị treo thì được bắn một người; bắn xong sang đêm', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night();
    sim.toVote();
    sim.voteAll('F', 'A');
    expect(sim.phase).toBe('EXECUTION');
    sim.tick();
    expect(sim.phase).toBe('HUNTER_SHOT');
    expect(sim.view('F').myAction).toMatchObject({ kind: 'HUNTER_SHOOT' });
    expect(sim.view('G').myAction.kind).toBe('NONE');
    expect(sim.tryAct('G', { type: 'HUNTER_SHOOT', target: 'A' }).ok).toBe(false);
    sim.act('F', { type: 'HUNTER_SHOOT', target: 'A' });
    expect(sim.s.players.A?.alive).toBe(false);
    expect(sim.phase).toBe('NIGHT');
  });

  it('hết giờ không bắn thì không ai chết thêm', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night({ wolf: 'F' });
    sim.tick(); // hết bình minh -> Thợ săn bắn
    expect(sim.phase).toBe('HUNTER_SHOT');
    sim.tick();
    expect(sim.alive()).toHaveLength(7);
    expect(sim.phase).toBe('DISCUSSION');
  });

  it('bị đầu độc: bắn hay không tùy luật', () => {
    const on = new Sim();
    on.toNight();
    on.mainNight();
    on.tick();
    on.act('E', { type: 'WITCH_ACT', heal: false, poison: 'F' });
    on.tick();
    on.tick();
    expect(on.phase).toBe('HUNTER_SHOT');

    const off = new Sim(DEFAULT_ROLES, {
      tweak: (c) => (c.rules.hunterShootsWhenPoisoned = false),
    });
    off.toNight();
    off.mainNight();
    off.tick();
    off.act('E', { type: 'WITCH_ACT', heal: false, poison: 'F' });
    off.tick();
    off.tick();
    expect(off.phase).toBe('DISCUSSION');
  });

  it('phát bắn giết Sói cuối thì kết thúc ván, Dân thắng', () => {
    const roles = { A: 'WEREWOLF', C: 'SEER', D: 'GUARD', F: 'HUNTER', G: 'VILLAGER' } as const;
    const sim = new Sim({ ...roles });
    sim.toNight();
    sim.night({ wolf: 'F' });
    sim.tick();
    expect(sim.phase).toBe('HUNTER_SHOT');
    sim.act('F', { type: 'HUNTER_SHOOT', target: 'A' });
    expect(sim.phase).toBe('GAME_OVER');
    expect(sim.s.winner).toMatchObject({ winner: 'VILLAGE', reason: 'ALL_WOLVES_DEAD' });
  });
});

describe('thắng thua', () => {
  it('Dân thắng khi treo hết Sói', () => {
    const sim = new Sim();
    sim.toNight();
    sim.night();
    sim.toVote();
    sim.voteAll('A', 'B');
    sim.tick();
    sim.tickUntil('VOTE');
    sim.voteAll('B');
    sim.tick();
    expect(sim.phase).toBe('GAME_OVER');
    expect(sim.s.winner?.winner).toBe('VILLAGE');
    expect(sim.s.winner?.winners).toEqual(['C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('Sói thắng khi số Sói ≥ số người còn lại', () => {
    const roles = { A: 'WEREWOLF', C: 'SEER', D: 'GUARD', G: 'VILLAGER', H: 'VILLAGER' } as const;
    const sim = new Sim({ ...roles });
    sim.toNight();
    sim.night({ wolf: 'C' });
    expect(sim.s.winner).toBeNull();
    sim.tickUntil('NIGHT');
    sim.night({ wolf: 'D' });
    sim.tick(); // hết bình minh
    // còn A, G, H: 1 Sói < 2 người -> tiếp tục; cắn tiếp
    sim.tickUntil('NIGHT');
    sim.night({ wolf: 'G' });
    sim.tick();
    expect(sim.phase).toBe('GAME_OVER');
    expect(sim.s.winner).toMatchObject({ winner: 'WOLF', reason: 'WOLVES_OUTNUMBER' });
  });

  it('sau khi kết thúc, view lộ toàn bộ vai và dòng thời gian; trước đó thì không', () => {
    const sim = new Sim();
    expect(sim.view('G').gameOver).toBeUndefined();
    sim.toNight();
    sim.night({ seer: 'A' });
    expect(sim.view('G').gameOver).toBeUndefined();
    sim.toVote();
    sim.voteAll('A', 'B');
    sim.tick();
    sim.tickUntil('VOTE');
    sim.voteAll('B');
    sim.tick();
    const v = sim.view('G');
    expect(v.gameOver?.roles.A).toBe('WEREWOLF');
    expect(v.gameOver?.timeline.some((t) => t.kind === 'SEER' && t.result === 'WOLF')).toBe(true);
    expect(apply(sim.s, { type: 'HOST', command: { kind: 'PAUSE' } }, sim.now).ok).toBe(false);
  });
});

describe('chủ phòng loại người chơi', () => {
  it('loại người đang làm chậm bước đêm thì đêm có thể kết thúc sớm', () => {
    const sim = new Sim();
    sim.toNight();
    for (const id of ['A', 'B']) {
      sim.act(id, { type: 'WOLF_VOTE', target: 'G' });
      sim.act(id, { type: 'WOLF_LOCK' });
    }
    sim.act('C', { type: 'SEER_CHECK', target: null });
    sim.act('D', { type: 'GUARD_PROTECT', target: null });
    for (const id of ['E', 'F', 'G']) sim.act(id, { type: 'NIGHT_DUMMY', suspect: null });
    const before = sim.s.phase.deadlineAt;
    sim.run({ type: 'HOST', command: { kind: 'REMOVE_PLAYER', playerId: 'H' } });
    expect(sim.s.players.H?.alive).toBe(false);
    expect(sim.s.phase.deadlineAt).toBe(sim.s.phase.minEndAt);
    expect(sim.s.phase.deadlineAt).not.toBe(before);
  });

  it('loại Sói cuối cùng thì Dân thắng ngay', () => {
    const sim = new Sim();
    sim.toNight();
    sim.run({ type: 'HOST', command: { kind: 'REMOVE_PLAYER', playerId: 'A' } });
    expect(sim.phase).toBe('NIGHT');
    sim.run({ type: 'HOST', command: { kind: 'REMOVE_PLAYER', playerId: 'B' } });
    expect(sim.phase).toBe('GAME_OVER');
    expect(sim.s.winner?.winner).toBe('VILLAGE');
  });

  it('người bị loại không còn hành động được', () => {
    const sim = new Sim();
    sim.toNight();
    sim.run({ type: 'HOST', command: { kind: 'REMOVE_PLAYER', playerId: 'G' } });
    expect(sim.tryAct('G', { type: 'NIGHT_DUMMY', suspect: null }).ok).toBe(false);
  });
});

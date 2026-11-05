import {
  ROLE_TEAM,
  type DeathCause,
  type PhaseId,
  type PlayerId,
  type TimelineEntry,
  type VoteResult,
  type VoteTarget,
  type WinInfo,
} from '@masoi/shared';
import { pickOne, randInt, shuffle } from './rng';
import type { Ctx, DayState, GameState, NightState, PlayerState } from './state';

const SEC = 1000;

// ------------------------------------------------------------------ Tiện ích

export function P(s: GameState, id: PlayerId): PlayerState {
  const p = s.players[id];
  if (!p) throw new Error(`Không có người chơi ${id}`);
  return p;
}

export const isWolf = (p: PlayerState): boolean => ROLE_TEAM[p.role] === 'WOLF';

export function alivePlayers(s: GameState): PlayerState[] {
  return s.seatOrder.map((id) => P(s, id)).filter((p) => p.alive);
}

export function eligibleVoters(s: GameState): PlayerState[] {
  return alivePlayers(s).filter((p) => p.canVote);
}

export function freshNight(s: GameState, n: number): NightState {
  const night: NightState = {
    n,
    step: 'MAIN',
    wolfVotes: {},
    wolfLocked: {},
    wolfTarget: null,
    guardTarget: null,
    witchHeal: false,
    witchPoison: null,
    witchDone: false,
    submitted: {},
    dummyPicks: {},
  };
  for (const p of alivePlayers(s)) {
    night.submitted[p.id] = false;
    if (isWolf(p)) {
      night.wolfVotes[p.id] = null;
      night.wolfLocked[p.id] = false;
    }
  }
  return night;
}

export function freshDay(n: number): DayState {
  return {
    n,
    raisedHands: [],
    readyToVote: [],
    speakingOrder: [],
    speakerIdx: 0,
    votes: {},
    candidates: null,
    voteResult: null,
    executed: null,
  };
}

function setPhase(
  s: GameState,
  id: PhaseId,
  c: Ctx,
  seconds: number | null,
  minSeconds: number | null = null,
): void {
  s.phase = {
    id,
    seq: s.phase.seq + 1,
    startedAt: c.now,
    deadlineAt: seconds === null ? null : c.now + seconds * SEC,
    minEndAt: minSeconds === null ? null : c.now + minSeconds * SEC,
    paused: null,
  };
}

/** Rút ngắn hạn chót về `minEndAt` (hoặc ngay lập tức) khi mọi người đã xong. */
function finishEarly(s: GameState, c: Ctx): void {
  const target = Math.max(c.now, s.phase.minEndAt ?? c.now);
  if (s.phase.deadlineAt === null || target < s.phase.deadlineAt) s.phase.deadlineAt = target;
}

function log(s: GameState, entry: Omit<TimelineEntry, 'n' | 'step'>, step?: 'NIGHT' | 'DAY'): void {
  const inNight = s.phase.id === 'NIGHT' || s.phase.id === 'DAWN' || s.phase.id === 'ROLE_REVEAL';
  s.timeline.push({ n: s.turn, step: step ?? (inNight ? 'NIGHT' : 'DAY'), ...entry });
}

// ------------------------------------------------------------------ Cái chết & thắng thua

export function kill(s: GameState, id: PlayerId, cause: DeathCause): boolean {
  const p = P(s, id);
  if (!p.alive) return false;
  p.alive = false;
  p.death = { cause, n: s.turn };
  s.day.raisedHands = s.day.raisedHands.filter((x) => x !== id);
  s.day.readyToVote = s.day.readyToVote.filter((x) => x !== id);
  delete s.day.votes[id];
  log(s, { kind: 'DEATH', target: id, cause });
  const shoots =
    p.role === 'HUNTER' &&
    cause !== 'KICKED' &&
    (cause !== 'POISON' || s.config.rules.hunterShootsWhenPoisoned);
  if (shoots) s.pendingShots.push(id);
  return true;
}

export function checkWin(s: GameState): WinInfo | null {
  const all = Object.values(s.players);
  const alive = all.filter((p) => p.alive);
  if (alive.length === 0) return { winner: 'DRAW', reason: 'EVERYONE_DEAD', winners: [] };
  const wolves = alive.filter(isWolf).length;
  const others = alive.length - wolves;
  if (wolves === 0) {
    return {
      winner: 'VILLAGE',
      reason: 'ALL_WOLVES_DEAD',
      winners: all.filter((p) => !isWolf(p)).map((p) => p.id),
    };
  }
  if (wolves >= others) {
    return {
      winner: 'WOLF',
      reason: 'WOLVES_OUTNUMBER',
      winners: all.filter(isWolf).map((p) => p.id),
    };
  }
  return null;
}

export function endGame(s: GameState, c: Ctx, win: WinInfo): void {
  s.winner = win;
  s.pendingShots = [];
  setPhase(s, 'GAME_OVER', c, null);
  c.cues.push('GAME_OVER');
}

/** Sau khi có người chết (bình minh / xử tử): Thợ săn bắn → kiểm tra thắng → pha kế tiếp. */
function proceedAfterDeaths(s: GameState, c: Ctx, from: 'DAWN' | 'EXECUTION'): void {
  s.pendingShots = s.pendingShots.filter((id) => !P(s, id).removed);
  if (s.pendingShots.length > 0) {
    s.afterHunter = from;
    enterHunterShot(s, c);
    return;
  }
  const win = checkWin(s);
  if (win) return endGame(s, c, win);
  if (from === 'DAWN') enterDiscussion(s, c);
  else enterNight(s, c);
}

// ------------------------------------------------------------------ Xem vai

export function enterRoleReveal(s: GameState, c: Ctx): void {
  setPhase(s, 'ROLE_REVEAL', c, s.config.timers.roleReveal);
}

export function checkRoleRevealDone(s: GameState, c: Ctx): void {
  if (s.phase.id !== 'ROLE_REVEAL') return;
  const all = Object.values(s.players).filter((p) => p.alive);
  if (all.every((p) => s.acked[p.id])) enterNight(s, c);
}

// ------------------------------------------------------------------ Đêm

export function enterNight(s: GameState, c: Ctx): void {
  s.turn += 1;
  s.night = freshNight(s, s.turn);
  s.day = freshDay(s.turn);
  s.dawnDeaths = [];
  const t = s.config.timers;
  const lo = Math.min(t.nightMinMin, t.nightMinMax);
  const hi = Math.max(t.nightMinMin, t.nightMinMax);
  const minSec = Math.min(t.nightMain, lo + randInt(s, hi - lo + 1));
  setPhase(s, 'NIGHT', c, t.nightMain, minSec);
  c.cues.push('NIGHT_FALLS');
  checkNightMainDone(s, c);
}

export function mustActInMain(s: GameState, p: PlayerState): boolean {
  if (p.role === 'WEREWOLF' || p.role === 'SEER' || p.role === 'GUARD') return true;
  return s.config.rules.nightTaskForVillagers;
}

export function checkNightMainDone(s: GameState, c: Ctx): void {
  if (s.phase.id !== 'NIGHT' || s.night.step !== 'MAIN') return;
  const pending = alivePlayers(s).filter((p) => mustActInMain(s, p) && !s.night.submitted[p.id]);
  if (pending.length === 0) finishEarly(s, c);
}

export function checkWitchDone(s: GameState, c: Ctx): void {
  if (s.phase.id !== 'NIGHT' || s.night.step !== 'WITCH') return;
  if (s.night.witchDone) finishEarly(s, c);
}

/** Hết bước MAIN: chốt mục tiêu của bầy Sói rồi sang bước Phù thủy (nếu có vai này trong ván). */
export function endNightMain(s: GameState, c: Ctx): void {
  const wolves = alivePlayers(s).filter(isWolf);
  const counts = new Map<PlayerId, number>();
  for (const w of wolves) {
    const v = s.night.wolfVotes[w.id];
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let target: PlayerId | null = null;
  if (counts.size > 0) {
    const max = Math.max(...counts.values());
    const top = [...counts.entries()].filter(([, n]) => n === max).map(([id]) => id);
    target = top.length === 1 ? (top[0] as PlayerId) : pickOne(s, top);
  }
  if (s.config.rules.firstNightNoKill && s.turn === 1) target = null;
  s.night.wolfTarget = target;
  if (target) log(s, { kind: 'WOLF_TARGET', target });
  else log(s, { kind: 'NO_WOLF_TARGET' });

  if (s.config.roles.WITCH > 0) enterWitchStep(s, c);
  else resolveNight(s, c);
}

function enterWitchStep(s: GameState, c: Ctx): void {
  s.night.step = 'WITCH';
  const witch = Object.values(s.players).find((p) => p.role === 'WITCH');
  const canAct = !!witch && witch.alive && (witch.witch.heal || witch.witch.poison);
  const w = s.config.timers.witch;
  const lo = Math.round(w * 0.4);
  const hi = Math.max(lo, Math.round(w * 0.7));
  const minSec = lo + randInt(s, hi - lo + 1);
  setPhase(s, 'NIGHT', c, w, minSec);
  s.night.witchDone = !canAct;
  checkWitchDone(s, c);
}

export function resolveNight(s: GameState, c: Ctx): void {
  const { night } = s;
  const rules = s.config.rules;
  const victim = night.wolfTarget;
  const dying: { id: PlayerId; cause: DeathCause }[] = [];

  if (victim) {
    const guarded = night.guardTarget === victim;
    const healed = night.witchHeal;
    if (guarded && healed && rules.guardAndWitchSameTargetKills) {
      dying.push({ id: victim, cause: 'WOLF' });
    } else if (guarded || healed) {
      log(s, { kind: 'SAVED', target: victim });
    } else {
      dying.push({ id: victim, cause: 'WOLF' });
    }
  }
  // Bị cắn và bị đầu độc cùng lúc: chỉ chết một lần, nguyên nhân tính là Sói.
  if (night.witchPoison && !dying.some((d) => d.id === night.witchPoison)) {
    dying.push({ id: night.witchPoison, cause: 'POISON' });
  }

  const guard = Object.values(s.players).find((p) => p.role === 'GUARD' && p.alive);
  if (guard) guard.guardLast = night.guardTarget;

  const order = shuffle(s, dying);
  for (const d of order) kill(s, d.id, d.cause);
  s.dawnDeaths = order.map((d) => d.id);
  enterDawn(s, c);
}

function enterDawn(s: GameState, c: Ctx): void {
  s.history.push({ kind: 'NIGHT_DEATHS', n: s.turn, ids: [...s.dawnDeaths] });
  setPhase(s, 'DAWN', c, s.config.timers.dawn);
  c.cues.push('DAWN');
}

// ------------------------------------------------------------------ Thợ săn

function enterHunterShot(s: GameState, c: Ctx): void {
  setPhase(s, 'HUNTER_SHOT', c, s.config.timers.hunter);
  c.cues.push('HUNTER');
}

export function hunterShoot(s: GameState, c: Ctx, target: PlayerId | null): void {
  const shooter = s.pendingShots.shift();
  if (shooter === undefined) return;
  if (target && P(s, target).alive) {
    log(s, { kind: 'HUNTER_SHOT', actor: shooter, target });
    s.history.push({ kind: 'HUNTER_SHOT', n: s.turn, ids: [target], by: shooter });
    kill(s, target, 'HUNTER');
  }
  const win = checkWin(s);
  if (win) return endGame(s, c, win);
  s.pendingShots = s.pendingShots.filter((id) => !P(s, id).removed);
  if (s.pendingShots.length > 0) return enterHunterShot(s, c);
  proceedAfterDeaths(s, c, s.afterHunter);
}

// ------------------------------------------------------------------ Thảo luận

export function readyNeeded(s: GameState): number {
  return Math.max(1, Math.ceil((alivePlayers(s).length * 2) / 3));
}

export function currentSpeaker(s: GameState): PlayerId | null {
  if (s.phase.id !== 'DISCUSSION' || s.config.rules.discussionMode !== 'TURNS') return null;
  return s.day.speakingOrder[s.day.speakerIdx] ?? null;
}

export function enterDiscussion(s: GameState, c: Ctx): void {
  s.day = freshDay(s.turn);
  const alive = alivePlayers(s).map((p) => p.id);
  const shift = alive.length > 0 ? (s.turn - 1) % alive.length : 0;
  s.day.speakingOrder = [...alive.slice(shift), ...alive.slice(0, shift)];
  const t = s.config.timers;
  const turns = s.config.rules.discussionMode === 'TURNS';
  setPhase(s, 'DISCUSSION', c, turns ? t.turnPerPlayer : t.discussion);
}

export function checkDiscussionDone(s: GameState, c: Ctx): void {
  if (s.phase.id !== 'DISCUSSION') return;
  if (s.day.readyToVote.length >= readyNeeded(s)) enterVote(s, c, 'VOTE');
}

export function advanceSpeaker(s: GameState, c: Ctx): void {
  let idx = s.day.speakerIdx + 1;
  while (idx < s.day.speakingOrder.length && !P(s, s.day.speakingOrder[idx] as PlayerId).alive) {
    idx++;
  }
  s.day.speakerIdx = idx;
  if (idx >= s.day.speakingOrder.length) return enterVote(s, c, 'VOTE');
  setPhase(s, 'DISCUSSION', c, s.config.timers.turnPerPlayer);
}

// ------------------------------------------------------------------ Bỏ phiếu

export function enterVote(
  s: GameState,
  c: Ctx,
  kind: 'VOTE' | 'REVOTE',
  candidates: PlayerId[] | null = null,
): void {
  s.day.votes = {};
  for (const p of eligibleVoters(s)) s.day.votes[p.id] = null;
  s.day.candidates = candidates;
  const t = s.config.timers;
  setPhase(s, kind, c, kind === 'VOTE' ? t.vote : t.revote);
  c.cues.push('VOTE_START');
  checkVoteDone(s, c);
}

export function checkVoteDone(s: GameState, c: Ctx): void {
  if (s.phase.id !== 'VOTE' && s.phase.id !== 'REVOTE') return;
  const voters = Object.keys(s.day.votes);
  if (voters.every((id) => s.day.votes[id] !== null)) resolveVote(s, c);
}

export function resolveVote(s: GameState, c: Ctx): void {
  const isRevote = s.phase.id === 'REVOTE';
  const rules = s.config.rules;
  const ballots: Record<PlayerId, VoteTarget> = {};
  const tally: Record<string, number> = {};
  let voterCount = 0;
  for (const [voter, raw] of Object.entries(s.day.votes)) {
    voterCount++;
    let v: VoteTarget | null = raw;
    if (v !== null && v !== 'SKIP' && !P(s, v).alive) v = 'SKIP'; // mục tiêu đã bị loại giữa chừng
    if (v === null) v = rules.allowSkipVote ? 'SKIP' : null;
    if (v === null) continue;
    ballots[voter] = v;
    tally[v] = (tally[v] ?? 0) + 1;
  }

  let executed: PlayerId | null = null;
  let tied: PlayerId[] = [];
  let startRevote = false;
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter((k) => tally[k] === max);

  if (max > 0 && !top.includes('SKIP')) {
    const majorityOk = !rules.absoluteMajority || max * 2 > voterCount;
    if (top.length === 1) {
      if (majorityOk) executed = top[0] as PlayerId;
    } else {
      tied = top;
      if (rules.tieBreak === 'RANDOM') executed = pickOne(s, top);
      else if (rules.tieBreak === 'REVOTE' && !isRevote) startRevote = true;
    }
  }

  const result: VoteResult = {
    tally,
    ballots,
    executed,
    tiedCandidates: tied,
    revote: startRevote,
  };
  s.day.voteResult = result;
  if (startRevote) return enterVote(s, c, 'REVOTE', tied);
  enterExecution(s, c, result);
}

function enterExecution(s: GameState, c: Ctx, result: VoteResult): void {
  s.day.executed = result.executed;
  if (result.executed) {
    s.history.push({
      kind: 'EXECUTED',
      n: s.turn,
      ids: [result.executed],
      votes: result.tally[result.executed] ?? 0,
    });
    kill(s, result.executed, 'LYNCH');
  } else {
    s.history.push({ kind: 'NO_LYNCH', n: s.turn, ids: [] });
    log(s, { kind: 'NO_LYNCH' });
  }
  setPhase(s, 'EXECUTION', c, s.config.timers.execution);
  c.cues.push('EXECUTION');
}

// ------------------------------------------------------------------ Hết giờ

/** Được gọi khi đến hạn chót của pha hiện tại (hoặc chủ phòng bấm "Bỏ qua"). */
export function onPhaseExpired(s: GameState, c: Ctx): void {
  switch (s.phase.id) {
    case 'ROLE_REVEAL':
      return enterNight(s, c);
    case 'NIGHT':
      return s.night.step === 'MAIN' ? endNightMain(s, c) : resolveNight(s, c);
    case 'DAWN':
      return proceedAfterDeaths(s, c, 'DAWN');
    case 'HUNTER_SHOT':
      return hunterShoot(s, c, null);
    case 'DISCUSSION':
      return s.config.rules.discussionMode === 'TURNS'
        ? advanceSpeaker(s, c)
        : enterVote(s, c, 'VOTE');
    case 'VOTE':
    case 'REVOTE':
      return resolveVote(s, c);
    case 'EXECUTION':
      return proceedAfterDeaths(s, c, 'EXECUTION');
    case 'GAME_OVER':
      return;
  }
}

/** Sau khi một người bị loại (kick): kiểm tra thắng thua và các điều kiện hoàn thành pha. */
export function reevaluate(s: GameState, c: Ctx): void {
  if (s.winner) return;
  const win = checkWin(s);
  if (win) return endGame(s, c, win);
  switch (s.phase.id) {
    case 'ROLE_REVEAL':
      return checkRoleRevealDone(s, c);
    case 'NIGHT':
      if (s.night.step === 'MAIN') return checkNightMainDone(s, c);
      if (!alivePlayers(s).some((p) => p.role === 'WITCH')) s.night.witchDone = true;
      return checkWitchDone(s, c);
    case 'HUNTER_SHOT':
      s.pendingShots = s.pendingShots.filter((id) => !P(s, id).removed);
      if (s.pendingShots.length === 0) return proceedAfterDeaths(s, c, s.afterHunter);
      return;
    case 'DISCUSSION': {
      if (s.config.rules.discussionMode === 'TURNS') {
        const speaker = s.day.speakingOrder[s.day.speakerIdx];
        if (speaker !== undefined && !P(s, speaker).alive) {
          s.day.speakerIdx -= 1; // advanceSpeaker sẽ tăng lại
          return advanceSpeaker(s, c);
        }
      }
      return checkDiscussionDone(s, c);
    }
    case 'VOTE':
    case 'REVOTE':
      return checkVoteDone(s, c);
    default:
      return;
  }
}

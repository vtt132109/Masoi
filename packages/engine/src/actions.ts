import { ROLE_TEAM, type GameAction, type PlayerId } from '@masoi/shared';
import {
  P,
  advanceSpeaker,
  alivePlayers,
  checkDiscussionDone,
  checkNightMainDone,
  checkVoteDone,
  checkWitchDone,
  currentSpeaker,
  hunterShoot,
} from './phases';
import type { Ctx, EngineError, GameState, PlayerState } from './state';

type Res = EngineError | null;

const fail = (code: EngineError['code'], message: string): EngineError => ({ code, message });

const NOT_TURN = fail('NOT_YOUR_TURN', 'Chưa đến lượt hoặc vai của bạn không làm được việc này');
const BAD_TARGET = fail('INVALID_TARGET', 'Mục tiêu không hợp lệ');

function targetAlive(s: GameState, id: PlayerId | null | undefined): PlayerState | null {
  if (!id) return null;
  const p = s.players[id];
  return p && p.alive ? p : null;
}

// ------------------------------------------------------------------ Đêm

export function nightActionTargets(s: GameState, p: PlayerState): PlayerId[] {
  const rules = s.config.rules;
  const others = alivePlayers(s).filter((x) => x.id !== p.id);
  switch (p.role) {
    case 'WEREWOLF':
      return others.filter((x) => ROLE_TEAM[x.role] !== 'WOLF').map((x) => x.id);
    case 'SEER':
      return others
        .filter((x) => rules.seerCanRecheck || !p.seerChecks.some((c) => c.target === x.id))
        .map((x) => x.id);
    case 'GUARD':
      return alivePlayers(s)
        .filter((x) => rules.guardSelfProtect || x.id !== p.id)
        .filter((x) => rules.guardSameTargetTwice || x.id !== p.guardLast)
        .map((x) => x.id);
    default:
      return others.map((x) => x.id);
  }
}

export function handleNightAction(s: GameState, c: Ctx, p: PlayerState, action: GameAction): Res {
  if (!p.alive) return fail('DEAD_CANNOT_ACT', 'Bạn đã chết');
  const night = s.night;

  if (night.step === 'WITCH') {
    if (action.type !== 'WITCH_ACT' || p.role !== 'WITCH') return NOT_TURN;
    if (night.witchDone) return fail('ALREADY_USED', 'Bạn đã hành động rồi');
    const { heal, poison } = action;
    if (heal) {
      if (!p.witch.heal) return fail('ALREADY_USED', 'Bạn đã dùng hết bình cứu');
      if (!night.wolfTarget) return BAD_TARGET;
      if (!s.config.rules.witchSelfHeal && night.wolfTarget === p.id) {
        return fail('INVALID_TARGET', 'Luật không cho Phù thủy tự cứu mình');
      }
    }
    if (poison) {
      if (!p.witch.poison) return fail('ALREADY_USED', 'Bạn đã dùng hết bình độc');
      if (!targetAlive(s, poison) || poison === p.id) return BAD_TARGET;
    }
    if (heal && poison && !s.config.rules.witchBothPotionsSameNight) {
      return fail('INVALID_TARGET', 'Luật không cho dùng cả hai bình trong một đêm');
    }
    if (heal) {
      p.witch.heal = false;
      night.witchHeal = true;
      s.timeline.push({
        n: s.turn,
        step: 'NIGHT',
        kind: 'WITCH_HEAL',
        actor: p.id,
        target: night.wolfTarget as PlayerId,
      });
    }
    if (poison) {
      p.witch.poison = false;
      night.witchPoison = poison;
      s.timeline.push({
        n: s.turn,
        step: 'NIGHT',
        kind: 'WITCH_POISON',
        actor: p.id,
        target: poison,
      });
    }
    night.witchDone = true;
    checkWitchDone(s, c);
    return null;
  }

  // ---- Bước MAIN
  switch (action.type) {
    case 'WOLF_VOTE':
    case 'WOLF_LOCK': {
      if (p.role !== 'WEREWOLF') return NOT_TURN;
      if (night.wolfLocked[p.id]) return fail('ALREADY_USED', 'Bạn đã chốt lựa chọn rồi');
      if (action.type === 'WOLF_VOTE') {
        if (action.target !== null && !nightActionTargets(s, p).includes(action.target)) {
          return BAD_TARGET;
        }
        night.wolfVotes[p.id] = action.target;
      } else {
        night.wolfLocked[p.id] = true;
        night.submitted[p.id] = true;
      }
      checkNightMainDone(s, c);
      return null;
    }
    case 'SEER_CHECK': {
      if (p.role !== 'SEER') return NOT_TURN;
      if (night.submitted[p.id]) return fail('ALREADY_USED', 'Bạn đã soi rồi');
      if (action.target !== null) {
        if (!nightActionTargets(s, p).includes(action.target)) return BAD_TARGET;
        const t = P(s, action.target);
        const result = ROLE_TEAM[t.role] === 'WOLF' ? 'WOLF' : 'NOT_WOLF';
        p.seerChecks.push({ night: s.turn, target: t.id, result });
        s.timeline.push({
          n: s.turn,
          step: 'NIGHT',
          kind: 'SEER',
          actor: p.id,
          target: t.id,
          result,
        });
      }
      night.submitted[p.id] = true;
      checkNightMainDone(s, c);
      return null;
    }
    case 'GUARD_PROTECT': {
      if (p.role !== 'GUARD') return NOT_TURN;
      if (night.submitted[p.id]) return fail('ALREADY_USED', 'Bạn đã chọn rồi');
      if (action.target !== null) {
        if (!nightActionTargets(s, p).includes(action.target)) return BAD_TARGET;
        night.guardTarget = action.target;
        s.timeline.push({
          n: s.turn,
          step: 'NIGHT',
          kind: 'GUARD',
          actor: p.id,
          target: action.target,
        });
      }
      night.submitted[p.id] = true;
      checkNightMainDone(s, c);
      return null;
    }
    case 'NIGHT_DUMMY': {
      if (p.role === 'WEREWOLF' || p.role === 'SEER' || p.role === 'GUARD') return NOT_TURN;
      if (!s.config.rules.nightTaskForVillagers) return NOT_TURN;
      if (action.suspect !== null && (action.suspect === p.id || !targetAlive(s, action.suspect))) {
        return BAD_TARGET;
      }
      night.dummyPicks[p.id] = action.suspect;
      night.submitted[p.id] = true;
      checkNightMainDone(s, c);
      return null;
    }
    default:
      return NOT_TURN;
  }
}

// ------------------------------------------------------------------ Thợ săn

export function handleHunterAction(s: GameState, c: Ctx, p: PlayerState, action: GameAction): Res {
  if (action.type !== 'HUNTER_SHOOT') return NOT_TURN;
  if (s.pendingShots[0] !== p.id || p.removed) return NOT_TURN;
  if (action.target !== null && (!targetAlive(s, action.target) || action.target === p.id)) {
    return BAD_TARGET;
  }
  hunterShoot(s, c, action.target);
  return null;
}

// ------------------------------------------------------------------ Thảo luận

export function handleDiscussionAction(
  s: GameState,
  c: Ctx,
  p: PlayerState,
  action: GameAction,
): Res {
  if (!p.alive) return fail('DEAD_CANNOT_ACT', 'Bạn đã chết');
  switch (action.type) {
    case 'RAISE_HAND': {
      const has = s.day.raisedHands.includes(p.id);
      if (action.up && !has) s.day.raisedHands.push(p.id);
      if (!action.up && has) s.day.raisedHands = s.day.raisedHands.filter((x) => x !== p.id);
      return null;
    }
    case 'READY_TO_VOTE': {
      const has = s.day.readyToVote.includes(p.id);
      if (action.ready && !has) s.day.readyToVote.push(p.id);
      if (!action.ready && has) s.day.readyToVote = s.day.readyToVote.filter((x) => x !== p.id);
      checkDiscussionDone(s, c);
      return null;
    }
    case 'DONE_SPEAKING': {
      if (currentSpeaker(s) !== p.id) return NOT_TURN;
      advanceSpeaker(s, c);
      return null;
    }
    default:
      return NOT_TURN;
  }
}

// ------------------------------------------------------------------ Bỏ phiếu

export function handleVoteAction(s: GameState, c: Ctx, p: PlayerState, action: GameAction): Res {
  if (action.type !== 'VOTE') return NOT_TURN;
  if (!p.alive) return fail('DEAD_CANNOT_ACT', 'Bạn đã chết');
  if (!(p.id in s.day.votes)) return fail('NOT_YOUR_TURN', 'Bạn không có quyền bỏ phiếu');
  const t = action.target;
  if (t === 'SKIP') {
    if (!s.config.rules.allowSkipVote) return fail('INVALID_TARGET', 'Luật không cho bỏ qua phiếu');
  } else if (t !== null) {
    if (!targetAlive(s, t) || t === p.id) return BAD_TARGET;
    if (s.day.candidates && !s.day.candidates.includes(t)) return BAD_TARGET;
  }
  s.day.votes[p.id] = t;
  checkVoteDone(s, c);
  return null;
}

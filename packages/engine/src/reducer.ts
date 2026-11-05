import type { HostCommand } from '@masoi/shared';
import {
  handleDiscussionAction,
  handleHunterAction,
  handleNightAction,
  handleVoteAction,
} from './actions';
import { checkRoleRevealDone, kill, onPhaseExpired, reevaluate } from './phases';
import type { ApplyResult, Command, Ctx, EngineError, GameState } from './state';

const fail = (code: EngineError['code'], message: string): ApplyResult => ({
  ok: false,
  error: { code, message },
});

/**
 * Hàm thuần: (state, lệnh, thời gian) → state mới + các tín hiệu hiệu ứng.
 * Không đụng vào state truyền vào. Cùng seed + cùng chuỗi lệnh (kèm mốc thời gian) → cùng kết quả.
 */
export function apply(state: GameState, cmd: Command, now: number): ApplyResult {
  if (state.winner && !(cmd.type === 'TIMER')) {
    return fail('NO_GAME', 'Ván đấu đã kết thúc');
  }
  const s = structuredClone(state);
  const c: Ctx = { now, cues: [] };

  switch (cmd.type) {
    case 'ACK_ROLE': {
      const p = s.players[cmd.playerId];
      if (!p || p.removed) return fail('NOT_IN_ROOM', 'Bạn không ở trong ván này');
      if (cmd.phaseSeq !== s.phase.seq || s.phase.id !== 'ROLE_REVEAL') {
        return fail('STALE_PHASE', 'Pha này đã qua');
      }
      if (s.phase.paused) return fail('PAUSED', 'Ván đang tạm dừng');
      s.acked[p.id] = true;
      checkRoleRevealDone(s, c);
      break;
    }

    case 'ACTION': {
      const p = s.players[cmd.playerId];
      if (!p || p.removed) return fail('NOT_IN_ROOM', 'Bạn không ở trong ván này');
      if (cmd.phaseSeq !== s.phase.seq) return fail('STALE_PHASE', 'Pha này đã qua');
      if (s.phase.paused) return fail('PAUSED', 'Ván đang tạm dừng');
      let err: EngineError | null;
      switch (s.phase.id) {
        case 'NIGHT':
          err = handleNightAction(s, c, p, cmd.action);
          break;
        case 'HUNTER_SHOT':
          err = handleHunterAction(s, c, p, cmd.action);
          break;
        case 'DISCUSSION':
          err = handleDiscussionAction(s, c, p, cmd.action);
          break;
        case 'VOTE':
        case 'REVOTE':
          err = handleVoteAction(s, c, p, cmd.action);
          break;
        default:
          err = { code: 'NOT_YOUR_TURN', message: 'Lúc này chưa làm được việc đó' };
      }
      if (err) return { ok: false, error: err };
      break;
    }

    case 'TIMER': {
      // Hẹn giờ cũ (pha đã đổi) hoặc đang tạm dừng: bỏ qua, không phải lỗi.
      if (cmd.phaseSeq !== s.phase.seq || s.phase.paused || s.winner) {
        return { ok: true, state, cues: [] };
      }
      onPhaseExpired(s, c);
      break;
    }

    case 'HOST': {
      const err = applyHost(s, c, cmd.command);
      if (err) return { ok: false, error: err };
      break;
    }
  }

  return { ok: true, state: s, cues: c.cues };
}

function applyHost(s: GameState, c: Ctx, cmd: HostCommand): EngineError | null {
  const ph = s.phase;
  switch (cmd.kind) {
    case 'PAUSE': {
      if (ph.paused) return null;
      ph.paused = {
        remainingMs: ph.deadlineAt === null ? 0 : Math.max(0, ph.deadlineAt - c.now),
        minRemainingMs: ph.minEndAt === null ? null : Math.max(0, ph.minEndAt - c.now),
      };
      if (ph.deadlineAt !== null) ph.deadlineAt = null;
      return null;
    }
    case 'RESUME': {
      if (!ph.paused) return null;
      const { remainingMs, minRemainingMs } = ph.paused;
      ph.deadlineAt = c.now + remainingMs;
      ph.minEndAt = minRemainingMs === null ? null : c.now + minRemainingMs;
      ph.paused = null;
      return null;
    }
    case 'SKIP': {
      if (ph.paused) return { code: 'PAUSED', message: 'Ván đang tạm dừng' };
      onPhaseExpired(s, c);
      return null;
    }
    case 'EXTEND': {
      if (ph.paused) ph.paused.remainingMs += cmd.seconds * 1000;
      else if (ph.deadlineAt !== null) ph.deadlineAt += cmd.seconds * 1000;
      return null;
    }
    case 'REMOVE_PLAYER': {
      const p = s.players[cmd.playerId];
      if (!p || p.removed) return { code: 'INVALID_TARGET', message: 'Không có người chơi này' };
      p.removed = true;
      kill(s, p.id, 'KICKED');
      s.pendingShots = s.pendingShots.filter((id) => id !== p.id);
      delete s.day.votes[p.id];
      reevaluate(s, c);
      return null;
    }
  }
}

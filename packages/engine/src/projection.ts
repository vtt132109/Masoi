import {
  ROLE_TEAM,
  type MyAction,
  type PlayerId,
  type PlayerView,
  type ViewPlayer,
} from '@masoi/shared';
import { nightActionTargets } from './actions';
import { P, alivePlayers, currentSpeaker, isWolf, readyNeeded } from './phases';
import type { GameState, PlayerState } from './state';

/**
 * Chuyển state đầy đủ của server thành thứ DUY NHẤT mà `viewerId` được phép biết.
 * Đây là hàng rào chống lộ vai: client không bao giờ nhận GameState.
 */
export function projectFor(s: GameState, viewerId: PlayerId): PlayerView {
  const me = P(s, viewerId);
  const rules = s.config.rules;
  const over = s.winner !== null;
  const phaseId = s.phase.id;
  const inNight = phaseId === 'NIGHT';

  const players: ViewPlayer[] = s.seatOrder.map((id) => {
    const p = P(s, id);
    const revealed = over || (!p.alive && rules.revealRoleOnDeath) || id === viewerId;
    const view: ViewPlayer = {
      id,
      name: p.name,
      alive: p.alive,
      tags: isWolf(me) && isWolf(p) && id !== viewerId ? ['WOLF_ALLY'] : [],
    };
    if (revealed) view.revealedRole = p.role;
    return view;
  });

  const showDeaths = phaseId !== 'NIGHT' && phaseId !== 'ROLE_REVEAL';
  const lastDeaths = showDeaths
    ? s.dawnDeaths.map((id) => {
        const d: { id: PlayerId; role?: PlayerState['role'] } = { id };
        if (rules.revealRoleOnDeath || over) d.role = P(s, id).role;
        return d;
      })
    : [];

  const voting = phaseId === 'VOTE' || phaseId === 'REVOTE';
  const votes = Object.entries(s.day.votes);
  const view: PlayerView = {
    gameId: s.id,
    me: {
      id: me.id,
      name: me.name,
      role: me.role,
      team: ROLE_TEAM[me.role],
      alive: me.alive,
      canVote: me.canVote,
    },
    phase: {
      id: phaseId,
      seq: s.phase.seq,
      startedAt: s.phase.startedAt,
      deadlineAt: s.phase.deadlineAt,
      paused: s.phase.paused !== null,
      dayNumber: s.turn,
    },
    roleList: s.config.roles,
    players,
    myAction: myActionFor(s, me),
    privateInfo: {},
    publicInfo: {
      ackedCount: Object.values(s.acked).filter(Boolean).length,
      lastDeaths,
      raisedHands: phaseId === 'DISCUSSION' ? [...s.day.raisedHands] : [],
      readyToVoteCount: phaseId === 'DISCUSSION' ? s.day.readyToVote.length : 0,
      readyNeeded: readyNeeded(s),
      currentSpeaker: currentSpeaker(s),
      votedCount: voting ? votes.filter(([, v]) => v !== null).length : 0,
      voterCount: voting ? votes.length : 0,
      hunterShooter: phaseId === 'HUNTER_SHOT' ? (s.pendingShots[0] ?? null) : null,
      history: s.history.map((h) => ({ ...h, ids: [...h.ids] })),
    },
  };

  if (voting && rules.liveVotes) view.publicInfo.liveVotes = { ...s.day.votes };
  if ((phaseId === 'EXECUTION' || phaseId === 'REVOTE') && s.day.voteResult) {
    view.publicInfo.voteResult = s.day.voteResult;
  }
  if (phaseId === 'EXECUTION' && s.day.executed) {
    const e: { id: PlayerId; role?: PlayerState['role'] } = { id: s.day.executed };
    if (rules.revealRoleOnDeath) e.role = P(s, s.day.executed).role;
    view.publicInfo.executed = e;
  }

  // ---- Thông tin riêng theo vai
  const priv = view.privateInfo;
  if (me.role === 'SEER') priv.seerChecks = me.seerChecks.map((x) => ({ ...x }));
  if (me.role === 'GUARD') priv.guardLast = me.guardLast;
  if (me.role === 'WITCH') priv.witchPotions = { ...me.witch };
  if (me.role === 'WEREWOLF' && me.alive && inNight && s.night.step === 'MAIN') {
    // Chỉ Sói còn sống mới thấy lựa chọn của bầy; người chết không thấy (D6).
    const wolfVotes: Record<PlayerId, PlayerId | null> = {};
    const wolfLocked: Record<PlayerId, boolean> = {};
    for (const w of alivePlayers(s).filter(isWolf)) {
      wolfVotes[w.id] = s.night.wolfVotes[w.id] ?? null;
      wolfLocked[w.id] = s.night.wolfLocked[w.id] ?? false;
    }
    priv.wolfVotes = wolfVotes;
    priv.wolfLocked = wolfLocked;
  }

  if (over && s.winner) {
    const roles: Record<PlayerId, PlayerState['role']> = {};
    for (const id of s.seatOrder) roles[id] = P(s, id).role;
    view.gameOver = {
      win: { ...s.winner, winners: [...s.winner.winners] },
      roles,
      timeline: s.timeline.map((t) => ({ ...t })),
    };
  }

  return view;
}

function myActionFor(s: GameState, me: PlayerState): MyAction {
  const phase = s.phase.id;
  const night = s.night;

  switch (phase) {
    case 'ROLE_REVEAL':
      return { kind: 'ACK_ROLE', done: s.acked[me.id] === true };

    case 'NIGHT': {
      if (!me.alive) return { kind: 'NONE' };
      if (night.step === 'WITCH') {
        if (me.role !== 'WITCH') return { kind: 'NIGHT_WAIT' };
        const rules = s.config.rules;
        const victimVisible = me.witch.heal || rules.witchSeesVictimWithoutHeal;
        const victim = victimVisible ? night.wolfTarget : null;
        return {
          kind: 'WITCH_ACT',
          victim,
          canHeal:
            me.witch.heal &&
            night.wolfTarget !== null &&
            (rules.witchSelfHeal || night.wolfTarget !== me.id),
          canPoison: me.witch.poison,
          poisonTargets: me.witch.poison
            ? alivePlayers(s)
                .filter((p) => p.id !== me.id)
                .map((p) => p.id)
            : [],
          done: night.witchDone,
        };
      }
      const done = night.submitted[me.id] === true;
      switch (me.role) {
        case 'WEREWOLF':
          return {
            kind: 'WOLF_VOTE',
            targets: nightActionTargets(s, me),
            current: night.wolfVotes[me.id] ?? null,
            locked: night.wolfLocked[me.id] === true,
          };
        case 'SEER':
          return { kind: 'SEER_CHECK', targets: nightActionTargets(s, me), done };
        case 'GUARD':
          return { kind: 'GUARD_PROTECT', targets: nightActionTargets(s, me), done };
        default:
          return s.config.rules.nightTaskForVillagers
            ? { kind: 'NIGHT_DUMMY', targets: nightActionTargets(s, me), done }
            : { kind: 'NIGHT_WAIT' };
      }
    }

    case 'HUNTER_SHOT':
      if (s.pendingShots[0] === me.id) {
        return {
          kind: 'HUNTER_SHOOT',
          targets: alivePlayers(s)
            .filter((p) => p.id !== me.id)
            .map((p) => p.id),
        };
      }
      return { kind: 'NONE' };

    case 'DISCUSSION':
      if (!me.alive) return { kind: 'NONE' };
      return {
        kind: 'DISCUSS',
        handUp: s.day.raisedHands.includes(me.id),
        readyToVote: s.day.readyToVote.includes(me.id),
        isSpeaker: currentSpeaker(s) === me.id,
      };

    case 'VOTE':
    case 'REVOTE': {
      if (!me.alive || !(me.id in s.day.votes)) return { kind: 'NONE' };
      const base = s.day.candidates ?? alivePlayers(s).map((p) => p.id);
      return {
        kind: 'VOTE',
        targets: base.filter((id) => id !== me.id),
        skipAllowed: s.config.rules.allowSkipVote,
        current: s.day.votes[me.id] ?? null,
      };
    }

    default:
      return { kind: 'NONE' };
  }
}

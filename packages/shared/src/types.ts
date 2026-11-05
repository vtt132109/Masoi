// Các kiểu dùng chung cho engine, server và web.

export type PlayerId = string;
export type RoomCode = string;

export const ROLE_IDS = ['VILLAGER', 'WEREWOLF', 'SEER', 'GUARD', 'WITCH', 'HUNTER'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export type Team = 'VILLAGE' | 'WOLF';
export type WinnerTeam = Team | 'DRAW';

export const ROLE_TEAM: Record<RoleId, Team> = {
  VILLAGER: 'VILLAGE',
  SEER: 'VILLAGE',
  GUARD: 'VILLAGE',
  WITCH: 'VILLAGE',
  HUNTER: 'VILLAGE',
  WEREWOLF: 'WOLF',
};

/** Trọng số cho thước đo cân bằng (dương = lợi cho Dân, âm = lợi cho Sói). */
export const ROLE_WEIGHT: Record<RoleId, number> = {
  VILLAGER: 1,
  SEER: 7,
  GUARD: 3,
  WITCH: 4,
  HUNTER: 3,
  WEREWOLF: -6,
};

/** Vai chỉ được có tối đa bấy nhiêu lá. */
export const MAX_PER_ROLE: Partial<Record<RoleId, number>> = {
  SEER: 1,
  GUARD: 1,
  WITCH: 1,
  HUNTER: 1,
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;

export type PhaseId =
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAWN'
  | 'HUNTER_SHOT'
  | 'DISCUSSION'
  | 'VOTE'
  | 'REVOTE'
  | 'EXECUTION'
  | 'GAME_OVER';

export type DeathCause = 'WOLF' | 'POISON' | 'LYNCH' | 'HUNTER' | 'KICKED';

// ---------------------------------------------------------------- Cấu hình ván

export type PlayMode = 'IN_PERSON' | 'REMOTE';
export type TieBreak = 'NO_LYNCH' | 'REVOTE' | 'RANDOM';
export type DiscussionMode = 'FREE' | 'TURNS';

/** Tất cả thời gian tính bằng giây. */
export interface Timers {
  roleReveal: number;
  nightMain: number;
  witch: number;
  hunter: number;
  dawn: number;
  discussion: number;
  turnPerPlayer: number;
  vote: number;
  revote: number;
  execution: number;
  /** Đêm kéo dài ngẫu nhiên tối thiểu trong khoảng này, kể cả khi mọi người đã xong. */
  nightMinMin: number;
  nightMinMax: number;
}

export interface Rules {
  revealRoleOnDeath: boolean;
  /** D6: người chết KHÔNG được xem vai người còn sống. Giữ cờ để mở rộng, mặc định false. */
  deadSeeAllRoles: boolean;
  tieBreak: TieBreak;
  discussionMode: DiscussionMode;
  liveVotes: boolean;
  allowSkipVote: boolean;
  absoluteMajority: boolean;
  firstNightNoKill: boolean;
  guardSelfProtect: boolean;
  guardSameTargetTwice: boolean;
  guardAndWitchSameTargetKills: boolean;
  witchSelfHeal: boolean;
  witchBothPotionsSameNight: boolean;
  witchSeesVictimWithoutHeal: boolean;
  hunterShootsWhenPoisoned: boolean;
  seerCanRecheck: boolean;
  nightTaskForVillagers: boolean;
}

export interface GameConfig {
  playMode: PlayMode;
  voiceCallUrl: string | null;
  speakerDeviceId: PlayerId | null;
  roles: Record<RoleId, number>;
  timers: Timers;
  rules: Rules;
}

// ---------------------------------------------------------------- Hành động

export type VoteTarget = PlayerId | 'SKIP';

export type GameAction =
  | { type: 'WOLF_VOTE'; target: PlayerId | null }
  | { type: 'WOLF_LOCK' }
  | { type: 'SEER_CHECK'; target: PlayerId | null }
  | { type: 'GUARD_PROTECT'; target: PlayerId | null }
  | { type: 'WITCH_ACT'; heal: boolean; poison: PlayerId | null }
  | { type: 'NIGHT_DUMMY'; suspect: PlayerId | null }
  | { type: 'HUNTER_SHOOT'; target: PlayerId | null }
  | { type: 'RAISE_HAND'; up: boolean }
  | { type: 'DONE_SPEAKING' }
  | { type: 'READY_TO_VOTE'; ready: boolean }
  | { type: 'VOTE'; target: VoteTarget | null };

export type HostCommand =
  | { kind: 'PAUSE' }
  | { kind: 'RESUME' }
  | { kind: 'SKIP' }
  | { kind: 'EXTEND'; seconds: number }
  | { kind: 'REMOVE_PLAYER'; playerId: PlayerId };

// ---------------------------------------------------------------- PlayerView

export type PlayerTag = 'WOLF_ALLY';

export interface ViewPlayer {
  id: PlayerId;
  name: string;
  alive: boolean;
  /** Chỉ có khi vai đã được công bố (người chết khi bật revealRoleOnDeath, hoặc hết ván). */
  revealedRole?: RoleId;
  tags: PlayerTag[];
}

export type MyAction =
  | { kind: 'NONE' }
  | { kind: 'ACK_ROLE'; done: boolean }
  | { kind: 'WOLF_VOTE'; targets: PlayerId[]; current: PlayerId | null; locked: boolean }
  | { kind: 'SEER_CHECK'; targets: PlayerId[]; done: boolean }
  | { kind: 'GUARD_PROTECT'; targets: PlayerId[]; done: boolean }
  | { kind: 'NIGHT_DUMMY'; targets: PlayerId[]; done: boolean }
  | {
      kind: 'WITCH_ACT';
      victim: PlayerId | null;
      canHeal: boolean;
      canPoison: boolean;
      poisonTargets: PlayerId[];
      done: boolean;
    }
  | { kind: 'NIGHT_WAIT' }
  | { kind: 'HUNTER_SHOOT'; targets: PlayerId[] }
  | {
      kind: 'VOTE';
      targets: PlayerId[];
      skipAllowed: boolean;
      current: VoteTarget | null;
    }
  | { kind: 'DISCUSS'; handUp: boolean; readyToVote: boolean; isSpeaker: boolean };

export interface SeerCheck {
  night: number;
  target: PlayerId;
  result: 'WOLF' | 'NOT_WOLF';
}

export interface VoteResult {
  tally: Record<string, number>; // key = PlayerId | 'SKIP'
  ballots: Record<PlayerId, VoteTarget>;
  executed: PlayerId | null;
  tiedCandidates: PlayerId[];
  revote: boolean;
}

export interface HistoryEntry {
  kind: 'NIGHT_DEATHS' | 'EXECUTED' | 'NO_LYNCH' | 'HUNTER_SHOT';
  /** Số của đêm hoặc ngày xảy ra. */
  n: number;
  ids: PlayerId[];
  by?: PlayerId;
  votes?: number;
}

export interface TimelineEntry {
  n: number;
  step: 'NIGHT' | 'DAY';
  kind:
    | 'WOLF_TARGET'
    | 'NO_WOLF_TARGET'
    | 'GUARD'
    | 'SEER'
    | 'WITCH_HEAL'
    | 'WITCH_POISON'
    | 'SAVED'
    | 'DEATH'
    | 'LYNCH'
    | 'NO_LYNCH'
    | 'HUNTER_SHOT';
  actor?: PlayerId;
  target?: PlayerId;
  cause?: DeathCause;
  result?: 'WOLF' | 'NOT_WOLF';
}

export interface WinInfo {
  winner: WinnerTeam;
  reason: 'ALL_WOLVES_DEAD' | 'WOLVES_OUTNUMBER' | 'EVERYONE_DEAD' | 'ABORTED';
  winners: PlayerId[];
}

export interface PlayerView {
  gameId: string;
  me: { id: PlayerId; name: string; role: RoleId; team: Team; alive: boolean; canVote: boolean };
  phase: {
    id: PhaseId;
    seq: number;
    startedAt: number;
    deadlineAt: number | null;
    paused: boolean;
    dayNumber: number;
  };
  roleList: Record<RoleId, number>;
  players: ViewPlayer[];
  myAction: MyAction;
  privateInfo: {
    wolfVotes?: Record<PlayerId, PlayerId | null>;
    wolfLocked?: Record<PlayerId, boolean>;
    seerChecks?: SeerCheck[];
    guardLast?: PlayerId | null;
    witchPotions?: { heal: boolean; poison: boolean };
  };
  publicInfo: {
    ackedCount: number;
    lastDeaths: { id: PlayerId; role?: RoleId }[];
    raisedHands: PlayerId[];
    readyToVoteCount: number;
    readyNeeded: number;
    currentSpeaker: PlayerId | null;
    votedCount: number;
    voterCount: number;
    liveVotes?: Record<PlayerId, VoteTarget | null>;
    voteResult?: VoteResult;
    executed?: { id: PlayerId; role?: RoleId };
    hunterShooter: PlayerId | null;
    history: HistoryEntry[];
  };
  gameOver?: {
    win: WinInfo;
    roles: Record<PlayerId, RoleId>;
    timeline: TimelineEntry[];
  };
}

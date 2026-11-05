import type {
  DeathCause,
  GameAction,
  GameConfig,
  GameCue,
  HistoryEntry,
  HostCommand,
  PhaseId,
  PlayerId,
  RoleId,
  SeerCheck,
  TimelineEntry,
  VoteResult,
  VoteTarget,
  WinInfo,
  ErrorCode,
} from '@masoi/shared';

export interface PlayerState {
  id: PlayerId;
  name: string;
  role: RoleId;
  alive: boolean;
  /** Bị chủ phòng loại khỏi ván: không còn hành động được nữa (kể cả Thợ săn). */
  removed: boolean;
  death?: { cause: DeathCause; n: number };
  canVote: boolean;
  seerChecks: SeerCheck[];
  guardLast: PlayerId | null;
  witch: { heal: boolean; poison: boolean };
}

export interface NightState {
  n: number;
  /** Bước trong đêm: MAIN (Sói, Bảo vệ, Tiên tri, nhiệm vụ giả) rồi WITCH. Không công khai. */
  step: 'MAIN' | 'WITCH';
  wolfVotes: Record<PlayerId, PlayerId | null>;
  wolfLocked: Record<PlayerId, boolean>;
  wolfTarget: PlayerId | null;
  guardTarget: PlayerId | null;
  witchHeal: boolean;
  witchPoison: PlayerId | null;
  witchDone: boolean;
  /** Người chơi đã hoàn thành phần việc bắt buộc của bước MAIN. */
  submitted: Record<PlayerId, boolean>;
  dummyPicks: Record<PlayerId, PlayerId | null>;
}

export interface DayState {
  n: number;
  raisedHands: PlayerId[];
  readyToVote: PlayerId[];
  speakingOrder: PlayerId[];
  speakerIdx: number;
  /** Phiếu của những người đủ điều kiện bỏ phiếu. null = chưa chọn. */
  votes: Record<PlayerId, VoteTarget | null>;
  /** Chỉ có ở vòng bỏ phiếu lại: danh sách ứng viên. */
  candidates: PlayerId[] | null;
  voteResult: VoteResult | null;
  executed: PlayerId | null;
}

export interface PhaseState {
  id: PhaseId;
  seq: number;
  startedAt: number;
  deadlineAt: number | null;
  /** Thời điểm sớm nhất được kết thúc pha (dùng cho đêm để chống đoán vai theo thời gian). */
  minEndAt: number | null;
  paused: { remainingMs: number; minRemainingMs: number | null } | null;
}

export interface GameState {
  id: string;
  seed: number;
  rng: number;
  config: GameConfig;
  phase: PhaseState;
  /** Số đêm/ngày hiện tại: Đêm 1 → Ngày 1 → Đêm 2 → ... */
  turn: number;
  players: Record<PlayerId, PlayerState>;
  seatOrder: PlayerId[];
  acked: Record<PlayerId, boolean>;
  night: NightState;
  day: DayState;
  dawnDeaths: PlayerId[];
  pendingShots: PlayerId[];
  afterHunter: 'DAWN' | 'EXECUTION';
  winner: WinInfo | null;
  history: HistoryEntry[];
  timeline: TimelineEntry[];
}

export type Command =
  | { type: 'ACK_ROLE'; playerId: PlayerId; phaseSeq: number }
  | { type: 'ACTION'; playerId: PlayerId; phaseSeq: number; action: GameAction }
  | { type: 'TIMER'; phaseSeq: number }
  | { type: 'HOST'; command: HostCommand };

export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type ApplyResult =
  { ok: true; state: GameState; cues: GameCue[] } | { ok: false; error: EngineError };

export interface Ctx {
  now: number;
  cues: GameCue[];
}

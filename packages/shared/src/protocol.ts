import { z } from 'zod';
import { GameConfigPatchSchema } from './config';
import type { GameConfig, PlayerId, PlayerView, RoomCode } from './types';

// ---------------------------------------------------------------- Schema chung

export const PlayerIdSchema = z.string().min(1).max(40);
export const NicknameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(2).max(16));
export const AvatarSchema = z.number().int().min(0).max(23);
export const RoomCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-HJ-NP-Z]{5}$/));

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WOLF_VOTE'), target: PlayerIdSchema.nullable() }),
  z.object({ type: z.literal('WOLF_LOCK') }),
  z.object({ type: z.literal('SEER_CHECK'), target: PlayerIdSchema.nullable() }),
  z.object({ type: z.literal('GUARD_PROTECT'), target: PlayerIdSchema.nullable() }),
  z.object({
    type: z.literal('WITCH_ACT'),
    heal: z.boolean(),
    poison: PlayerIdSchema.nullable(),
  }),
  z.object({ type: z.literal('NIGHT_DUMMY'), suspect: PlayerIdSchema.nullable() }),
  z.object({ type: z.literal('HUNTER_SHOOT'), target: PlayerIdSchema.nullable() }),
  z.object({ type: z.literal('RAISE_HAND'), up: z.boolean() }),
  z.object({ type: z.literal('DONE_SPEAKING') }),
  z.object({ type: z.literal('READY_TO_VOTE'), ready: z.boolean() }),
  z.object({
    type: z.literal('VOTE'),
    target: z.union([PlayerIdSchema, z.literal('SKIP')]).nullable(),
  }),
]);

export const HostCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PAUSE') }),
  z.object({ kind: z.literal('RESUME') }),
  z.object({ kind: z.literal('SKIP') }),
  z.object({ kind: z.literal('EXTEND'), seconds: z.number().int().min(5).max(300) }),
  z.object({ kind: z.literal('REMOVE_PLAYER'), playerId: PlayerIdSchema }),
]);

// ---------------------------------------------------------------- Client -> Server

export const ClientEvents = {
  sessionResume: 'session:resume',
  timePing: 'time:ping',
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  roomSetReady: 'room:setReady',
  roomUpdateProfile: 'room:updateProfile',
  roomUpdateConfig: 'room:updateConfig',
  roomKick: 'room:kick',
  roomTransferHost: 'room:transferHost',
  roomAddBot: 'room:addBot',
  roomRemoveBot: 'room:removeBot',
  gameStart: 'game:start',
  gameAckRole: 'game:ackRole',
  gameAction: 'game:action',
  gameHost: 'game:host',
  gameBackToLobby: 'game:backToLobby',
} as const;

export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];

export const ClientPayloads = {
  [ClientEvents.sessionResume]: z.object({
    roomCode: RoomCodeSchema,
    token: z.string().min(16).max(128),
  }),
  [ClientEvents.timePing]: z.object({ clientTs: z.number() }),
  [ClientEvents.roomCreate]: z.object({ nickname: NicknameSchema, avatar: AvatarSchema }),
  [ClientEvents.roomJoin]: z.object({
    roomCode: RoomCodeSchema,
    nickname: NicknameSchema,
    avatar: AvatarSchema,
  }),
  [ClientEvents.roomLeave]: z.object({}),
  [ClientEvents.roomSetReady]: z.object({ ready: z.boolean() }),
  [ClientEvents.roomUpdateProfile]: z.object({
    nickname: NicknameSchema.optional(),
    avatar: AvatarSchema.optional(),
  }),
  [ClientEvents.roomUpdateConfig]: z.object({
    patch: GameConfigPatchSchema,
    /** Bật lại chế độ tự gợi ý bộ vai theo số người. */
    autoRoles: z.boolean().optional(),
  }),
  [ClientEvents.roomKick]: z.object({ playerId: PlayerIdSchema }),
  [ClientEvents.roomTransferHost]: z.object({ playerId: PlayerIdSchema }),
  [ClientEvents.roomAddBot]: z.object({}),
  [ClientEvents.roomRemoveBot]: z.object({ playerId: PlayerIdSchema }),
  [ClientEvents.gameStart]: z.object({}),
  [ClientEvents.gameAckRole]: z.object({ phaseSeq: z.number().int() }),
  [ClientEvents.gameAction]: z.object({ phaseSeq: z.number().int(), action: GameActionSchema }),
  [ClientEvents.gameHost]: z.object({ command: HostCommandSchema }),
  [ClientEvents.gameBackToLobby]: z.object({}),
} as const;

// ---------------------------------------------------------------- Server -> Client

export const ServerEvents = {
  roomView: 'room:view',
  gameView: 'game:view',
  gameCue: 'game:cue',
  roomKicked: 'room:kicked',
  sessionReplaced: 'session:replaced',
  serverNotice: 'server:notice',
} as const;

export type GameCue = 'NIGHT_FALLS' | 'DAWN' | 'VOTE_START' | 'EXECUTION' | 'HUNTER' | 'GAME_OVER';

export interface MemberView {
  id: PlayerId;
  nickname: string;
  avatar: number;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  /** Đã rời phòng giữa ván (vẫn nằm trong ván đang chơi cho đến khi kết thúc). */
  left: boolean;
  /** Mốc mất kết nối (epoch ms), null nếu đang kết nối. */
  disconnectedAt: number | null;
}

export interface RoomView {
  code: RoomCode;
  hostId: PlayerId;
  status: 'LOBBY' | 'IN_GAME';
  members: MemberView[];
  config: GameConfig;
  /** Bộ vai đang tự gợi ý theo số người. */
  autoRoles: boolean;
  allowBots: boolean;
  /** Thiết bị phát âm thanh chung ở chế độ Cùng phòng (đã quy về chủ phòng nếu chưa chọn). */
  speakerId: PlayerId;
}

export interface ServerNotice {
  level: 'info' | 'warn';
  code: string;
  params?: Record<string, string | number>;
}

export interface ServerToClient {
  [ServerEvents.roomView]: (view: RoomView) => void;
  [ServerEvents.gameView]: (view: PlayerView) => void;
  [ServerEvents.gameCue]: (cue: { kind: GameCue; seq: number }) => void;
  [ServerEvents.roomKicked]: (info: { reason: 'KICKED' | 'REMOVED' }) => void;
  [ServerEvents.sessionReplaced]: () => void;
  [ServerEvents.serverNotice]: (notice: ServerNotice) => void;
}

// ---------------------------------------------------------------- Kết quả & lỗi

export const ErrorCodes = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_IN_GAME',
  'NICKNAME_TAKEN',
  'NOT_HOST',
  'NOT_IN_ROOM',
  'INVALID_CONFIG',
  'NOT_ENOUGH_PLAYERS',
  'NOT_READY',
  'BOTS_DISABLED',
  'NO_GAME',
  'NOT_YOUR_TURN',
  'STALE_PHASE',
  'INVALID_TARGET',
  'ALREADY_USED',
  'DEAD_CANNOT_ACT',
  'PAUSED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'BAD_SESSION',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ErrorCodes)[number];

export type Ack<T = undefined> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

export interface JoinResult {
  roomCode: RoomCode;
  playerId: PlayerId;
  token: string;
}

export interface ResumeResult {
  playerId: PlayerId;
  room: RoomView;
  game: PlayerView | null;
}

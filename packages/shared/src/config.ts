import { z } from 'zod';
import {
  MAX_PER_ROLE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLE_IDS,
  ROLE_TEAM,
  ROLE_WEIGHT,
  type GameConfig,
  type RoleId,
} from './types';

export const DEFAULT_TIMERS = {
  roleReveal: 20,
  nightMain: 35,
  witch: 20,
  hunter: 20,
  dawn: 8,
  discussion: 180,
  turnPerPlayer: 45,
  vote: 45,
  revote: 30,
  execution: 10,
  nightMinMin: 20,
  nightMinMax: 28,
} as const;

export const DEFAULT_RULES = {
  revealRoleOnDeath: true,
  deadSeeAllRoles: false, // D6: người chết không xem vai
  tieBreak: 'NO_LYNCH',
  discussionMode: 'FREE',
  liveVotes: false,
  allowSkipVote: true,
  absoluteMajority: false,
  firstNightNoKill: false,
  guardSelfProtect: true,
  guardSameTargetTwice: false,
  guardAndWitchSameTargetKills: false,
  witchSelfHeal: true,
  witchBothPotionsSameNight: true,
  witchSeesVictimWithoutHeal: true,
  hunterShootsWhenPoisoned: true,
  seerCanRecheck: true,
  nightTaskForVillagers: true,
} as const;

export function emptyRoles(): Record<RoleId, number> {
  return Object.fromEntries(ROLE_IDS.map((r) => [r, 0])) as Record<RoleId, number>;
}

/** Gợi ý bộ vai theo số người chơi (bảng ở mục 3.8 của kế hoạch, phần MVP). */
export function suggestRoles(n: number): Record<RoleId, number> {
  const roles = emptyRoles();
  const count = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.round(n)));
  const wolves =
    count <= 7 ? (count <= 5 ? 1 : 2) : count <= 9 ? 2 : count <= 14 ? 3 : count <= 17 ? 4 : 5;
  roles.WEREWOLF = wolves;
  roles.SEER = 1;
  roles.GUARD = 1;
  if (count >= 6) roles.WITCH = 1;
  if (count >= 8) roles.HUNTER = 1;
  const special = roles.SEER + roles.GUARD + roles.WITCH + roles.HUNTER;
  roles.VILLAGER = count - wolves - special;
  return roles;
}

export function defaultConfig(playerCount = 8): GameConfig {
  return {
    playMode: 'IN_PERSON',
    voiceCallUrl: null,
    speakerDeviceId: null,
    roles: suggestRoles(playerCount),
    timers: { ...DEFAULT_TIMERS },
    rules: { ...DEFAULT_RULES },
  };
}

export function totalRoles(roles: Record<RoleId, number>): number {
  return ROLE_IDS.reduce((sum, r) => sum + (roles[r] ?? 0), 0);
}

/** Điểm cân bằng: gần 0 là cân bằng, dương nghiêng về Dân, âm nghiêng về Sói. */
export function balanceScore(roles: Record<RoleId, number>): number {
  return ROLE_IDS.reduce((sum, r) => sum + (roles[r] ?? 0) * ROLE_WEIGHT[r], 0);
}

// ---------------------------------------------------------------- Zod

const sec = (min: number, max: number) => z.number().int().min(min).max(max);

const TimersSchema = z.object({
  roleReveal: sec(5, 120),
  nightMain: sec(10, 120),
  witch: sec(5, 90),
  hunter: sec(5, 90),
  dawn: sec(3, 30),
  discussion: sec(15, 900),
  turnPerPlayer: sec(10, 180),
  vote: sec(10, 180),
  revote: sec(10, 120),
  execution: sec(3, 30),
  nightMinMin: sec(0, 120),
  nightMinMax: sec(0, 120),
});

const RulesSchema = z.object({
  revealRoleOnDeath: z.boolean(),
  deadSeeAllRoles: z.boolean(),
  tieBreak: z.enum(['NO_LYNCH', 'REVOTE', 'RANDOM']),
  discussionMode: z.enum(['FREE', 'TURNS']),
  liveVotes: z.boolean(),
  allowSkipVote: z.boolean(),
  absoluteMajority: z.boolean(),
  firstNightNoKill: z.boolean(),
  guardSelfProtect: z.boolean(),
  guardSameTargetTwice: z.boolean(),
  guardAndWitchSameTargetKills: z.boolean(),
  witchSelfHeal: z.boolean(),
  witchBothPotionsSameNight: z.boolean(),
  witchSeesVictimWithoutHeal: z.boolean(),
  hunterShootsWhenPoisoned: z.boolean(),
  seerCanRecheck: z.boolean(),
  nightTaskForVillagers: z.boolean(),
});

const RolesSchema = z.object({
  VILLAGER: z.number().int().min(0).max(MAX_PLAYERS),
  WEREWOLF: z.number().int().min(0).max(MAX_PLAYERS),
  SEER: z.number().int().min(0).max(MAX_PLAYERS),
  GUARD: z.number().int().min(0).max(MAX_PLAYERS),
  WITCH: z.number().int().min(0).max(MAX_PLAYERS),
  HUNTER: z.number().int().min(0).max(MAX_PLAYERS),
});

/** Chỉ cho phép link https, tối đa 300 ký tự (link cuộc gọi ngoài ở chế độ Từ xa). */
export const VoiceUrlSchema = z
  .string()
  .max(300)
  .url()
  .refine((u) => u.startsWith('https://'), 'Link phải bắt đầu bằng https://');

export const GameConfigSchema = z.object({
  playMode: z.enum(['IN_PERSON', 'REMOTE']),
  voiceCallUrl: VoiceUrlSchema.nullable(),
  speakerDeviceId: z.string().max(32).nullable(),
  roles: RolesSchema,
  timers: TimersSchema,
  rules: RulesSchema,
});

export const GameConfigPatchSchema = z
  .object({
    playMode: z.enum(['IN_PERSON', 'REMOTE']),
    voiceCallUrl: VoiceUrlSchema.nullable(),
    speakerDeviceId: z.string().max(32).nullable(),
    roles: RolesSchema.partial(),
    timers: TimersSchema.partial(),
    rules: RulesSchema.partial(),
  })
  .partial()
  .strict();

export type GameConfigPatch = z.infer<typeof GameConfigPatchSchema>;

export function mergeConfig(base: GameConfig, patch: GameConfigPatch): GameConfig {
  return {
    playMode: patch.playMode ?? base.playMode,
    voiceCallUrl: patch.voiceCallUrl === undefined ? base.voiceCallUrl : patch.voiceCallUrl,
    speakerDeviceId:
      patch.speakerDeviceId === undefined ? base.speakerDeviceId : patch.speakerDeviceId,
    roles: { ...base.roles, ...(patch.roles ?? {}) } as GameConfig['roles'],
    timers: { ...base.timers, ...(patch.timers ?? {}) },
    rules: { ...base.rules, ...(patch.rules ?? {}) } as GameConfig['rules'],
  };
}

export type ConfigIssue =
  'PLAYER_COUNT' | 'ROLE_SUM' | 'NO_WOLF' | 'WOLVES_TOO_MANY' | 'ROLE_LIMIT' | 'TIMER_RANGE';

export interface ConfigProblem {
  code: ConfigIssue;
  role?: RoleId;
  detail?: string;
}

/** Kiểm tra cấu hình có chơi được với `playerCount` người không. Rỗng = hợp lệ. */
export function validateConfig(config: GameConfig, playerCount: number): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    problems.push({ code: 'PLAYER_COUNT', detail: `${MIN_PLAYERS}-${MAX_PLAYERS}` });
  }
  const total = totalRoles(config.roles);
  if (total !== playerCount) {
    problems.push({ code: 'ROLE_SUM', detail: `${total}/${playerCount}` });
  }
  const wolves = ROLE_IDS.filter((r) => ROLE_TEAM[r] === 'WOLF').reduce(
    (s, r) => s + config.roles[r],
    0,
  );
  if (wolves < 1) problems.push({ code: 'NO_WOLF' });
  if (wolves * 2 >= playerCount && wolves > 0) problems.push({ code: 'WOLVES_TOO_MANY' });
  for (const r of ROLE_IDS) {
    const max = MAX_PER_ROLE[r];
    if (max !== undefined && config.roles[r] > max) problems.push({ code: 'ROLE_LIMIT', role: r });
  }
  if (config.timers.nightMinMin > config.timers.nightMinMax) {
    problems.push({ code: 'TIMER_RANGE', detail: 'nightMin' });
  }
  return problems;
}

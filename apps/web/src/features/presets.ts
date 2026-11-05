import { DEFAULT_TIMERS, type Timers } from '@masoi/shared';

export type PresetId = 'fast' | 'standard' | 'slow';

export const TIMER_PRESETS: Record<PresetId, Timers> = {
  fast: {
    ...DEFAULT_TIMERS,
    roleReveal: 15,
    nightMain: 25,
    witch: 15,
    hunter: 15,
    dawn: 6,
    discussion: 90,
    turnPerPlayer: 30,
    vote: 30,
    revote: 20,
    execution: 8,
    nightMinMin: 15,
    nightMinMax: 20,
  },
  standard: { ...DEFAULT_TIMERS },
  slow: {
    ...DEFAULT_TIMERS,
    roleReveal: 30,
    nightMain: 50,
    witch: 30,
    hunter: 30,
    dawn: 10,
    discussion: 300,
    turnPerPlayer: 60,
    vote: 60,
    revote: 40,
    execution: 12,
    nightMinMin: 25,
    nightMinMax: 35,
  },
};

/** Nhận diện preset hiện tại; null nếu đã chỉnh tay. */
export function detectPreset(t: Timers): PresetId | null {
  for (const id of Object.keys(TIMER_PRESETS) as PresetId[]) {
    const p = TIMER_PRESETS[id];
    if (
      p.discussion === t.discussion &&
      p.vote === t.vote &&
      p.nightMain === t.nightMain &&
      p.witch === t.witch
    )
      return id;
  }
  return null;
}

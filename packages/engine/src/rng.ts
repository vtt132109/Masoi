import type { GameState } from './state';

/** mulberry32: PRNG nhỏ, có seed, trạng thái nằm trong `state.rng` nên phát lại được. */
export function rand(s: Pick<GameState, 'rng'>): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Số nguyên ngẫu nhiên trong [0, n). */
export function randInt(s: Pick<GameState, 'rng'>, n: number): number {
  return Math.floor(rand(s) * n);
}

export function pickOne<T>(s: Pick<GameState, 'rng'>, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: danh sách rỗng');
  return items[randInt(s, items.length)] as T;
}

export function shuffle<T>(s: Pick<GameState, 'rng'>, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

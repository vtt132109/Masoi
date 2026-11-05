/** localStorage an toàn: có thể ném lỗi ở chế độ riêng tư / bị chặn. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* bỏ qua */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* bỏ qua */
  }
}

export const KEYS = {
  session: 'masoi.session',
  profile: 'masoi.profile',
  sound: 'masoi.sound',
  notes: (gameId: string) => `masoi.notes.${gameId}`,
} as const;

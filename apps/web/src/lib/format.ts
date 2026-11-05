/** 75000ms → "1:15" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}`;
}

export function roomLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

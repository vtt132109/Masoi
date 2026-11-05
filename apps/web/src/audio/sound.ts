import type { GameCue } from '@masoi/shared';

/**
 * Âm thanh tổng hợp bằng Web Audio (không cần file, không vướng bản quyền).
 * AudioContext chỉ chạy được sau một thao tác của người dùng, nên `unlock()`
 * được gọi ở lần chạm đầu tiên.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(
  c: AudioContext,
  {
    f0,
    f1 = f0,
    start = 0,
    dur = 0.4,
    type = 'sine',
    gain = 0.12,
  }: {
    f0: number;
    f1?: number;
    start?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
  },
): void {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(
  c: AudioContext,
  { start = 0, dur = 0.25, gain = 0.2 }: { start?: number; dur?: number; gain?: number },
): void {
  const t = c.currentTime + start;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start(t);
}

export function playCue(kind: GameCue): void {
  const c = context();
  if (!c || c.state !== 'running') return;
  switch (kind) {
    case 'NIGHT_FALLS': // tiếng hú trầm kéo dài
      tone(c, { f0: 220, f1: 420, dur: 1.1, type: 'triangle', gain: 0.1 });
      tone(c, { f0: 420, f1: 260, start: 1.0, dur: 1.2, type: 'triangle', gain: 0.08 });
      break;
    case 'DAWN': // chim hót
      [0, 0.18, 0.36].forEach((s, i) =>
        tone(c, { f0: 1400 + i * 260, f1: 2000 + i * 200, start: s, dur: 0.16, gain: 0.07 }),
      );
      break;
    case 'VOTE_START': // chuông
      tone(c, { f0: 880, dur: 1.2, gain: 0.1 });
      tone(c, { f0: 1320, start: 0.05, dur: 1.0, gain: 0.05 });
      break;
    case 'EXECUTION': // trống
      tone(c, { f0: 120, f1: 50, dur: 0.5, gain: 0.25 });
      tone(c, { f0: 120, f1: 50, start: 0.45, dur: 0.6, gain: 0.25 });
      break;
    case 'HUNTER': // tiếng súng
      noise(c, { dur: 0.3, gain: 0.25 });
      tone(c, { f0: 160, f1: 40, dur: 0.3, gain: 0.2 });
      break;
    case 'GAME_OVER':
      [523, 659, 784].forEach((f, i) => tone(c, { f0: f, start: i * 0.12, dur: 1.4, gain: 0.07 }));
      break;
  }
}

export function vibrate(ms = 30): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS không hỗ trợ */
  }
}

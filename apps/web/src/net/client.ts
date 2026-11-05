import { io, type Socket } from 'socket.io-client';
import {
  ClientEvents,
  type Ack,
  type ErrorCode,
  type GameAction,
  type GameConfigPatch,
  type HostCommand,
  type JoinResult,
  type PlayerView,
  type ResumeResult,
  type RoomView,
} from '@masoi/shared';
import { vi } from '../i18n/vi';
import { KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import { useApp, type Session } from '../store';

export const socket: Socket = io({ autoConnect: false });

let started = false;

const errorText = (code: ErrorCode, fallback?: string): string =>
  vi.errors[code] ?? fallback ?? vi.errors.INTERNAL;

/** Gửi một lệnh và chờ ack (tối đa 8 giây). */
export function call<T = undefined>(event: string, payload: object = {}): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, code: 'INTERNAL', message: vi.conn.reconnecting });
      return;
    }
    const timer = setTimeout(
      () => resolve({ ok: false, code: 'INTERNAL', message: vi.errors.INTERNAL }),
      8000,
    );
    socket.emit(event, payload, (ack: Ack<T>) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

/** Gọi và tự hiện toast lỗi. Trả về dữ liệu hoặc null. */
async function run<T = undefined>(
  event: string,
  payload: object = {},
): Promise<{ ok: true; data: T } | null> {
  const ack = await call<T>(event, payload);
  if (ack.ok) return ack;
  useApp.getState().toast(errorText(ack.code, ack.message), 'error');
  return null;
}

// ------------------------------------------------------------ Đồng bộ đồng hồ

async function syncClock(): Promise<void> {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const ack = await call<{ serverTs: number }>(ClientEvents.timePing, { clientTs: t0 });
    const t1 = Date.now();
    if (ack.ok) samples.push(ack.data.serverTs - (t0 + (t1 - t0) / 2));
    await new Promise((r) => setTimeout(r, 80));
  }
  if (samples.length === 0) return;
  samples.sort((a, b) => a - b);
  useApp.getState().set({ clockOffset: samples[Math.floor(samples.length / 2)] ?? 0 });
}

// ------------------------------------------------------------ Phiên

const saveSession = (s: Session): void => {
  writeJson(KEYS.session, s);
  useApp.getState().set({ session: s, endedReason: null });
};

export function forgetSession(): void {
  removeKey(KEYS.session);
  useApp.getState().clearRoom();
}

async function resume(): Promise<void> {
  const stored = readJson<Session | null>(KEYS.session, null);
  if (!stored) {
    useApp.getState().set({ booted: true });
    return;
  }
  const ack = await call<ResumeResult>(ClientEvents.sessionResume, {
    roomCode: stored.roomCode,
    token: stored.token,
  });
  if (ack.ok) {
    useApp.getState().set({
      session: stored,
      room: ack.data.room,
      game: ack.data.game,
      booted: true,
      endedReason: null,
    });
  } else if (ack.code === 'BAD_SESSION' || ack.code === 'ROOM_NOT_FOUND') {
    forgetSession();
    useApp.getState().set({ booted: true, endedReason: 'ROOM_GONE' });
  } else {
    useApp.getState().set({ booted: true });
  }
}

export function startNet(): void {
  if (started) return;
  started = true;
  const { set, toast } = useApp.getState();

  socket.on('connect', () => {
    set({ conn: 'connected' });
    void syncClock();
    void resume();
  });
  socket.on('disconnect', () => {
    if (useApp.getState().conn !== 'replaced') set({ conn: 'disconnected' });
  });
  socket.on('connect_error', () => {
    if (useApp.getState().conn !== 'replaced') set({ conn: 'disconnected', booted: true });
  });
  socket.on('room:view', (room: RoomView) => set({ room }));
  socket.on('game:view', (game: PlayerView) => set({ game }));
  socket.on('game:cue', (cue) => set({ cue }));
  socket.on('session:replaced', () => set({ conn: 'replaced' }));
  socket.on('room:kicked', ({ reason }: { reason: 'KICKED' | 'REMOVED' }) => {
    forgetSession();
    set({ endedReason: reason });
  });
  socket.on('server:notice', (n: { code: string }) => {
    const map: Record<string, string> = {
      PAUSED: vi.conn.paused,
      RESUMED: vi.conn.resumed,
      HOST_CHANGED: vi.conn.hostChanged,
    };
    const text = map[n.code];
    if (text) toast(text);
  });

  // Đồng hồ lệch dần theo thời gian: đồng bộ lại mỗi phút.
  setInterval(() => {
    if (socket.connected) void syncClock();
  }, 60_000);

  socket.connect();
}

/** Dùng ở nút "Dùng ở đây" khi bị thay thế bởi tab khác. */
export function reclaimSession(): void {
  useApp.getState().set({ conn: 'connecting' });
  socket.disconnect();
  socket.connect();
}

// ------------------------------------------------------------ API cho giao diện

export const api = {
  async create(nickname: string, avatar: number): Promise<boolean> {
    const r = await run<JoinResult>(ClientEvents.roomCreate, { nickname, avatar });
    if (!r) return false;
    saveSession({ roomCode: r.data.roomCode, playerId: r.data.playerId, token: r.data.token });
    return true;
  },
  async join(roomCode: string, nickname: string, avatar: number): Promise<boolean> {
    const r = await run<JoinResult>(ClientEvents.roomJoin, { roomCode, nickname, avatar });
    if (!r) return false;
    saveSession({ roomCode: r.data.roomCode, playerId: r.data.playerId, token: r.data.token });
    return true;
  },
  async leave(): Promise<void> {
    await call(ClientEvents.roomLeave);
    forgetSession();
  },
  setReady: (ready: boolean) => run(ClientEvents.roomSetReady, { ready }),
  updateConfig: (patch: GameConfigPatch, autoRoles?: boolean) =>
    run(ClientEvents.roomUpdateConfig, autoRoles === undefined ? { patch } : { patch, autoRoles }),
  kick: (playerId: string) => run(ClientEvents.roomKick, { playerId }),
  transferHost: (playerId: string) => run(ClientEvents.roomTransferHost, { playerId }),
  addBot: () => run(ClientEvents.roomAddBot),
  removeBot: (playerId: string) => run(ClientEvents.roomRemoveBot, { playerId }),
  start: () => run(ClientEvents.gameStart),
  ackRole: () => {
    const seq = useApp.getState().game?.phase.seq;
    return seq === undefined ? null : run(ClientEvents.gameAckRole, { phaseSeq: seq });
  },
  /** Gửi hành động; luôn dùng phaseSeq của view mới nhất. */
  action: (action: GameAction) => {
    const seq = useApp.getState().game?.phase.seq;
    return seq === undefined ? null : run(ClientEvents.gameAction, { phaseSeq: seq, action });
  },
  host: (command: HostCommand) => run(ClientEvents.gameHost, { command }),
  backToLobby: () => run(ClientEvents.gameBackToLobby),
};

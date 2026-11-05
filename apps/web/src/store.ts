import { create } from 'zustand';
import type { GameCue, PlayerView, RoomView } from '@masoi/shared';
import { KEYS, readJson, writeJson } from './lib/storage';

export interface Session {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export type ConnState = 'connecting' | 'connected' | 'disconnected' | 'replaced';

export interface Profile {
  nickname: string;
  avatar: number;
}

interface AppState {
  conn: ConnState;
  /** Đã thử khôi phục phiên (để không nháy màn hình trang chủ). */
  booted: boolean;
  session: Session | null;
  room: RoomView | null;
  game: PlayerView | null;
  /** serverTime - clientTime (ms) */
  clockOffset: number;
  cue: { kind: GameCue; seq: number } | null;
  toasts: Toast[];
  soundOn: boolean;
  profile: Profile;
  endedReason: 'KICKED' | 'REMOVED' | 'ROOM_GONE' | null;

  set: (patch: Partial<AppState>) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  setSoundOn: (on: boolean) => void;
  setProfile: (p: Partial<Profile>) => void;
  clearRoom: () => void;
}

let toastId = 1;

export const useApp = create<AppState>((set, get) => ({
  conn: 'connecting',
  booted: false,
  session: null,
  room: null,
  game: null,
  clockOffset: 0,
  cue: null,
  toasts: [],
  soundOn: readJson<boolean>(KEYS.sound, true),
  profile: readJson<Profile>(KEYS.profile, {
    nickname: '',
    avatar: Math.floor(Math.random() * 24),
  }),
  endedReason: null,

  set: (patch) => set(patch),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 5000 : 3000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setSoundOn: (on) => {
    writeJson(KEYS.sound, on);
    set({ soundOn: on });
  },
  setProfile: (p) => {
    const profile = { ...get().profile, ...p };
    writeJson(KEYS.profile, profile);
    set({ profile });
  },
  clearRoom: () => set({ session: null, room: null, game: null, cue: null }),
}));

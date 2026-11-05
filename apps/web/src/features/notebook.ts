import { create } from 'zustand';
import { KEYS, readJson, writeJson } from '../lib/storage';

export type NoteTag = 'NONE' | 'TRUST' | 'SUSPECT' | 'CLAIM';
export interface Note {
  tag: NoteTag;
  text: string;
}
type Notes = Record<string, Note>;

interface NotebookState {
  gameId: string | null;
  notes: Notes;
  load: (gameId: string) => void;
  setTag: (playerId: string, tag: NoteTag) => void;
  setText: (playerId: string, text: string) => void;
}

const persist = (gameId: string | null, notes: Notes) => {
  if (gameId) writeJson(KEYS.notes(gameId), notes);
};

/** Sổ tay cá nhân: chỉ lưu trên máy này, không bao giờ gửi lên server. */
export const useNotebook = create<NotebookState>((set, get) => ({
  gameId: null,
  notes: {},
  load: (gameId) => {
    if (get().gameId === gameId) return;
    set({ gameId, notes: readJson<Notes>(KEYS.notes(gameId), {}) });
  },
  setTag: (playerId, tag) => {
    const prev = get().notes[playerId] ?? { tag: 'NONE', text: '' };
    const notes = { ...get().notes, [playerId]: { ...prev, tag } };
    persist(get().gameId, notes);
    set({ notes });
  },
  setText: (playerId, text) => {
    const prev = get().notes[playerId] ?? { tag: 'NONE', text: '' };
    const notes = { ...get().notes, [playerId]: { ...prev, text: text.slice(0, 120) } };
    persist(get().gameId, notes);
    set({ notes });
  },
}));

export const NEXT_TAG: Record<NoteTag, NoteTag> = {
  NONE: 'TRUST',
  TRUST: 'SUSPECT',
  SUSPECT: 'CLAIM',
  CLAIM: 'NONE',
};

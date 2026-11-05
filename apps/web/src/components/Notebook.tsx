import { NotebookPen } from 'lucide-react';
import { useEffect } from 'react';
import type { PlayerView } from '@masoi/shared';
import { NEXT_TAG, useNotebook, type NoteTag } from '../features/notebook';
import { vi } from '../i18n/vi';
import { Avatar } from './Avatar';
import type { Tone } from './PlayerPicker';
import { useApp } from '../store';

export const TAG_TONE: Record<NoteTag, Tone> = {
  NONE: 'muted',
  TRUST: 'village',
  SUSPECT: 'wolf',
  CLAIM: 'neutral',
};

const PILL: Record<NoteTag, string> = {
  NONE: 'bg-raised text-muted',
  TRUST: 'bg-village/15 text-village',
  SUSPECT: 'bg-wolf/15 text-wolf',
  CLAIM: 'bg-neutral/15 text-neutral',
};

/** Sổ tay cá nhân. Luôn hiện ở cột phải trên máy tính, mở dạng ngăn kéo trên điện thoại. */
export function Notebook({ game }: { game: PlayerView }) {
  const { notes, load, setTag, setText } = useNotebook();
  const room = useApp((s) => s.room);
  useEffect(() => load(game.gameId), [game.gameId, load]);
  const others = game.players.filter((p) => p.id !== game.me.id);
  const avatarOf = (id: string) => room?.members.find((m) => m.id === id)?.avatar ?? 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <NotebookPen className="h-4 w-4" aria-hidden />
        {vi.notebook.private}
      </div>
      <ul className="flex flex-col gap-2.5">
        {others.map((p) => {
          const note = notes[p.id] ?? { tag: 'NONE' as NoteTag, text: '' };
          return (
            <li key={p.id} className={`flex flex-col gap-1.5 ${p.alive ? '' : 'opacity-55'}`}>
              <div className="flex items-center gap-2.5">
                <Avatar index={avatarOf(p.id)} size={28} dead={!p.alive} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p.name}</span>
                <button
                  type="button"
                  onClick={() => setTag(p.id, NEXT_TAG[note.tag])}
                  className={`min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${PILL[note.tag]}`}
                  aria-label={`Nhãn của ${p.name}: ${vi.notebook.tags[note.tag]}. Chạm để đổi.`}
                >
                  {vi.notebook.tags[note.tag]}
                </button>
              </div>
              <input
                value={note.text}
                onChange={(e) => setText(p.id, e.target.value)}
                placeholder={vi.notebook.notePlaceholder}
                aria-label={`Ghi chú về ${p.name}`}
                className="w-full rounded-[10px] border border-line bg-bg2 px-3 py-1.5 text-[13px] placeholder:text-muted focus:border-accent"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

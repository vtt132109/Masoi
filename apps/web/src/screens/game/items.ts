import type { PlayerView, RoomView } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { TAG_TONE } from '../../components/Notebook';
import type { PickItem } from '../../components/PlayerPicker';
import { useNotebook } from '../../features/notebook';
import { vi } from '../../i18n/vi';

/** Danh sách người chơi cơ bản cho mọi màn hình ván: tên, avatar, trạng thái, nhãn sổ tay. */
export function useBaseItems(game: PlayerView, room: RoomView): PickItem[] {
  const notes = useNotebook((s) => s.notes);
  return game.players.map((p) => {
    const member = room.members.find((m) => m.id === p.id);
    const note = notes[p.id];
    const item: PickItem = {
      id: p.id,
      name: p.name,
      avatar: member?.avatar ?? 0,
      alive: p.alive,
      connected: member ? member.connected || member.isBot : true,
      me: p.id === game.me.id,
      ring: p.tags.includes('WOLF_ALLY') ? 'wolf' : undefined,
      selectable: false,
    };
    if (p.id === game.me.id && p.alive) {
      item.sub = vi.common.you;
      item.subTone = 'accent';
    } else if (!p.alive) {
      if (p.revealedRole) {
        item.sub = vi.roles[p.revealedRole].name;
        item.subTone = ROLE_TEAM[p.revealedRole] === 'WOLF' ? 'wolf' : 'village';
      } else {
        item.sub = vi.common.dead;
      }
    }
    if (note && note.tag !== 'NONE' && p.id !== game.me.id) {
      item.tag = { text: vi.notebook.tags[note.tag], tone: TAG_TONE[note.tag] };
    }
    return item;
  });
}

export function nameOf(game: PlayerView, id: string | null | undefined): string {
  return game.players.find((p) => p.id === id)?.name ?? '?';
}

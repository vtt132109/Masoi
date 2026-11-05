import type { PlayerView } from '@masoi/shared';
import { vi } from '../../i18n/vi';

/** Thông tin thêm dưới lá bài vai: đồng đội Sói, số bình của Phù thủy. */
export function RoleExtras({ game }: { game: PlayerView }) {
  const allies = game.players.filter((p) => p.tags.includes('WOLF_ALLY'));
  const potions = game.privateInfo.witchPotions;
  if (game.me.role === 'WEREWOLF') {
    return (
      <div className="rounded-[14px] bg-wolf/10 p-3 text-center">
        <div className="mb-1 text-xs font-semibold text-wolf">{vi.reveal.wolfAllies}</div>
        <div className="text-[15px] font-bold">
          {allies.length ? allies.map((a) => a.name).join(', ') : '—'}
        </div>
      </div>
    );
  }
  if (game.me.role === 'WITCH' && potions) {
    return (
      <div className="flex justify-center gap-2 text-[13px] font-semibold">
        <span
          className={`rounded-full px-3 py-1 ${potions.heal ? 'bg-village/15 text-village' : 'bg-raised text-muted line-through'}`}
        >
          {vi.nightUi.witch.potionHeal}
        </span>
        <span
          className={`rounded-full px-3 py-1 ${potions.poison ? 'bg-wolf/15 text-wolf' : 'bg-raised text-muted line-through'}`}
        >
          {vi.nightUi.witch.potionPoison}
        </span>
      </div>
    );
  }
  return null;
}

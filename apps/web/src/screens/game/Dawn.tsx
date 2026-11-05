import { Sun } from 'lucide-react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { vi } from '../../i18n/vi';
import { joinNames } from '../../lib/format';
import { Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

export function DawnScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const base = useBaseItems(game, room);
  const deaths = game.publicInfo.lastDeaths;
  const names = deaths.map((d) => nameOf(game, d.id));
  const iDied = deaths.some((d) => d.id === game.me.id);
  const items = base.map((it) => ({ ...it, selected: deaths.some((d) => d.id === it.id) }));

  return (
    <Stage
      title={vi.dawn.title}
      hint={deaths.length ? vi.dawn.died(joinNames(names)) : vi.dawn.peaceful}
      icon={<Sun className="h-9 w-9 text-accent" strokeWidth={1.5} aria-hidden />}
      extra={
        <>
          {deaths.length > 0 ? (
            <ul className="mt-1 flex flex-wrap justify-center gap-2">
              {deaths.map((d) => (
                <li
                  key={d.id}
                  className="anim-pop rounded-full bg-raised px-3 py-1 text-sm font-semibold"
                >
                  {nameOf(game, d.id)}
                  {d.role ? (
                    <span className={ROLE_TEAM[d.role] === 'WOLF' ? 'text-wolf' : 'text-village'}>
                      {' '}
                      · {vi.roles[d.role].name}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {iDied ? <p className="mt-2 text-sm font-semibold text-wolf">{vi.dawn.youDied}</p> : null}
        </>
      }
      items={items}
      selectTone="wolf"
      label="Người chơi"
    />
  );
}

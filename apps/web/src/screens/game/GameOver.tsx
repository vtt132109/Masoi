import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlayerView, RoomView } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { vi } from '../../i18n/vi';
import { ROLE_ICON } from '../../lib/roles';
import { describeTimeline } from '../../lib/timeline';
import { api } from '../../net/client';
import { nameOf } from './items';

export function GameOverScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const navigate = useNavigate();
  const over = game.gameOver;
  if (!over) return null;
  const { win, roles, timeline } = over;
  const won = win.winners.includes(game.me.id);
  const isHost = room.hostId === game.me.id;
  const wolfWin = win.winner === 'WOLF';
  const name = (id: string) => nameOf(game, id);

  const groups: { key: string; label: string; entries: typeof timeline }[] = [];
  for (const e of timeline) {
    const key = `${e.step}${e.n}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        label: e.step === 'NIGHT' ? vi.timeline.night(e.n) : vi.timeline.day(e.n),
        entries: [],
      };
      groups.push(g);
    }
    g.entries.push(e);
  }

  const leave = async () => {
    await api.leave();
    navigate('/');
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <section
        className="card anim-pop flex flex-col items-center gap-2 p-6 text-center"
        style={{
          borderColor: wolfWin
            ? 'var(--team-wolf)'
            : win.winner === 'VILLAGE'
              ? 'var(--team-village)'
              : undefined,
        }}
      >
        <Trophy className={`h-10 w-10 ${wolfWin ? 'text-wolf' : 'text-accent'}`} aria-hidden />
        <h2 className="font-display text-[40px] font-bold leading-tight lg:text-[56px]">
          {vi.winners[win.winner]}
        </h2>
        <p className="text-muted">{vi.winReason[win.reason]}</p>
        {win.winner !== 'DRAW' ? (
          <p
            className={`mt-1 rounded-full px-4 py-1 text-sm font-bold ${won ? 'bg-village/15 text-village' : 'bg-wolf/15 text-wolf'}`}
          >
            {won ? vi.over.youWon : vi.over.youLost}
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4" aria-label={vi.over.roles}>
          <h2 className="font-display mb-3 text-xl font-bold">{vi.over.roles}</h2>
          <ul className="flex flex-col">
            {game.players.map((p) => {
              const role = roles[p.id] ?? 'VILLAGER';
              const Icon = ROLE_ICON[role];
              const member = room.members.find((m) => m.id === p.id);
              const winner = win.winners.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                >
                  <Avatar index={member?.avatar ?? 0} size={40} dead={!p.alive} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {p.name}{' '}
                      {p.id === game.me.id ? (
                        <span className="text-xs text-accent">({vi.common.you})</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted">
                      {p.alive ? vi.common.alive : vi.common.dead}
                    </div>
                  </div>
                  {winner ? (
                    <Trophy className="h-4 w-4 text-accent" aria-label={vi.over.winnersLabel} />
                  ) : null}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${ROLE_TEAM[role] === 'WOLF' ? 'bg-wolf/15 text-wolf' : 'bg-village/15 text-village'}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {vi.roles[role].name}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-4" aria-label={vi.over.timeline}>
          <h2 className="font-display mb-3 text-xl font-bold">{vi.over.timeline}</h2>
          <ol className="flex flex-col gap-4">
            {groups.map((g) => (
              <li key={g.key}>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-accent">
                  {g.label}
                </div>
                <ul className="flex flex-col gap-1">
                  {g.entries.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                        aria-hidden="true"
                      />
                      {describeTimeline(e, name)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {isHost ? (
          <Button variant="primary" size="lg" onClick={() => api.backToLobby()}>
            {vi.over.playAgain}
          </Button>
        ) : (
          <p className="self-center text-sm text-muted">{vi.over.waitingHost}</p>
        )}
        <Button size="lg" onClick={leave}>
          {vi.over.leave}
        </Button>
      </div>
    </div>
  );
}

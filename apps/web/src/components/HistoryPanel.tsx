import type { PlayerView } from '@masoi/shared';
import { vi } from '../i18n/vi';

export function HistoryPanel({ game }: { game: PlayerView }) {
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? '?';
  const alive = game.players.filter((p) => p.alive).length;
  const entries = game.publicInfo.history;

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        {vi.history.peopleAlive(alive, game.players.length)}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{vi.history.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((h, i) => {
            const text =
              h.kind === 'NIGHT_DEATHS'
                ? vi.history.nightDeaths(h.n, h.ids.map(name))
                : h.kind === 'EXECUTED'
                  ? vi.history.executed(h.n, name(h.ids[0] ?? ''), h.votes ?? 0)
                  : h.kind === 'NO_LYNCH'
                    ? vi.history.noLynch(h.n)
                    : vi.history.hunterShot(name(h.by ?? ''), name(h.ids[0] ?? ''));
            const role =
              h.ids.length === 1
                ? game.players.find((p) => p.id === h.ids[0])?.revealedRole
                : undefined;
            return (
              <li key={i} className="flex gap-2.5 text-sm">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted"
                  aria-hidden="true"
                />
                <span>
                  {text}
                  {role && h.kind !== 'NO_LYNCH' ? (
                    <span className="text-muted"> — {vi.roles[role].name}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

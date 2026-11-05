import { Gavel } from 'lucide-react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { vi } from '../../i18n/vi';
import { Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

export function ExecutionScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const base = useBaseItems(game, room);
  const res = game.publicInfo.voteResult;
  const exec = game.publicInfo.executed;

  const items = base.map((it) => ({
    ...it,
    selected: exec?.id === it.id,
    marks:
      res && res.tally[it.id]
        ? [
            {
              text: String(res.tally[it.id]),
              tone: (exec?.id === it.id ? 'wolf' : 'accent') as 'wolf' | 'accent',
            },
          ]
        : [],
  }));

  const rows = res
    ? Object.entries(res.tally)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({
          id,
          label: id === 'SKIP' ? vi.result.skipLabel : nameOf(game, id),
          count,
          voters: Object.entries(res.ballots)
            .filter(([, t]) => t === id)
            .map(([v]) => nameOf(game, v)),
        }))
    : [];
  const total = Math.max(1, Object.keys(res?.ballots ?? {}).length);

  return (
    <Stage
      title={exec ? nameOf(game, exec.id) : vi.result.nobody}
      hint={
        exec
          ? vi.result.hanged(res?.tally[exec.id] ?? 0)
          : res && res.tiedCandidates.length
            ? vi.result.tied
            : vi.result.nobodyWhy
      }
      icon={<Gavel className="h-9 w-9 text-wolf" strokeWidth={1.5} aria-hidden />}
      extra={
        exec?.role ? (
          <span
            className={`anim-pop mt-1 rounded-full px-4 py-1.5 text-sm font-bold text-white ${ROLE_TEAM[exec.role] === 'WOLF' ? 'bg-wolf' : 'bg-village'}`}
          >
            {vi.roles[exec.role].name}
          </span>
        ) : null
      }
      items={items}
      selectTone="wolf"
      label="Kết quả bỏ phiếu"
      below={
        rows.length > 0 ? (
          <section className="card p-4" aria-label={vi.result.detail}>
            <h2 className="font-display mb-3 text-xl font-bold">{vi.result.detail}</h2>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-20 truncate text-sm font-bold">{r.label}</span>
                  <div className="h-3 min-w-24 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(r.count / total) * 100}%`,
                        background:
                          r.id === exec?.id
                            ? 'var(--team-wolf)'
                            : r.id === 'SKIP'
                              ? 'var(--dead)'
                              : 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="tabular w-16 text-right text-sm font-bold">
                    {vi.result.votes(r.count)}
                  </span>
                  <span className="basis-full text-[13px] text-muted">{r.voters.join(', ')}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      }
    />
  );
}

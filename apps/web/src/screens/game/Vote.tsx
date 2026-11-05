import { Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import { useKeyboardPick } from '../../hooks/useKeyboardPick';
import { vi } from '../../i18n/vi';
import { api } from '../../net/client';
import { BarNote, Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

export function VoteScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const a = game.myAction;
  const base = useBaseItems(game, room);
  const revote = game.phase.id === 'REVOTE';
  const info = game.publicInfo;
  const current = a.kind === 'VOTE' ? a.current : null;
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Đồng bộ với phiếu đã gửi (kể cả khi kết nối lại).
  useEffect(() => setChoice(current), [game.phase.seq, current]);

  const submit = async (target: string | null) => {
    setBusy(true);
    await api.action({ type: 'VOTE', target });
    setBusy(false);
  };

  const targets = a.kind === 'VOTE' ? a.targets : [];
  useKeyboardPick({
    enabled: targets.length > 0,
    ids: targets,
    onSelect: (id) => setChoice((c) => (c === id ? null : id)),
    onConfirm: () => choice && void submit(choice),
    onClear: () => setChoice(null),
  });

  const live = info.liveVotes;
  const tallyLive: Record<string, number> = {};
  if (live)
    for (const v of Object.values(live))
      if (v && v !== 'SKIP') tallyLive[v] = (tallyLive[v] ?? 0) + 1;

  const items = base.map((it) => ({
    ...it,
    selectable: a.kind === 'VOTE' && a.targets.includes(it.id),
    selected: choice === it.id,
    marks: tallyLive[it.id] ? [{ text: String(tallyLive[it.id]), tone: 'accent' as const }] : [],
  }));

  const progress = vi.vote.progress(info.votedCount, info.voterCount);
  const summary =
    choice === 'SKIP'
      ? vi.vote.chosenSkip
      : choice
        ? vi.vote.chosen(nameOf(game, choice))
        : vi.vote.pick;
  const changed = choice !== current;

  return (
    <Stage
      title={revote ? vi.vote.revoteTitle : vi.vote.title}
      hint={vi.vote.hint}
      icon={<Gavel className="h-9 w-9 text-accent" strokeWidth={1.5} aria-hidden />}
      extra={<span className="mt-1 text-sm font-semibold">{progress}</span>}
      items={items}
      onPick={a.kind === 'VOTE' ? (id) => setChoice((c) => (c === id ? null : id)) : undefined}
      hotkeys
      label="Chọn người để bỏ phiếu"
      footer={
        a.kind === 'VOTE' ? (
          <div className="flex flex-col gap-2">
            <BarNote>{current !== null && !changed ? `✓ ${summary}` : summary}</BarNote>
            <div className="flex gap-2">
              {a.skipAllowed ? (
                <Button
                  size="lg"
                  disabled={busy || current === 'SKIP'}
                  onClick={() => submit('SKIP')}
                >
                  {vi.common.skip}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                block
                loading={busy}
                disabled={!choice || choice === 'SKIP' || current === choice}
                onClick={() => choice && submit(choice)}
              >
                {current !== null && current !== 'SKIP' ? 'Đổi phiếu' : vi.vote.submit}
              </Button>
            </div>
          </div>
        ) : (
          <BarNote>{game.me.alive ? vi.vote.cantVote : vi.discussion.deadSpectator}</BarNote>
        )
      }
    />
  );
}

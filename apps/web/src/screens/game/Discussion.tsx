import { Hand, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import { vi } from '../../i18n/vi';
import { joinNames } from '../../lib/format';
import { api } from '../../net/client';
import { BarNote, Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

export function DiscussionScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const a = game.myAction;
  const base = useBaseItems(game, room);
  const [busy, setBusy] = useState(false);
  const info = game.publicInfo;

  const items = base.map((it) => ({
    ...it,
    hand: info.raisedHands.includes(it.id),
    speaking: info.currentSpeaker === it.id,
  }));

  const act = async (action: Parameters<typeof api.action>[0]) => {
    setBusy(true);
    await api.action(action);
    setBusy(false);
  };

  const hands = info.raisedHands.map((id) => nameOf(game, id));
  const turns = room.config.rules.discussionMode === 'TURNS';

  const extra = (
    <div className="mt-1 flex flex-col items-center gap-1.5">
      {turns && info.currentSpeaker ? (
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-onaccent">
          {info.currentSpeaker === game.me.id
            ? vi.discussion.youSpeak
            : vi.discussion.speaker(nameOf(game, info.currentSpeaker))}
        </span>
      ) : null}
      <span className="text-sm font-semibold">
        {vi.discussion.readyCount(info.readyToVoteCount, info.readyNeeded)}
      </span>
      {hands.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          <Hand className="h-3.5 w-3.5" aria-hidden />
          {vi.discussion.handsUp}: {joinNames(hands)}
        </span>
      ) : null}
    </div>
  );

  const footer =
    a.kind === 'DISCUSS' ? (
      <div className="flex flex-col gap-2">
        {a.isSpeaker ? (
          <Button
            variant="primary"
            size="lg"
            block
            loading={busy}
            onClick={() => act({ type: 'DONE_SPEAKING' })}
          >
            {vi.discussion.doneSpeaking}
          </Button>
        ) : null}
        <div className="flex gap-2">
          <Button
            size="lg"
            block
            aria-pressed={a.handUp}
            icon={<Hand className="h-5 w-5" aria-hidden />}
            disabled={busy}
            onClick={() => act({ type: 'RAISE_HAND', up: !a.handUp })}
          >
            {a.handUp ? vi.discussion.lowerHand : vi.discussion.raiseHand}
          </Button>
          <Button
            variant={a.readyToVote ? 'secondary' : 'primary'}
            size="lg"
            block
            disabled={busy}
            onClick={() => act({ type: 'READY_TO_VOTE', ready: !a.readyToVote })}
          >
            {a.readyToVote ? vi.discussion.notReadyToVote : vi.discussion.readyToVote}
          </Button>
        </div>
      </div>
    ) : (
      <BarNote>{vi.discussion.deadSpectator}</BarNote>
    );

  return (
    <Stage
      title={vi.discussion.title}
      hint={vi.discussion.hint}
      icon={<MessagesSquare className="h-9 w-9 text-accent" strokeWidth={1.5} aria-hidden />}
      extra={extra}
      items={items}
      label="Người chơi"
      footer={footer}
    />
  );
}

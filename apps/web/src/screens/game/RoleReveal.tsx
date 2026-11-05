import type { PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import { RoleCard, RoleCardBack } from '../../components/RoleCard';
import { useHold } from '../../hooks/useHold';
import { useIsDesktop } from '../../hooks/useBreakpoint';
import { vi } from '../../i18n/vi';
import { api } from '../../net/client';
import { RoleExtras } from './RoleExtras';

export function RoleReveal({ game, room }: { game: PlayerView; room: RoomView }) {
  const desktop = useIsDesktop();
  const { held, bind } = useHold(desktop);
  const done = game.myAction.kind === 'ACK_ROLE' && game.myAction.done;
  const total = game.players.length;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pb-8 pt-2">
      <div className="text-center">
        <h2 className="font-display text-[30px] font-bold">{vi.reveal.title}</h2>
        <p className="text-sm text-muted">{vi.reveal.hide}</p>
      </div>

      <button
        type="button"
        {...bind}
        aria-label={`${vi.reveal.holdToFlip}${desktop ? ` (${vi.reveal.holdKey})` : ''}`}
        className="w-full max-w-[320px] rounded-[24px] outline-offset-4"
        style={bind.style}
      >
        {held ? (
          <RoleCard role={game.me.role} extra={<RoleExtras game={game} />} />
        ) : (
          <RoleCardBack hint={vi.reveal.holdToFlip} />
        )}
      </button>

      <p className="text-[13px] text-muted">
        {held ? vi.reveal.releaseToHide : desktop ? vi.reveal.holdKey : ''}&nbsp;
      </p>

      <div className="w-full max-w-[320px]">
        <div className="mb-1.5 flex justify-between text-[13px] text-muted">
          <span>{vi.reveal.seen(game.publicInfo.ackedCount, total)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(game.publicInfo.ackedCount / total) * 100}%` }}
          />
        </div>
        <Button
          variant="primary"
          size="lg"
          block
          className="mt-4"
          disabled={done}
          onClick={() => api.ackRole()}
        >
          {done ? vi.reveal.waiting : vi.reveal.understood}
        </Button>
      </div>
      <span className="sr-only">{room.code}</span>
    </div>
  );
}

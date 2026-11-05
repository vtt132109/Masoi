import { Eye } from 'lucide-react';
import type { PlayerView } from '@masoi/shared';
import { RoleCard } from '../../components/RoleCard';
import { useHold } from '../../hooks/useHold';
import { useIsDesktop } from '../../hooks/useBreakpoint';
import { vi } from '../../i18n/vi';
import { RoleExtras } from './RoleExtras';

/** Nút "Giữ để xem vai": chỉ hiện lá bài khi đang giữ, nhả ra là ẩn. */
export function HoldToSee({
  game,
  className = '',
  short = false,
}: {
  game: PlayerView;
  className?: string;
  short?: boolean;
}) {
  const desktop = useIsDesktop();
  const { held, bind } = useHold(desktop);
  return (
    <>
      <button
        type="button"
        {...bind}
        aria-label={`${vi.nightUi.holdToSeeRole}${desktop ? ' (giữ phím Space)' : ''}`}
        className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-line bg-surface px-4 text-sm font-medium transition hover:border-accent/60 ${held ? 'border-accent' : ''} ${className}`}
        style={bind.style}
      >
        <Eye className="h-[18px] w-[18px]" aria-hidden />
        {short ? vi.nightUi.holdShort : vi.nightUi.holdToSeeRole}
      </button>
      {held ? (
        <div
          className="anim-fade pointer-events-none fixed inset-0 z-[55] flex items-center justify-center bg-black/65 p-6"
          aria-live="polite"
        >
          <RoleCard role={game.me.role} extra={<RoleExtras game={game} />} />
        </div>
      ) : null}
    </>
  );
}

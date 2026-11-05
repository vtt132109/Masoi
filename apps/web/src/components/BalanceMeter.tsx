import { balanceScore } from '@masoi/shared';
import type { RoleId } from '@masoi/shared';
import { vi } from '../i18n/vi';

export function BalanceMeter({ roles }: { roles: Record<RoleId, number> }) {
  const score = balanceScore(roles);
  const clamped = Math.max(-20, Math.min(20, score));
  const pos = 50 + (clamped / 20) * 50;
  const label =
    score <= -4
      ? vi.config.balanceWolf
      : score >= 4
        ? vi.config.balanceVillage
        : vi.config.balanceEven;
  return (
    <div aria-label={`${vi.config.balance}: ${label}`}>
      <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-muted">
        <span>{vi.config.balanceWolf}</span>
        <span className="text-ink">{label}</span>
        <span>{vi.config.balanceVillage}</span>
      </div>
      <div
        className="relative h-2.5 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, var(--team-wolf), var(--border) 50%, var(--team-village))',
          opacity: 0.85,
        }}
      >
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg bg-ink shadow"
          style={{ left: `${pos}%`, transition: 'left 0.3s ease' }}
        />
      </div>
    </div>
  );
}

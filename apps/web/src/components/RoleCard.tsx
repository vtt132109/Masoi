import { Moon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RoleId } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { vi } from '../i18n/vi';
import { ROLE_ICON, teamColorClass } from '../lib/roles';

export function RoleCard({
  role,
  extra,
  className = '',
}: {
  role: RoleId;
  extra?: ReactNode;
  className?: string;
}) {
  const team = ROLE_TEAM[role];
  const Icon = ROLE_ICON[role];
  const color = teamColorClass(team);
  const teamVar = team === 'WOLF' ? 'var(--team-wolf)' : 'var(--team-village)';
  return (
    <div
      className={`anim-flip relative flex w-full max-w-[320px] flex-col items-center rounded-[24px] border-2 bg-surface p-5 ${className}`}
      style={{
        borderColor: teamVar,
        boxShadow: `0 0 44px color-mix(in srgb, ${teamVar} 20%, transparent)`,
      }}
    >
      <span
        className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${color.soft} ${color.text}`}
      >
        {vi.teams[team]}
      </span>
      <div
        className="mt-4 flex h-[132px] w-[132px] items-center justify-center rounded-full bg-raised"
        style={{
          boxShadow:
            '0 0 0 10px color-mix(in srgb, var(--accent) 6%, transparent), 0 0 0 22px color-mix(in srgb, var(--accent) 3%, transparent)',
        }}
      >
        <Icon className="h-[68px] w-[68px] text-accent" strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="font-display mt-5 text-[34px] font-bold leading-tight">
        {vi.roles[role].name}
      </h2>
      <p className="mt-2 text-center text-[14px] leading-[21px] text-muted">
        {vi.roles[role].desc}
      </p>
      {extra ? <div className="mt-4 w-full">{extra}</div> : null}
    </div>
  );
}

export function RoleCardBack({ hint }: { hint: string }) {
  return (
    <div className="relative flex min-h-[420px] w-full max-w-[320px] flex-col items-center justify-center gap-5 rounded-[24px] border-2 border-line bg-raised p-5">
      <div className="flex h-44 w-44 items-center justify-center rounded-full border border-dashed border-line">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-line">
          <Moon className="h-14 w-14 text-accent" strokeWidth={1.5} aria-hidden />
        </div>
      </div>
      <div className="font-display text-2xl font-bold">{vi.app.name}</div>
      <div className="text-sm text-muted">{hint}</div>
    </div>
  );
}

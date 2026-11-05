import { Pause } from 'lucide-react';
import { formatClock } from '../lib/format';
import { useServerNow } from '../hooks/useNow';

interface Props {
  deadlineAt: number | null;
  startedAt: number;
  paused: boolean;
  size?: number;
}

export function TimerRing({ deadlineAt, startedAt, paused, size = 60 }: Props) {
  const now = useServerNow(250);
  const remaining = deadlineAt === null ? 0 : Math.max(0, deadlineAt - now);
  const total = deadlineAt === null ? 1 : Math.max(1, deadlineAt - startedAt, remaining);
  const fraction = deadlineAt === null ? 0 : Math.min(1, remaining / total);
  const stroke = Math.max(4, size / 12);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = deadlineAt !== null && !paused && remaining > 0 && remaining <= 10_000;
  const label = paused
    ? 'Đang tạm dừng'
    : deadlineAt === null
      ? 'Không giới hạn thời gian'
      : `Còn ${Math.ceil(remaining / 1000)} giây`;

  return (
    <div
      role="timer"
      aria-label={label}
      className={`relative shrink-0 ${urgent ? 'anim-pulse' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? 'var(--team-wolf)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
        />
      </svg>
      <div className="tabular absolute inset-0 flex items-center justify-center text-[15px] font-bold">
        {paused ? (
          <Pause className="h-5 w-5" aria-hidden />
        ) : deadlineAt === null ? (
          '—'
        ) : (
          formatClock(remaining)
        )}
      </div>
    </div>
  );
}

import { Skull } from 'lucide-react';
import { avatarColor, avatarIcon } from '../lib/avatars';

interface Props {
  index: number;
  size?: number;
  dead?: boolean;
  ring?: string;
  className?: string;
}

export function Avatar({ index, size = 40, dead, ring, className = '' }: Props) {
  const Icon = dead ? Skull : avatarIcon(index);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: dead ? 'var(--dead)' : avatarColor(index),
        color: dead ? 'var(--bg)' : '#0B1020',
        boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` : undefined,
        transition: 'background 0.6s ease',
      }}
    >
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2} />
    </span>
  );
}

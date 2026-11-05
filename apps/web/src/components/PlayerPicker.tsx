import { Hand, Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { Avatar } from './Avatar';

export type Tone = 'muted' | 'accent' | 'wolf' | 'village' | 'neutral' | 'lovers';

export const toneColor: Record<Tone, string> = {
  muted: 'var(--text-muted)',
  accent: 'var(--accent)',
  wolf: 'var(--team-wolf)',
  village: 'var(--team-village)',
  neutral: 'var(--team-neutral)',
  lovers: 'var(--lovers)',
};

export interface PickItem {
  id: string;
  name: string;
  avatar: number;
  alive: boolean;
  connected?: boolean;
  me?: boolean;
  selectable?: boolean;
  selected?: boolean;
  sub?: string;
  subTone?: Tone;
  /** Chấm nhỏ ở góc avatar (số phiếu, ai đang chọn…). */
  marks?: { text: string; tone: Tone }[];
  ring?: Tone;
  hand?: boolean;
  speaking?: boolean;
  /** Nhãn từ sổ tay cá nhân. */
  tag?: { text: string; tone: Tone };
}

interface Props {
  items: PickItem[];
  onPick?: (id: string) => void;
  selectTone?: 'accent' | 'wolf';
  /** Nội dung đặt giữa vòng tròn (chỉ máy tính). */
  center?: ReactNode;
  label: string;
  /** Hiện số phím tắt 1–9 trên máy tính. */
  hotkeys?: boolean;
}

export function PlayerPicker({
  items,
  onPick,
  selectTone = 'accent',
  center,
  label,
  hotkeys,
}: Props) {
  const desktop = useIsDesktop();
  const selectableIds = items.filter((i) => i.selectable).map((i) => i.id);
  const hotkeyOf = (id: string) => {
    const idx = selectableIds.indexOf(id);
    return hotkeys && desktop && idx >= 0 && idx < 9 ? idx + 1 : null;
  };

  if (desktop)
    return (
      <Circle
        items={items}
        onPick={onPick}
        selectTone={selectTone}
        center={center}
        label={label}
        hotkeyOf={hotkeyOf}
      />
    );

  const cols = items.length > 12 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <ul
      role="list"
      aria-label={label}
      className={`grid ${cols} gap-2.5 sm:grid-cols-4 md:grid-cols-5`}
    >
      {items.map((it) => (
        <li key={it.id} className="min-w-0">
          <Tile item={it} onPick={onPick} selectTone={selectTone} variant="grid" />
        </li>
      ))}
    </ul>
  );
}

function Circle({
  items,
  onPick,
  selectTone,
  center,
  label,
  hotkeyOf,
}: {
  items: PickItem[];
  onPick?: (id: string) => void;
  selectTone: 'accent' | 'wolf';
  center?: ReactNode;
  label: string;
  hotkeyOf: (id: string) => number | null;
}) {
  const n = items.length;
  const size: 'lg' | 'md' | 'sm' = n > 14 ? 'sm' : n > 10 ? 'md' : 'lg';
  return (
    <div
      className="relative mx-auto w-full"
      style={{ height: 'clamp(420px, 58vh, 580px)' }}
      role="list"
      aria-label={label}
    >
      {center ? (
        <div className="absolute left-1/2 top-1/2 z-0 flex max-w-[44%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          {center}
        </div>
      ) : null}
      {items.map((it, i) => {
        const angle = ((-90 + i * (360 / n)) * Math.PI) / 180;
        const left = 50 + 41 * Math.cos(angle);
        const top = 50 + 40 * Math.sin(angle);
        return (
          <div
            key={it.id}
            role="listitem"
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size === 'lg' ? 108 : size === 'md' ? 92 : 76,
            }}
          >
            <Tile
              item={it}
              onPick={onPick}
              selectTone={selectTone}
              variant={size === 'lg' ? 'circle' : size === 'md' ? 'circle-md' : 'circle-sm'}
              hotkey={hotkeyOf(it.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

function Tile({
  item,
  onPick,
  selectTone,
  variant,
  hotkey,
}: {
  item: PickItem;
  onPick?: (id: string) => void;
  selectTone: 'accent' | 'wolf';
  variant: 'grid' | 'circle' | 'circle-md' | 'circle-sm';
  hotkey?: number | null;
}) {
  const interactive = !!onPick && !!item.selectable;
  const avatarSize =
    variant === 'grid' ? 40 : variant === 'circle' ? 52 : variant === 'circle-md' ? 44 : 36;
  const accent = selectTone === 'wolf' ? 'var(--team-wolf)' : 'var(--accent)';
  const compact = variant === 'circle-sm';

  const stateText = [
    item.me ? 'bạn' : '',
    !item.alive ? 'đã chết' : '',
    item.connected === false ? 'mất kết nối' : '',
    item.selected ? 'đang chọn' : '',
    item.sub ?? '',
  ]
    .filter(Boolean)
    .join(', ');

  const style: React.CSSProperties = {
    borderColor: item.selected ? accent : item.speaking ? 'var(--accent)' : 'var(--border)',
    boxShadow: item.selected
      ? `0 0 0 3px color-mix(in srgb, ${accent} 24%, transparent)`
      : item.speaking
        ? '0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent)'
        : undefined,
    background: item.selected ? 'var(--surface-raised)' : 'var(--surface)',
    opacity: !item.alive ? 0.55 : item.selectable === false && onPick ? 0.62 : 1,
  };

  const inner = (
    <>
      <span className="relative inline-flex">
        <Avatar
          index={item.avatar}
          size={avatarSize}
          dead={!item.alive}
          ring={item.ring ? toneColor[item.ring] : undefined}
        />
        {item.marks && item.marks.length > 0 ? (
          <span className="absolute -right-2.5 -top-1.5 flex">
            {item.marks.map((m, i) => (
              <span
                key={i}
                className="-ml-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-surface px-1 text-[11px] font-bold leading-none text-white"
                style={{ background: toneColor[m.tone] }}
              >
                {m.text}
              </span>
            ))}
          </span>
        ) : null}
        {item.hand ? (
          <span
            className="absolute -left-2 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-onaccent"
            title="Đang xin nói"
          >
            <Hand className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
        {item.speaking ? (
          <span className="absolute -bottom-1 -right-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-onaccent">
            <Mic className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </span>
      <span
        className={`w-full truncate text-center font-semibold leading-[18px] ${compact ? 'text-[12px]' : 'text-[14px]'}`}
      >
        {item.name}
      </span>
      {item.sub && !compact ? (
        <span
          className="w-full truncate text-center text-[11px] font-semibold leading-[14px]"
          style={{ color: toneColor[item.subTone ?? 'muted'] }}
        >
          {item.sub}
        </span>
      ) : null}
      {item.tag && !compact ? (
        <span
          className="w-full truncate text-center text-[11px] font-semibold leading-[14px]"
          style={{ color: toneColor[item.tag.tone] }}
        >
          {item.tag.text}
        </span>
      ) : null}
      {item.connected === false ? (
        <span className="text-[10px] font-semibold text-wolf">mất kết nối</span>
      ) : null}
      {hotkey ? (
        <span
          className="absolute left-1.5 top-1 rounded bg-bg2 px-1 text-[10px] font-bold text-muted"
          aria-hidden="true"
        >
          {hotkey}
        </span>
      ) : null}
    </>
  );

  const cls = `relative flex w-full flex-col items-center gap-1 rounded-card border-2 px-1 pb-2 pt-2.5 transition duration-150 ${
    variant === 'grid' ? 'min-h-[88px]' : ''
  } ${interactive ? 'hover:-translate-y-0.5 active:scale-[0.97]' : ''}`;

  if (!onPick) {
    return (
      <div
        className={cls}
        style={style}
        aria-label={`${item.name}${stateText ? ` — ${stateText}` : ''}`}
      >
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      style={style}
      disabled={!interactive}
      aria-pressed={item.selected ?? false}
      aria-label={`${item.name}${stateText ? ` — ${stateText}` : ''}`}
      onClick={() => onPick(item.id)}
    >
      {inner}
    </button>
  );
}

import type { ReactNode } from 'react';
import { PlayerPicker, type PickItem } from '../../components/PlayerPicker';
import { useIsDesktop } from '../../hooks/useBreakpoint';

interface StageProps {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
  items: PickItem[];
  onPick?: (id: string) => void;
  selectTone?: 'accent' | 'wolf';
  /** Nội dung thanh hành động (cố định đáy màn hình trên điện thoại). */
  footer?: ReactNode;
  hotkeys?: boolean;
  label: string;
  /** Nội dung thêm bên dưới sân khấu (kết quả phiếu…). */
  below?: ReactNode;
}

function CenterText({
  title,
  hint,
  icon,
  extra,
}: Pick<StageProps, 'title' | 'hint' | 'icon' | 'extra'>) {
  return (
    <div className="anim-rise flex flex-col items-center gap-1.5">
      {icon}
      <h2 className="font-display text-[26px] font-bold leading-tight lg:text-[30px]">{title}</h2>
      {hint ? <p className="max-w-sm text-[14px] leading-snug text-muted">{hint}</p> : null}
      {extra}
    </div>
  );
}

/** Khung chung: tiêu đề + chọn người + thanh hành động. Điện thoại: lưới + đáy cố định. Máy tính: vòng tròn. */
export function Stage({
  title,
  hint,
  icon,
  extra,
  items,
  onPick,
  selectTone,
  footer,
  hotkeys,
  label,
  below,
}: StageProps) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <div className="flex flex-col gap-4">
        <div className="card relative p-4">
          <PlayerPicker
            items={items}
            onPick={onPick}
            selectTone={selectTone}
            hotkeys={hotkeys}
            label={label}
            center={<CenterText title={title} hint={hint} icon={icon} extra={extra} />}
          />
        </div>
        {footer ? <div className="card p-4">{footer}</div> : null}
        {below}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${footer ? 'pb-40' : 'pb-6'}`}>
      <div className="px-1 text-center">
        <CenterText title={title} hint={hint} icon={icon} extra={extra} />
      </div>
      <PlayerPicker items={items} onPick={onPick} selectTone={selectTone} label={label} />
      {below}
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 safe-bottom">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Dòng trạng thái ngắn trong thanh hành động. */
export function BarNote({ children }: { children: ReactNode }) {
  return <p className="text-center text-[14px] font-medium text-muted">{children}</p>;
}

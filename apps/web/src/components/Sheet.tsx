import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Điện thoại: ngăn kéo từ dưới lên. Máy tính: panel trượt từ phải. */
export function Sheet({ open, title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="anim-fade absolute inset-0 bg-black/55"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet absolute flex flex-col bg-surface text-ink shadow-2xl outline-none max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[88dvh] max-lg:rounded-t-[24px] lg:right-0 lg:top-0 lg:h-full lg:w-[420px] lg:rounded-l-[24px]"
        style={{ borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <span
            className="mx-auto h-1 w-10 rounded-full bg-line lg:hidden"
            aria-hidden="true"
            style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)' }}
          />
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised hover:border-accent/60"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-6 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
}

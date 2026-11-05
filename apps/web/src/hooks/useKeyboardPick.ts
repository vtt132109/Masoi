import { useEffect } from 'react';

/**
 * Phím tắt trên máy tính: 1–9 chọn người thứ n, Enter xác nhận, Esc bỏ chọn.
 * Bỏ qua khi đang gõ vào ô nhập.
 */
export function useKeyboardPick(opts: {
  enabled: boolean;
  ids: string[];
  onSelect: (id: string) => void;
  onConfirm?: () => void;
  onClear?: () => void;
}) {
  const { enabled, ids, onSelect, onConfirm, onClear } = opts;
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [role="dialog"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        const id = ids[Number(e.key) - 1];
        if (id) onSelect(id);
      } else if (e.key === 'Enter' && onConfirm && !el?.closest('button')) {
        onConfirm();
      } else if (e.key === 'Escape') {
        onClear?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, ids, onSelect, onConfirm, onClear]);
}

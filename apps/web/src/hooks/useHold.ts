import { useCallback, useEffect, useState } from 'react';

/**
 * "Giữ để xem": trả về trạng thái đang giữ + props gắn vào nút.
 * Hỗ trợ chuột, cảm ứng và phím Space (khi `keyboard` bật).
 */
export function useHold(keyboard = true) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!keyboard) return;
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== 'Space' || el?.closest('input, textarea, select, button')) return;
      e.preventDefault();
      setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [keyboard]);

  const start = useCallback(() => setHeld(true), []);
  const stop = useCallback(() => setHeld(false), []);

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') start();
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') stop();
    },
    onBlur: stop,
    style: {
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    } as React.CSSProperties,
  };
  return { held, bind };
}

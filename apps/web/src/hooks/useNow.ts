import { useEffect, useState } from 'react';
import { useApp } from '../store';

/** Thời gian của server (ms), cập nhật `everyMs` một lần. */
export function useServerNow(everyMs = 250): number {
  const offset = useApp((s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, everyMs);
    return () => clearInterval(id);
  }, [offset, everyMs]);
  return now;
}

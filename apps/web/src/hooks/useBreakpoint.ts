import { useEffect, useState } from 'react';

/** true khi cửa sổ rộng ít nhất `px`. */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Máy tính (≥1024px): bố cục 3 cột và người chơi xếp vòng tròn. */
export const useIsDesktop = () => useMinWidth(1024);

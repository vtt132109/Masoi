import { useEffect, useRef } from 'react';

const STARS: [number, number, number, number][] = [
  [6, 8, 1.4, 0],
  [14, 22, 1, 1.2],
  [23, 6, 1.2, 0.6],
  [31, 17, 0.9, 2],
  [40, 9, 1.3, 0.3],
  [48, 24, 1, 1.7],
  [57, 7, 1.4, 0.9],
  [66, 19, 1, 2.4],
  [74, 11, 1.2, 0.2],
  [83, 25, 0.9, 1.4],
  [91, 9, 1.3, 0.8],
  [96, 21, 1, 2.1],
  [10, 34, 0.9, 1.1],
  [36, 31, 1, 0.5],
  [62, 33, 0.9, 1.9],
  [88, 38, 1, 0.7],
];

/** Nền làng nhiều lớp: bầu trời, đồi xa, mái nhà. Màu theo CSS variables nên tự đổi ngày/đêm. */
export function Scenery() {
  const ref = useRef<HTMLDivElement>(null);

  // Thị sai nhẹ theo chuột (chỉ máy tính, tắt khi giảm chuyển động).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      el.style.setProperty('--px', `${x * -10}px`);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%)' }}
    >
      <svg className="scenery-night absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {STARS.map(([x, y, r, d], i) => (
          <circle
            key={i}
            className="star"
            cx={`${x}%`}
            cy={`${y}%`}
            r={r}
            fill="var(--text)"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </svg>
      <div
        className="scenery-night absolute right-[8%] top-[7%] h-20 w-20 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(242 210 122 / 0.28), rgb(242 210 122 / 0) 70%)',
        }}
      />
      <div
        className="scenery-night absolute right-[10%] top-[9%] h-9 w-9 rounded-full"
        style={{ background: '#f2d27a', opacity: 0.16 }}
      />
      <div
        className="scenery-day absolute right-[8%] top-[7%] h-24 w-24 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(217 130 43 / 0.22), rgb(217 130 43 / 0) 70%)',
        }}
      />
      <div
        className="scenery-day absolute right-[10.5%] top-[10%] h-10 w-10 rounded-full"
        style={{ background: '#d9822b', opacity: 0.22 }}
      />

      <svg
        className="scenery-parallax absolute bottom-0 left-0 h-[28%] min-h-[120px] w-[108%] max-w-none"
        style={{ transform: 'translateX(var(--px, 0px))', left: '-4%' }}
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
      >
        <path
          d="M0 140 C150 100 280 120 420 130 C560 140 700 90 860 110 C980 124 1100 100 1200 120 L1200 220 L0 220 Z"
          fill="var(--scenery-2)"
          opacity="0.8"
        />
        <path
          d="M0 220 L0 175 L50 175 L50 150 L80 128 L110 150 L110 175 L190 175 L190 160 L225 136 L260 160 L260 175 L420 175 L420 158 L446 158 L446 140 L474 122 L502 140 L502 158 L528 158 L528 175 L700 175 L700 150 L735 124 L770 150 L770 175 L860 175 L860 164 L890 164 L890 146 L918 128 L946 146 L946 164 L974 164 L974 175 L1100 175 L1100 156 L1130 136 L1160 156 L1160 175 L1200 175 L1200 220 Z"
          fill="var(--scenery)"
        />
      </svg>
    </div>
  );
}

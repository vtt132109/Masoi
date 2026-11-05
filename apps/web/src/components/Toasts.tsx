import { useApp } from '../store';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`anim-pop pointer-events-auto max-w-md rounded-[14px] border px-4 py-3 text-left text-sm font-medium shadow-lg ${
            t.tone === 'error'
              ? 'border-wolf/60 bg-raised text-ink'
              : 'border-line bg-raised text-ink'
          }`}
          style={t.tone === 'error' ? { borderLeft: '4px solid var(--team-wolf)' } : undefined}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

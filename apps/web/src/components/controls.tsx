import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`flex min-h-12 items-center justify-between gap-4 py-1.5 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{label}</span>
        {hint ? <span className="block text-[13px] leading-snug text-muted">{hint}</span> : null}
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-7 w-12 rounded-full border border-line bg-raised transition peer-checked:border-transparent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-muted transition-all peer-checked:left-6 peer-checked:bg-onaccent" />
      </span>
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  step = 1,
  disabled,
  label,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  format?: (v: number) => string;
}) {
  const btn =
    'flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label={`Giảm ${label}`}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="tabular min-w-[3.2rem] text-center text-[15px] font-bold" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label={`Tăng ${label}`}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] border border-line bg-bg2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-h-10 rounded-[10px] px-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
              active ? 'bg-accent text-onaccent shadow' : 'text-muted hover:text-ink'
            } ${disabled && !active ? 'opacity-50' : ''}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

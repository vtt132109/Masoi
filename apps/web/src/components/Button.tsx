import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-onaccent hover:brightness-110 border border-transparent font-bold',
  secondary: 'bg-raised text-ink border border-line hover:border-accent/60 font-semibold',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-raised font-semibold',
  danger: 'bg-wolf text-white border border-transparent hover:brightness-110 font-bold',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm rounded-[10px] gap-1.5',
  md: 'min-h-12 px-4 text-[15px] rounded-[12px] gap-2',
  lg: 'min-h-[52px] px-5 text-base rounded-[14px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    icon,
    block,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : 'shrink-0 whitespace-nowrap'} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

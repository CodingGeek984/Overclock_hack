import { Loader2 } from 'lucide-react'

const VARIANT_CLASSES = {
  primary: 'bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm',
  neutral: 'bg-white text-zinc-900 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
  ghost: 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100',
  danger: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
  success: 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100',
  light: 'bg-white text-zinc-950 hover:bg-zinc-200',
  darkGhost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/10',
}

const SIZE_CLASSES = {
  sm: 'px-3.5 py-1.5 text-[13px] gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-7 py-3 text-base gap-2.5',
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false,
}) {
  const cls = [
    'inline-flex items-center justify-center rounded-full font-semibold transition-all',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15 focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ')

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cls}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}
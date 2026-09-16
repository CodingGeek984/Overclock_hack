import { Loader2 } from 'lucide-react'

const VARIANT_CLASSES = {
  primary: 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200 focus-visible:ring-zinc-300/40',
  neutral: 'bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 focus-visible:ring-zinc-500/30',
  ghost: 'bg-transparent text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-900 focus-visible:ring-zinc-500/30',
  danger: 'bg-rose-950/30 text-rose-300 border border-rose-800/50 hover:bg-rose-950/50 focus-visible:ring-rose-500/30',
  success: 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-950/50 focus-visible:ring-emerald-500/30',
}

const SIZE_CLASSES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

export default function Button({
  children,
  onClick,
  variant = 'neutral',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false,
}) {
  const cls = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950',
    'disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.99]',
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
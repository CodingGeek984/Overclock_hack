export default function Input({
  label,
  icon: Icon,
  error,
  hint,
  suffix,
  dark = false,
  className = '',
  ...props
}) {
  const inputCls = [
    'w-full rounded-2xl border text-sm py-2.5 px-4 transition-all',
    'focus:outline-none focus:ring-2',
    Icon ? 'pl-10' : '',
    suffix ? 'pr-14' : '',
    dark
      ? 'bg-white/[0.06] border-white/10 text-white placeholder:text-zinc-500 focus:border-white/30 focus:ring-white/10'
      : 'bg-zinc-100 border-transparent text-zinc-900 placeholder:text-zinc-500 focus:bg-white focus:ring-zinc-900/10',
    error
      ? dark
        ? 'border-rose-400/60 focus:ring-rose-400/20'
        : 'border-rose-300 focus:ring-rose-400/20'
      : '',
    !error && (dark ? 'focus:border-white/30' : 'focus:border-zinc-300'),
  ].join(' ')

  return (
    <label className={`block ${className}`}>
      {label && (
        <span
          className={`block text-xs font-semibold mb-1.5 ${
            dark ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          {label}
        </span>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={15}
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              dark ? 'text-zinc-500' : 'text-zinc-500'
            }`}
          />
        )}
        <input
          {...props}
          className={inputCls}
        />
        {suffix && (
          <span
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none ${
              dark ? 'text-zinc-400' : 'text-zinc-400'
            }`}
          >
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="block mt-1.5 text-xs font-medium text-rose-500">{error}</span>}
      {hint && !error && (
        <span className={`block mt-1.5 text-xs ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{hint}</span>
      )}
    </label>
  )
}
export default function Input({ label, icon: Icon, error, hint, suffix, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
          {label}
        </span>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
          />
        )}
        <input
          {...props}
          className={`w-full rounded-md bg-zinc-950 border text-sm text-zinc-100 placeholder:text-zinc-600 py-2 ${
            Icon ? 'pl-9' : 'pl-3'
          } ${suffix ? 'pr-16' : 'pr-3'} transition-colors focus:outline-none focus:ring-1 ${
            error
              ? 'border-rose-800/60 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-zinc-800 focus:border-zinc-500 focus:ring-zinc-500/20'
          }`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="block mt-1 text-xs text-rose-400">{error}</span>}
      {hint && !error && <span className="block mt-1 text-xs text-zinc-600">{hint}</span>}
    </label>
  )
}
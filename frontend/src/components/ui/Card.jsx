export default function Card({ children, title, subtitle, action, tone = 'light', className = '' }) {
  const toneCls =
    tone === 'dark'
      ? 'bg-zinc-950 text-white'
      : 'bg-white border border-zinc-200'

  return (
    <section className={`rounded-3xl p-6 sm:p-7 ${toneCls} ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            {title && (
              <h3 className="text-lg font-bold tracking-tight text-inherit">{title}</h3>
            )}
            {subtitle && (
              <p
                className={`text-sm mt-0.5 ${
                  tone === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
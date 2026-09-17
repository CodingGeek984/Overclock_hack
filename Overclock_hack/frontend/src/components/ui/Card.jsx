export default function Card({ children, title, subtitle, action, className = '' }) {
  return (
    <section className={`bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>
            )}
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
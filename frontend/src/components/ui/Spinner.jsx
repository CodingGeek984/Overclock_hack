export default function Spinner({ size = 18, label = 'Анализ...', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-zinc-500 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin"
        role="status"
        aria-label={label}
      >
        <circle cx="12" cy="12" r="10" stroke="#3f3f46" strokeOpacity="0.4" strokeWidth="2" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label && <span className="text-xs font-mono">{label}</span>}
    </span>
  )
}
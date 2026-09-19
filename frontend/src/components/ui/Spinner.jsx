export default function Spinner({ size = 20, label = 'Анализ...', className = '', dark = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${dark ? 'text-zinc-400' : 'text-zinc-500'} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin"
        role="status"
        aria-label={label}
      >
        <circle cx="12" cy="12" r="10" stroke={dark ? '#3f3f46' : '#e4e4e7'} strokeOpacity="1" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke={dark ? '#fafafa' : '#18181b'} strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm font-medium">{label}</span>}
    </span>
  )
}
import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    if (open) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className={`bg-white rounded-[28px] w-full ${width} shadow-2xl animate-fade-scale`}
      >
        <div className="flex items-start justify-between gap-3 p-6 border-b border-zinc-100">
          <div>
            {title && <h3 className="text-lg font-bold tracking-tight text-zinc-900">{title}</h3>}
            {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 p-6 pt-0">{footer}</div>
        )}
      </div>
    </div>
  )
}
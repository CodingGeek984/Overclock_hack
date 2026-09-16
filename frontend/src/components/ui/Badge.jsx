import { STATUS_META } from '../../utils/riskColors'

const SIZES = {
  xs: { chip: 'px-2.5 py-0.5 text-[11px]', dot: 5 },
  md: { chip: 'px-3 py-1 text-xs', dot: 6 },
  lg: { chip: 'px-3.5 py-1.5 text-sm', dot: 7 },
}

export default function Badge({ status, size = 'md', showDot = true }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  const s = SIZES[size] ?? SIZES.md

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide ${s.chip} ${meta.bg} ${meta.border} ${meta.text}`}
    >
      {showDot && <span className={`rounded-full ${meta.dot}`} style={{ width: s.dot, height: s.dot }} />}
      {meta.label}
    </span>
  )
}
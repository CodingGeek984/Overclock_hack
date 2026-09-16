export const STATUS = {
  APPROVE: 'APPROVE',
  CHALLENGE: 'CHALLENGE',
  BLOCK: 'BLOCK',
}

export const STATUS_META = {
  [STATUS.APPROVE]: {
    label: 'APPROVE',
    hex: '#34d399',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-800/50',
  },
  [STATUS.CHALLENGE]: {
    label: 'CHALLENGE 2FA',
    hex: '#fbbf24',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-800/50',
  },
  [STATUS.BLOCK]: {
    label: 'BLOCK',
    hex: '#fb7185',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-800/50',
  },
}

export function scoreToStatus(score) {
  if (score >= 80) return STATUS.BLOCK
  if (score >= 50) return STATUS.CHALLENGE
  return STATUS.APPROVE
}

export function scoreHex(score) {
  if (score >= 80) return STATUS_META.BLOCK.hex
  if (score >= 50) return STATUS_META.CHALLENGE.hex
  return STATUS_META.APPROVE.hex
}

export function statusHex(status) {
  return STATUS_META[status]?.hex ?? '#a1a1aa'
}

export function scaleColor(value, inverted = false) {
  const positive = inverted ? value <= 0 : value >= 0
  return positive ? STATUS_META.APPROVE.hex : STATUS_META.BLOCK.hex
}
export function formatKZT(amount) {
  const n = Math.round(Number(amount) || 0)
  return `${n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} ₸`
}

export function formatCompactKZT(amount) {
  const n = Number(amount) || 0
  if (n >= 1_000_000) {
    const millions = n / 1_000_000
    return `${millions.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}M ₸`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}K ₸`
  }
  return `${n} ₸`
}

export function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${min}:${ss}`
}

export function formatDateTime(value) {
  return `${formatDate(value)} ${formatTime(value)}`
}

export function maskCard(payload) {
  const card = String(payload || '').replace(/\s+/g, '')
  if (card.length < 8) return card || '—'
  return `${card.slice(0, 4)} ···· ···· ${card.slice(-4)}`
}

export function formatScore(score) {
  return `${Number(score || 0).toFixed(score % 1 !== 0 ? 1 : 0)}%`
}

export function pct(value) {
  return `${Number(value || 0)}%`
}

export function formatIp(ip) {
  return String(ip || '—')
}

export function toDate(value) {
  const match = String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (match) return new Date(+match[3], +match[2] - 1, +match[1])
  return value instanceof Date ? value : new Date(value)
}
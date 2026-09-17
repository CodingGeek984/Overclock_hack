export const BASE_THRESHOLD = 80
export const MIN_THRESHOLD = 40

const RISKY_MCC = /crypto|p2p|casino|gambl|bet/i

function getHour(transaction) {
  if (typeof transaction.hour === 'number') return transaction.hour
  if (transaction.time instanceof Date) return transaction.time.getHours()
  if (typeof transaction.time === 'string' && transaction.time) {
    const date = new Date(transaction.time)
    if (!Number.isNaN(date.getTime())) return date.getHours()
  }
  return null
}

export function getDynamicThreshold(transaction = {}) {
  let threshold = BASE_THRESHOLD
  const rules = []

  const hour = getHour(transaction)
  if (hour !== null && hour >= 1 && hour < 6) {
    threshold -= 15
    rules.push({ id: 'NIGHT_TIME', label: 'Ночной режим (01:00-06:00)', penalty: 15 })
  }

  if (RISKY_MCC.test(transaction.merchant || '')) {
    threshold -= 10
    rules.push({ id: 'RISKY_MCC', label: 'Категория высокого риска', penalty: 10 })
  }

  const finalThreshold = Math.max(threshold, MIN_THRESHOLD)

  return {
    baseThreshold: BASE_THRESHOLD,
    finalThreshold,
    rules,
    isStrict: finalThreshold < BASE_THRESHOLD,
  }
}
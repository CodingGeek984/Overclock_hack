import { apiGet, apiPost } from './api'
import { STATUS } from '../utils/riskColors'
import {
  countryCodeToName,
  countryToCode,
  detectVpn,
  deviceCodeToName,
  deviceToCode,
} from './backendMappings'

const CHECK_ENDPOINT = '/api/v1/transactions/check'
const STATS_ENDPOINT = '/api/v1/transactions/stats'
const LIST_ENDPOINT = '/api/v1/transactions/'

export function toBackendCheckPayload(form) {
  return {
    amount: Number(form.amount) || 0,
    country_code: countryToCode(form.country),
    device_code: deviceToCode(form.device),
    velocity_1h: Number(form.frequency) || 0,
    vpn: detectVpn(form.ip, form.device, form.merchant),
  }
}

export function checkTransaction(form) {
  const body = toBackendCheckPayload(form)
  return apiPost(CHECK_ENDPOINT, body)
}

export function fetchStats() {
  return apiGet(STATS_ENDPOINT)
}

export async function fetchTransactions() {
  const res = await apiGet(LIST_ENDPOINT)
  if (!res.ok) return res
  const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
  return { ok: true, data: rows }
}

function deriveScore(row) {
  if (row.is_fraud) {
    return Math.min(98, 80 + (row.vpn ? 10 : 0) + (row.velocity_1h >= 8 ? 8 : 0))
  }
  return Math.min(45, 6 + (row.vpn ? 14 : 0) + Math.min(20, (row.velocity_1h || 0) * 3))
}

export function mapBackendTx(row, index = 0, now = Date.now()) {
  const score = deriveScore(row)
  const status = row.is_fraud
    ? STATUS.BLOCK
    : score >= 50
      ? STATUS.CHALLENGE
      : STATUS.APPROVE

  return {
    id: `TX-${String(row.id ?? index + 1).padStart(5, '0')}`,
    date: new Date(now - index * 60000).toISOString(),
    amount: Number(row.amount) || 0,
    card: '—',
    ip: row.vpn ? 'VPN' : '—',
    country: countryCodeToName(row.country_code),
    country_code: String(row.country_code),
    merchant: row.vpn ? 'VPN / Proxy Channel' : 'Online Payment',
    device: deviceCodeToName(row.device_code),
    velocity_1h: row.velocity_1h,
    vpn: row.vpn,
    score,
    status,
    is_fraud: Boolean(row.is_fraud),
  }
}

export function mapBackendStats(stats) {
  const total = Number(stats.total_transactions) || 0
  const safe = Number(stats.safe_transactions) || 0
  return {
    total,
    blocked: Number(stats.blocked_frauds) || 0,
    safe,
    fraudLossSavedTg: Number(stats.fraud_loss_saved_tg) || 0,
    fprPct: Number(stats.false_positive_rate_pct) || 0,
    precisionPct: total > 0 ? ((safe / total) * 100) : 0,
  }
}
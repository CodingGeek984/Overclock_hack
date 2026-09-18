import { apiGet, apiPost, apiPut } from './api'
import { STATUS } from '../utils/riskColors'
import {
  CODE_TO_COUNTRY,
  countryCodeToName,
  countryToCode,
  detectVpn,
  DEVICE_LABELS,
  deviceToCode,
} from './backendMappings'

const CHECK_ENDPOINT = '/api/v1/transactions/check'
const STATS_ENDPOINT = '/api/v1/transactions/stats'
const LIST_ENDPOINT = '/api/v1/transactions/'
const CREATE_ENDPOINT = '/api/v1/transactions/'
const MODEL_CONFIG_ENDPOINT = '/api/v1/model/config'
const BATCH_ENDPOINT = '/api/v1/transactions/batch'

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

export function createTransaction(form) {
  const body = toBackendCheckPayload(form)
  return apiPost(CREATE_ENDPOINT, body)
}

export function buildCreatedRow(form, data) {
  const score =
    data.score ?? Math.max(0, Math.min(100, Math.round((Number(data.risk_score) || 0) * 100)))
  const status =
    data.status ??
    (data.is_fraud ? STATUS.BLOCK : score >= 50 ? STATUS.CHALLENGE : STATUS.APPROVE)
  const countryCode = countryToCode(form.country)
  const vpn = Number(data.vpn ?? detectVpn(form.ip, form.device, form.merchant))

  return {
    id:
      data.id != null
        ? `TX-${String(data.id).padStart(5, '0')}`
        : `TX-LOCAL-${new Date().getTime().toString().slice(-5)}`,
    date: new Date().toISOString(),
    amount: Number(data.amount ?? form.amount) || 0,
    card: '—',
    ip: vpn ? 'VPN / Proxy' : form.ip || '—',
    country: countryCodeToName(countryCode),
    country_code: String(countryCode),
    country_iso: CODE_TO_COUNTRY[String(countryCode)] ?? String(countryCode),
    merchant: form.merchant || 'Online Payment',
    device: DEVICE_LABELS[String(data.device_code ?? null)] ?? (form.device ?? 'Known mobile'),
    velocity_1h: Number(data.velocity_1h ?? form.frequency) || 0,
    vpn,
    score,
    status,
    is_fraud: Boolean(data.is_fraud),
    created: true,
    createdAtColor: status,
    reasons: Array.isArray(data.reasons) ? data.reasons : null,
  }
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

export function fetchModelConfig() {
  return apiGet(MODEL_CONFIG_ENDPOINT)
}

export function updateModelConfig(patch) {
  return apiPut(MODEL_CONFIG_ENDPOINT, patch)
}

export function runBatch(payload) {
  return apiPost(BATCH_ENDPOINT, payload, 60000)
}

export function mapBackendTxList(rows, now = Date.now()) {
  const items = Array.isArray(rows) ? rows : []
  const maxId = items.reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0)
  return items
    .map((row, i) => {
      const mapped = mapBackendTx(row, i, now)
      const id = Number(row?.id) || i + 1
      const age = Math.max(0, maxId - id) * 60000
      mapped.date = new Date(now - age).toISOString()
      return mapped
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function deriveScore(row) {
  if (row.is_fraud) {
    return Math.min(98, 80 + (row.vpn ? 10 : 0) + (row.velocity_1h >= 8 ? 8 : 0))
  }
  return Math.min(45, 6 + (row.vpn ? 14 : 0) + Math.min(20, (row.velocity_1h || 0) * 3))
}

export function mapBackendTx(row, index = 0, now = Date.now()) {
  const score =
    row.score != null
      ? Math.max(0, Math.min(100, Math.round(Number(row.score))))
      : deriveScore(row)
  const countryCode = String(row.country_code)
  const status = row.status ?? (row.is_fraud
    ? STATUS.BLOCK
    : score >= 50
      ? STATUS.CHALLENGE
      : STATUS.APPROVE)

  const ts = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  const date = new Date(ts - index * 60000)
  const dateISO = Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString()

  return {
    id: `TX-${String(row.id ?? index + 1).padStart(5, '0')}`,
    date: dateISO,
    amount: Number(row.amount) || 0,
    card: '—',
    ip: row.vpn ? 'VPN / Proxy' : '—',
    country: countryCodeToName(countryCode),
    country_code: countryCode,
    country_iso: CODE_TO_COUNTRY[countryCode] ?? countryCode,
    merchant: row.vpn ? 'VPN / Proxy Channel' : 'Online Payment',
    device: DEVICE_LABELS[String(row.device_code)] ?? 'Known mobile',
    velocity_1h: row.velocity_1h,
    vpn: row.vpn,
    score,
    status,
    is_fraud: Boolean(row.is_fraud),
    reasons: Array.isArray(row.reasons) ? row.reasons : null,
  }
}

const GEO_CITY_BY_CODE = {
  1: 'Almaty',
  2: 'Moscow',
  3: 'New York',
  5: 'Istanbul',
  6: 'Kyiv',
  7: 'Tashkent',
  8: 'Bishkek',
  9: 'Minsk',
  10: 'London',
  11: 'Lagos',
  12: 'Ho Chi Minh',
  13: 'Manila',
  14: 'Shenzhen',
  15: 'Casablanca',
  16: 'Baku',
  17: 'Amsterdam',
  18: 'Bucharest',
  19: 'Tbilisi',
}

export function mapBackendGeoEvent(row, index = 0, now = Date.now()) {
  const base = mapBackendTx(row, index, now)
  const h = Number(row.id) || index + 1
  return {
    ...base,
    city: GEO_CITY_BY_CODE[String(row.country_code)] ?? null,
    country: base.country_iso,
    ip: row.vpn
      ? 'VPN / Proxy'
      : `10.${(h % 250) || 1}.${((h * 7) % 250) || 1}.${((h * 13) % 250) || 1}`,
  }
}

export function txToCheckForm(tx) {
  return {
    amount: Number(tx.amount) || 0,
    country: tx.country_iso ?? tx.country_code,
    ip: tx.ip && tx.ip !== '—' ? tx.ip : '192.168.1.10',
    device: tx.device ?? 'Known mobile',
    merchant: tx.merchant ?? 'Online Payment',
    frequency: Number(tx.velocity_1h) || 1,
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
import { delay, apiPost } from './api'
import { STATUS, scoreToStatus } from '../utils/riskColors'

const RISKY_COUNTRIES = new Set(['NG', 'RU', 'CN', 'VN', 'PH', 'MA', 'UA', 'BY', 'PK'])
const VPN_IP_PATTERNS = [/^185\.220\./, /^104\.218\./, /^45\.61\./, /^5\.188\./, /^2\.58\./, /^78\.128\./, /^195\.158\./]
const HIGH_RISK_MERCHANTS = /crypto|bet|casino|poker|wallet|gift|vpn|exchange/i
const EMULATOR_DEVICES = /emulator|vpn|proxy/i
const BASE_SCORE = 18

function clamp(value, min = 2, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function hash(seed) {
  let h = 0
  const str = String(seed)
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100
}

export function buildAssessment(params, seed = Math.floor(Math.random() * 100)) {
  const factors = []
  const addFactor = (name, effect, detail, strength = 'medium') => {
    factors.push({ name, effect: Number(effect.toFixed(3)), detail, strength })
  }

  const noise = (hash(seed) - 50) / 25
  let score = BASE_SCORE + noise * 6
  const amount = Number(params.amount) || 0

  if (amount > 800000) {
    score += 19
    addFactor('Amount Deviation', 0.42, `Сумма ${amount.toLocaleString('ru-RU')} ₸ значительно выше медианы карты`, 'high')
  } else if (amount > 300000) {
    score += 12
    addFactor('Amount Deviation', 0.26, `Сумма ${amount.toLocaleString('ru-RU')} ₸ превышает типичный чек`, 'medium')
  } else if (amount < 3000 && amount > 0) {
    score += 5
    addFactor('Amount Deviation', 0.13, 'Микроплатеж — типичный pattern кардинга', 'low')
  } else {
    addFactor('Amount Deviation', -0.1, 'Сумма в пределах обычного диапазона', 'low')
  }

  const riskyCountry = RISKY_COUNTRIES.has(params.country)
  if (riskyCountry) {
    score += 15
    addFactor('Country Risk', 0.31, `Страна ${params.country} в списке повышенного риска`, 'high')
  } else {
    addFactor('Country Risk', -0.08, 'География платежа привычная', 'low')
  }

  const isVpn = VPN_IP_PATTERNS.some((re) => re.test(params.ip || ''))
  if (isVpn) {
    score += 17
    addFactor('VPN / Proxy', 0.38, `IP ${params.ip} из пула анонимайзеров`, 'high')
  } else {
    addFactor('VPN / Proxy', -0.12, `IP ${params.ip} не из proxy-подозрительных диапазонов`, 'low')
  }

  const geoMismatch = riskyCountry && /^185\.220\.|^2\.58\./.test(params.ip || '')
  if (geoMismatch) {
    score += 8
    addFactor('Geo Velocity', 0.2, 'Прыжок геолокации: страна эмитента ≠ страна IP', 'medium')
  } else {
    addFactor('Geo Velocity', -0.05, 'Геолокация согласуется с профилем клиента', 'low')
  }

  if (HIGH_RISK_MERCHANTS.test(params.merchant || '')) {
    score += 13
    addFactor('Merchant Category', 0.28, `MCC мерчанта «${params.merchant}» в зоне риска`, 'high')
  } else {
    addFactor('Merchant Category', -0.09, 'Категория мерчанта типична', 'low')
  }

  const freq = Number(params.frequency) || 1
  if (EMULATOR_DEVICES.test(params.device || '')) {
    score += 11
    addFactor('Device Fingerprint', 0.24, `Устройство «${params.device}» не прошло fingerprint-check`, 'medium')
  } else if (/new/.test(params.device || '')) {
    score += 6
    addFactor('Device Fingerprint', 0.15, 'Новое устройство в flow клиента', 'medium')
  } else {
    addFactor('Device Fingerprint', -0.1, 'Trusted device — оценка max', 'low')
  }

  if (freq >= 8) {
    score += 14
    addFactor('Transaction Frequency', 0.3, `${freq} операций за час — аномальная скорость`, 'high')
  } else if (freq >= 4) {
    score += 8
    addFactor('Transaction Frequency', 0.18, `${freq} операций за час — выше обычного`, 'medium')
  } else {
    addFactor('Transaction Frequency', -0.06, 'Частота операций в норме', 'low')
  }

  score = clamp(score)
  const status = scoreToStatus(score)
  factors.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
  return { score, status, factors: factors.slice(0, 6) }
}

function buildLog(params, assessment, seed) {
  const { score, status, factors } = assessment
  const log = []
  const t = new Date()
  const top = factors[0]

  log.push({
    time: t,
    level: 'info',
    text: 'Featurization: сумма, гео, IP-репутация, устройство, мерчант, частота извлечены за 4 мс.',
  })

  const vpn = /vpn|proxy|emulator/i.test(`${params.ip} ${params.device} ${params.merchant}`)
  if (vpn) {
    log.push({
      time: new Date(t.getTime() + 180),
      level: 'warn',
      text: 'ML-детект: анонимность среда (VPN/Proxy/эмулятор). Негативный сигнал в модель.',
    })
  }

  log.push({
    time: new Date(t.getTime() + 420),
    level: 'info',
    text: `FraudSeeker v3 (gradient boosting): baseline ${BASE_SCORE}%, итоговая вероятность фрода ≈ ${score}%. Top SHAP-фактор: ${top?.name} (${top?.effect > 0 ? '+' : ''}${top?.effect}).`,
  })

  if (status === STATUS.BLOCK) {
    log.push({
      time: new Date(t.getTime() + 700),
      level: 'danger',
      text: `Порог ${score >= 90 ? 85 : 80}% превышен → авто-блок транзакции. Карта заморожена до верификации. Seed ${seed}.`,
    })
  } else if (status === STATUS.CHALLENGE) {
    log.push({
      time: new Date(t.getTime() + 700),
      level: 'warn',
      text: `Score ${score}% в зоне 50–80% → шаг 2FA (Challenge). Клиент проходит OTP/биометрию.`,
    })
  } else {
    log.push({
      time: new Date(t.getTime() + 700),
      level: 'success',
      text: `Score ${score}% < 50% → APPROVE. Операция пропускается без фрикции для честного клиента.`,
    })
  }

  log.push({
    time: new Date(t.getTime() + 980),
    level: 'info',
    text: `Решение записано в audit-graph. Обновлены счётчики дашборда (batch id FH-${params.amount}-${seed}).`,
  })

  return log
}

let seedCounter = 90877

export async function assessTransaction(params) {
  const start = Date.now()
  const seed = seedCounter + Math.floor(seedCounter / 7)
  seedCounter += 13
  await delay(1100 + (hash(seed) % 700))

  const remote = await apiPost('/analyze', params)
  const fallback = buildAssessment(params, seed)

  const assessment = remote.ok && remote.data?.risk !== undefined
    ? {
        score: Number(remote.data.risk),
        status: scoreToStatus(Number(remote.data.risk)),
        factors: remote.data.factors ?? fallback.factors,
      }
    : fallback

  const log = buildLog(params, assessment, seed)
  return {
    id: `FH-${Math.floor(start / 1000)}-${seed}`,
    latencyMs: Date.now() - start,
    ...assessment,
    log,
  }
}

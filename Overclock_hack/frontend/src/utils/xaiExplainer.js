import { scoreToStatus, STATUS_META } from './riskColors'
import { formatDateTime, formatKZT, maskCard } from './formatters'
import { COUNTRIES } from '../services/mockData'

const FACTOR_CODES = {
  'VPN / Proxy': 'VPN_PROXY',
  'Amount Deviation': 'AMOUNT_DEV',
  'Country Risk': 'GEO_RISK',
  'Merchant Category': 'MCC_RISK',
  'Device Fingerprint': 'DEVICE_ANOM',
  'Transaction Frequency': 'VELOCITY',
  'Geo Velocity': 'GEO_VELOCITY',
}

const FACTOR_LABELS = {
  'Amount Deviation': 'Сумма операции',
  'Country Risk': 'Страна операции',
  'VPN / Proxy': 'Анонимизирующая сеть',
  'Geo Velocity': 'Гео-скорость',
  'Merchant Category': 'Категория мерчанта',
  'Device Fingerprint': 'Устройство',
  'Transaction Frequency': 'Частота операций',
}

const COUNTRIES_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]))

const SEVERITY_TEXT = {
  high: 'критичный',
  medium: 'умеренный',
  low: 'незначительный',
}

function countryName(code) {
  return COUNTRIES_BY_CODE[code] ?? code
}

function sortFactors(factors = [], topN) {
  return [...factors].sort(
    (a, b) => Math.abs(b.effect) - Math.abs(a.effect)
  ).slice(0, topN)
}

function contributionPct(effect, totalPositive) {
  if (effect <= 0 || totalPositive <= 0) return 0
  return Math.round((effect / totalPositive) * 100)
}

function severityOf(factor) {
  const hit = { high: 0.3, medium: 0.18, low: 0.1 }
  const byStrength = { high: 'high', medium: 'medium', low: 'low' }
  if (factor.strength && byStrength[factor.strength]) return byStrength[factor.strength]
  const abs = Math.abs(factor.effect)
  if (abs >= hit.high) return 'high'
  if (abs >= hit.medium) return 'medium'
  return 'low'
}

export function topFactors(assessment, topN = 5) {
  const all = sortFactors(assessment?.factors, undefined)
  const factors = topN == null ? all : all.slice(0, topN)
  const totalPositive = all.filter((f) => f.effect > 0).reduce((s, f) => s + f.effect, 0) || 1

  return factors.map((factor) => {
    const effect = Number(factor.effect)
    const pct = contributionPct(effect, totalPositive)
    const severity = severityOf(factor)
    const positiveEffect = effect > 0
    return {
      code: FACTOR_CODES[factor.name] ?? factor.name.toUpperCase().replace(/[^\w]+/g, '_'),
      name: factor.name,
      label: FACTOR_LABELS[factor.name] ?? factor.name,
      effect,
      contributionPct: pct,
      severity,
      positive: positiveEffect,
      detail: factor.detail ?? '',
      plainText: factor.detail
        ? factor.detail
        : `${FACTOR_LABELS[factor.name] ?? factor.name} повлиял на оценку модели.`,
      summary: positiveEffect
        ? `${FACTOR_LABELS[factor.name] ?? factor.name}: ${factor.detail ?? 'повышенный риск'}. Вклад в риск ${SEVERITY_TEXT[severity]}.`
        : `${FACTOR_LABELS[factor.name] ?? factor.name} в норме — риск снижен.`,
    }
  })
}

export function buildSummary(assessment, params = {}, threshold = 80) {
  const factors = sortFactors(assessment?.factors, undefined)
  const positive = factors.filter((f) => f.effect > 0)
  const score = Math.round(assessment?.score ?? 0)
  const status = assessment?.status ?? scoreToStatus(score)
  const meta = STATUS_META[status]

  const top = topFactors(assessment, 1)[0]

  return {
    score,
    status,
    verdictLabel: meta?.label ?? status,
    verdictText:
      status === 'BLOCK'
        ? 'Транзакция заблокирована автоматически как высокорисковая.'
        : status === 'CHALLENGE'
          ? 'Транзакция отклонена для дополнительной проверки (2FA).'
          : 'Транзакция признана безопасной.',
    threshold,
    comparedToThreshold: score >= threshold ? 'выше' : 'ниже',
    topFactor: top?.name ?? null,
    topFactorLabel: top?.label ?? null,
    topFactorContribution: top?.contributionPct ?? 0,
    riskDrivers: positive.map((f) => FACTOR_CODES[f.name] ?? f.name),
    factorCount: factors.length,
  }
}

function buildTxBlock(payload) {
  const params = payload.params ?? {}
  const tx = payload.tx ?? {}
  return [
    `Сумма:           ${formatKZT(params.amount ?? tx.amount ?? 0)}`,
    `Карта:           ${maskCard(tx.card)}`,
    `Мерчант:         ${params.merchant ?? tx.merchant ?? '—'}`,
    `Устройство:      ${params.device ?? tx.device ?? '—'}`,
    `IP-адрес:        ${params.ip ?? tx.ip ?? '—'}`,
    `Страна:          ${countryName(params.country ?? tx.country)} (${params.country ?? tx.country ?? '—'})`,
    `Частота:         ${params.frequency ?? tx.frequency ?? 0} опер./час`,
  ].join('\n')
}

export function buildSupportReport(payload, opts = {}) {
  const assessment = payload.assessment ?? {}
  const params = payload.params ?? {}
  const tx = payload.tx ?? {}
  const threshold = opts.threshold ?? 80
  const topN = opts.topN ?? 5
  const analyst = opts.analyst ?? '—'
  const id = tx.id ?? payload.id ?? assessment.id ?? 'FH-XAI-0000'

  const summary = buildSummary(assessment, params, threshold)
  const factors = topFactors(assessment, topN)
  const generatedAt = new Date()

  const lines = [
    'FraudSeeker — Explainable AI (XAI) отчет',
    '==========================================',
    '',
    `Отчет:          ${id}`,
    `Создан:         ${formatDateTime(generatedAt)}`,
    `Статус:         ${summary.verdictLabel} (score ${summary.score}%)`,
    '',
    '— Параметры транзакции —',
    buildTxBlock(payload),
    '',
    '— Решение модели —',
    `Risk score:   ${summary.score}% (опорный порог ${summary.threshold}%) → ${summary.verdictLabel}`,
    summary.topFactor
      ? `Ключевой признак: ${summary.topFactorLabel} (вклад ${summary.topFactorContribution}%)`
      : 'Ключевой признак: —',
    summary.verdictText,
    '',
    `— Top-${topN} признаков (SHAP) —`,
    ...factors.map((f, i) => {
      const sign = f.effect >= 0 ? '+' : ''
      return [
        `${i + 1}. ${f.label} [${f.code}] (SHAP ${sign}${f.effect.toFixed(3)}, вклад ${f.contributionPct}%)`,
        `   ${f.plainText}`,
      ].join('\n')
    }),
    '',
    '— Рекомендация —',
    summary.status === 'BLOCK'
      ? 'Удерживать авто-блок. Запросить верификацию владельца (3DS / биометрия) перед повторной попыткой.'
      : summary.status === 'CHALLENGE'
        ? 'Провести шаг 2FA. Если подтверждение не получено за 5 минут — повысить статус до BLOCK.'
        : 'Пропустить операцию. Отметить в профиле клиента как нормальную гео/сеть активность.',
    '',
    '— Служебная информация —',
    `Сгенерировано: XAI Explainer v1.0 · FraudSeeker`,
    analyst !== '—' ? `Аналитик:      ${analyst}` : '',
    '',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n')

  return lines
}

export function buildClientMessage(payload, opts = {}) {
  const assessment = payload.assessment ?? {}
  const params = payload.params ?? {}
  const tx = payload.tx ?? {}
  const lang = opts.language ?? 'ru'
  const status = assessment.status ?? scoreToStatus(assessment.score ?? 0)

  const amount = formatKZT(params.amount ?? tx.amount ?? 0)
  const cardMasked = maskCard(tx.card) || '****'
  const merchant = params.merchant ?? tx.merchant ?? 'продавец'
  const top = topFactors(assessment, 3).filter((f) => f.positive)

  const reasons = top.slice(0, 2).map((f) => `• ${f.plainText}`)

  const byLang = {
    ru: {
      hello: 'Уважаемый клиент!',
      lead:
        `Мы зафиксировали попытку операции по вашей карте ${cardMasked} ` +
        `на сумму ${amount} у продавца «${merchant}». Платёж ${status === 'BLOCK' ? 'заблокирован' : 'требует подтверждения'} службой безопасности.`,
      whyTitle: 'Почему это могло произойти:',
      whatTitle: 'Что делать:',
      doA: 'Если операцию совершали вы — подтвердите её в приложении.',
      doB: 'Если это не вы — карта уже заморожена; обратитесь в поддержку.',
      bye: 'FraudSeeker · служба безопасности',
    },
    kk: {
      hello: 'Құрметті клиент!',
      lead:
        `${cardMasked} картаңызда ${amount} сомаға «${merchant}» сатушысы арқылы операция әрекеті тіркелді. ` +
        `Төлем қауіпсіздік қызметі тарапынан ${status === 'BLOCK' ? 'бұғатталды' : 'растауды қажет етеді'}.`,
      whyTitle: 'Неге бұл орын алуы мүмкін:',
      whatTitle: 'Не істеу керек:',
      doA: 'Операцияны сіз жасасаңыз — қосымшада растаңыз.',
      doB: 'Бұл сіз емес болсаңыз — карта қатырылды; қолдау қызметіне хабарласыңыз.',
      bye: 'FraudSeeker · қауіпсіздік қызметі',
    },
    en: {
      hello: 'Dear customer!',
      lead:
        `We registered an attempt to charge your card ${cardMasked} ` +
        `for ${amount} at merchant “${merchant}”. The payment has been ${status === 'BLOCK' ? 'blocked' : 'held for confirmation'} by our security team.`,
      whyTitle: 'Why this may have happened:',
      whatTitle: 'What to do:',
      doA: 'If the operation was yours, please confirm it in the app.',
      doB: 'If it was not you, the card is already frozen; contact support.',
      bye: 'FraudSeeker · Security',
    },
  }

  const dict = byLang[lang] ?? byLang.ru

  return [
    dict.hello,
    '',
    dict.lead,
    '',
    dict.whyTitle,
    ...(reasons.length > 0 ? reasons : ['• Система отметила сочетание факторов, типичных для мошеннических сценариев.']),
    '',
    dict.whatTitle,
    `1. ${dict.doA}`,
    `2. ${dict.doB}`,
    '',
    dict.bye,
    '',
  ].join('\n')
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export { FACTOR_CODES, FACTOR_LABELS, SEVERITY_TEXT }
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Bot,
  Clock,
  Download,
  FileText,
  Globe,
  MapPin,
  Send,
  ShieldOff,
  Smartphone,
  Sparkles,
  Store,
  Wifi,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { buildAssessment } from '../../services/fraudApi'
import {
  checkTransaction,
  fetchTransactions,
  mapBackendTxList,
  txToCheckForm,
} from '../../services/transactionsApi'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import RiskDonut from '../../components/charts/RiskDonut'
import Spinner from '../../components/ui/Spinner'
import { formatDateTime, formatKZT, maskCard } from '../../utils/formatters'
import { STATUS, STATUS_META } from '../../utils/riskColors'
import {
  buildClientMessage,
  buildSummary,
  buildSupportReport,
  downloadTextFile,
  topFactors,
} from '../../utils/xaiExplainer'

const FACTOR_ICON = {
  'Amount Deviation': Banknote,
  'Country Risk': Globe,
  'VPN / Proxy': ShieldOff,
  'Geo Velocity': MapPin,
  'Merchant Category': Store,
  'Device Fingerprint': Smartphone,
  'Transaction Frequency': Clock,
}

const SEVERITY_CLASS = {
  high: 'bg-rose-400/10 text-rose-300 border-rose-500/20',
  medium: 'bg-amber-400/10 text-amber-300 border-amber-500/20',
  low: 'bg-zinc-400/10 text-zinc-400 border-white/10',
}

const SEVERITY_LABEL = {
  high: 'критично',
  medium: 'умеренно',
  low: 'слабо',
}

function FactorRow({ factor }) {
  const Icon = FACTOR_ICON[factor.name] ?? Wifi
  const color = factor.positive ? '#fb7185' : '#34d399'
  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4 animate-fade-in">
      <div className="flex items-start gap-3.5">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon size={16} strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{factor.label}</span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_CLASS[factor.severity] ?? SEVERITY_CLASS.low}`}
              >
                {SEVERITY_LABEL[factor.severity]}
              </span>
              <span className="text-sm font-mono font-bold tabular-nums shrink-0" style={{ color }}>
                {factor.positive ? '+' : ''}
                {factor.effect.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{factor.plainText}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${factor.contributionPct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {factor.contributionPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SnapshotRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-semibold text-zinc-500">{label}</span>
      <span className={`text-sm text-zinc-900 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function statusFromData(data, risk) {
  if (data?.is_fraud) return STATUS.BLOCK
  return risk >= 50 ? STATUS.CHALLENGE : STATUS.APPROVE
}

export default function XaiCenter() {
  const { t, lang } = useLanguage()
  const [txs, setTxs] = useState([])
  const [txId, setTxId] = useState(null)
  const [loadingTx, setLoadingTx] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)
  const [liveInfo, setLiveInfo] = useState(null)
  const [liveAssessment, setLiveAssessment] = useState(null)
  const [topN, setTopN] = useState(5)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetchTransactions()
      if (cancelled) return
      if (res.ok) {
        const rows = mapBackendTxList(res.data)
        setTxs(rows)
        setTxId((prev) => prev ?? rows[0]?.id ?? null)
        setChecking(true)
      } else {
        setError(res.error)
      }
      setLoadingTx(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tx = useMemo(() => txs.find((row) => row.id === txId) ?? txs[0] ?? null, [txs, txId])
  const params = useMemo(() => (tx ? txToCheckForm(tx) : null), [tx])

  const baseAssessment = useMemo(
    () =>
      params
        ? buildAssessment(params, 42)
        : { score: 0, status: STATUS.APPROVE, factors: [] },
    [params],
  )

  useEffect(() => {
    if (!params) return
    let cancelled = false
    ;(async () => {
      const res = await checkTransaction(params)
      if (cancelled) return
      if (res.ok) {
        const risk = Math.max(0, Math.min(100, Math.round((Number(res.data?.risk_score) || 0) * 100)))
        setLiveAssessment({ score: risk, status: statusFromData(res.data, risk) })
        setLiveInfo({
          message: res.data?.message ?? '',
          explanation: res.data?.explanation ?? '',
        })
        setSource('live')
        setError(null)
      } else {
        setLiveAssessment(null)
        setSource('fallback')
        setError(res.error)
      }
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [params])

  const handleTxChange = (id) => {
    if (id === txId) return
    setTxId(id)
    setChecking(true)
    setLiveInfo(null)
    setSource(null)
    setLiveAssessment(null)
    setError(null)
  }

  const assessment = useMemo(() => {
    if (!liveAssessment) return baseAssessment
    return { ...baseAssessment, score: liveAssessment.score, status: liveAssessment.status }
  }, [baseAssessment, liveAssessment])

  const summary = useMemo(() => buildSummary(assessment, params, 80), [assessment, params])
  const factors = useMemo(() => topFactors(assessment, topN), [assessment, topN])
  const meta = STATUS_META[summary.status]

  const payload = useMemo(() => ({ tx, params, assessment }), [tx, params, assessment])

  const handleSupportReport = () => {
    const report = buildSupportReport(payload, { threshold: 80, topN })
    downloadTextFile(`${tx.id}-xai-report.txt`, report)
  }

  const handleClientMessage = () => {
    const message = buildClientMessage(payload, { language: lang })
    downloadTextFile(`${tx.id}-client.txt`, message)
  }

  if (loadingTx) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-400">
        <Spinner size={28} label="" />
        <span className="text-sm">{t.dashboardLoading}</span>
      </div>
    )
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      <div className="space-y-7 pt-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white pl-1.5 pr-4 py-1.5 text-xs font-semibold">
          <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
            <Sparkles size={11} className="text-white" />
          </span>
          {t.xaiCenterBadge}
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-[54px] font-extrabold tracking-tight text-zinc-950 leading-[1.05]">
            {t.xaiCenterTitle}
          </h1>
          <p className="text-lg text-zinc-500 max-w-[460px] leading-relaxed">{t.xaiCenterSubtitle}</p>
        </div>

        <div className="rounded-[28px] bg-white border border-zinc-200 p-6 sm:p-7 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2.5 animate-fade-in">
              <ShieldOff size={15} className="text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-700">{t.backendUnavailable}</p>
                <p className="text-xs text-rose-500 truncate">{error}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-950">{t.xaiPickTx}</h2>
              <p className="text-sm text-zinc-500 mt-0.5">{t.xaiPickSub}</p>
            </div>
            <Badge status={summary.status} size="md" />
          </div>

          <select
            value={txId}
            onChange={(e) => handleTxChange(e.target.value)}
            className="w-full rounded-2xl bg-zinc-100 border border-transparent text-zinc-900 text-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:bg-white focus:ring-zinc-900/10 appearance-none"
          >
            {txs.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id} · {formatKZT(row.amount)} · {row.country} · {row.status}
              </option>
            ))}
          </select>

          <div className="pt-1 border-t border-zinc-100">
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-500">Транзакция</div>
                <div className="text-lg font-extrabold tracking-tight text-zinc-950 truncate">
                  {tx.id}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-zinc-500">Сумма</div>
                <div className="text-lg font-mono font-bold text-zinc-950">{formatKZT(tx.amount)}</div>
              </div>
            </div>

            <div>
              <SnapshotRow label={t.thDate} value={formatDateTime(tx.date)} />
              <SnapshotRow label={t.thCard} value={maskCard(tx.card)} mono />
              <SnapshotRow label={t.thMerchant} value={tx.merchant} />
              <SnapshotRow label={t.country} value={tx.country} />
              <SnapshotRow label={t.ip} value={tx.ip} mono />
              <SnapshotRow label={t.device} value={tx.device} />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {t.xaiTopN}
            </span>
            <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTopN(n)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    topN === n ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Top-{n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <div className="rounded-[32px] bg-zinc-950 text-white p-6 sm:p-8 shadow-2xl shadow-zinc-900/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {t.xaiInference}
              </div>
              <h2 className="text-xl font-bold tracking-tight mt-1">{t.xaiExplanation}</h2>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-zinc-500">
                tx <span className="text-zinc-300">{tx.id}</span>
              </div>
              <div
                className="font-mono text-xs mt-0.5 font-bold"
                style={{ color: meta?.hex }}
              >
                {summary.verdictLabel} · {summary.score}%
              </div>
              <div className="font-mono text-[10px] font-bold mt-1">
                {checking && <span className="text-zinc-500 animate-pulse">● checking…</span>}
                {!checking && source === 'live' && (
                  <span className="text-emerald-400">● live · backend</span>
                )}
                {!checking && source === 'fallback' && (
                  <span className="text-amber-400">● fallback · local engine</span>
                )}
              </div>
            </div>
          </div>

          <RiskDonut value={summary.score} />

          <div className="mt-6 rounded-2xl bg-white/[0.05] border border-white/10 p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
              <ShieldOff size={12} />
              {t.xaiWhy}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {summary.status === 'BLOCK' || summary.status === 'CHALLENGE' ? (
                <>
                  {summary.verdictText}{' '}
                  {summary.topFactor && (
                    <span className="text-white">
                      Основной вклад вносит признак «{summary.topFactorLabel}» — на него приходится{' '}
                      {summary.topFactorContribution}% суммарного риска.
                    </span>
                  )}
                </>
              ) : (
                summary.verdictText
              )}
            </p>
          </div>

          {liveInfo && (
            <div className="mt-3 rounded-2xl bg-white/[0.05] border border-white/10 p-4 animate-fade-in">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <Bot size={12} className="text-zinc-500" />
                {t.serverMessage}
              </div>
              <p className="mt-2 text-sm text-zinc-200 leading-relaxed">{liveInfo.message}</p>
              {liveInfo.explanation && (
                <>
                  <div className="mt-3 pt-3 border-t border-white/10 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {t.serverExplanation}
                  </div>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                    {liveInfo.explanation}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-6 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                {t.topShapFactors} · Top-{topN}
              </p>
              <span className="font-mono text-[11px] text-zinc-600">{summary.factorCount} факторов</span>
            </div>
            {factors.map((factor) => (
              <FactorRow key={factor.code} factor={factor} />
            ))}
          </div>

          <div className="mt-7 pt-5 border-t border-white/10">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3">
              {t.xaiExport}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button variant="light" size="md" onClick={handleSupportReport}>
                <FileText size={14} /> {t.xaiSupportReport}
              </Button>
              <Button variant="success" size="md" onClick={handleClientMessage}>
                <Send size={14} /> {t.xaiClientMessage}
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-600">
              <Download size={11} />
              <span>{t.xaiDownloadHint}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
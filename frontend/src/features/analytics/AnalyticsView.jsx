import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  DollarSign,
  Gauge,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'
import {
  fetchAnalyticsKPIs,
  fetchAnalyticsTradeoff,
  fetchModelConfig,
} from '../../services/transactionsApi.js'
import Spinner from '../../components/ui/Spinner.jsx'
import TradeoffVisualizer from '../dashboard/TradeoffVisualizer.jsx'
import { formatCompactKZT } from '../../utils/formatters.js'

function MetricTile({ icon: Icon, label, value, sub, tone = 'light' }) {
  const dark = tone === 'dark'
  return (
    <div
      className={`rounded-3xl p-5 ${
        dark ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className={dark ? 'text-zinc-500' : 'text-zinc-400'} />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${
            dark ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          {label}
        </span>
      </div>
      <div className="mt-2.5 text-2xl font-extrabold font-mono tracking-tight leading-none">
        {value}
      </div>
      {sub && (
        <div className={`mt-1.5 text-[11px] font-mono ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {sub}
        </div>
      )}
    </div>
  )
}

function ConfigRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-bold font-mono text-white">{value}</span>
    </div>
  )
}

export default function AnalyticsView() {
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // /api/v1/analytics/model/config
  const [modelConfig, setModelConfig] = useState(null)

  // /api/v1/analytics/kpis
  const [kpi, setKpi] = useState(null)

  // /api/v1/analytics/tradeoff
  const [tradeoffCurve, setTradeoffCurve] = useState([])
  const [tradeoffSnapshot, setTradeoffSnapshot] = useState(null)
  const [tradeoffError, setTradeoffError] = useState(null)

  const aliveRef = useRef(true)

  const load = useCallback(async () => {
    aliveRef.current = true
    setLoading(true)
    setError(null)

    const [configRes, kpiRes, tradeoffRes] = await Promise.all([
      fetchModelConfig(),
      fetchAnalyticsKPIs(),
      fetchAnalyticsTradeoff(),
    ])
    if (!aliveRef.current) return

    if (configRes.ok) setModelConfig(configRes.data)
    else if (configRes.error && !configRes.error.includes('404')) setError(configRes.error)

    if (kpiRes.ok) setKpi(kpiRes.data)
    else if (kpiRes.error && !kpiRes.error.includes('404')) setError(kpiRes.error)

    if (tradeoffRes.ok && tradeoffRes.data) {
      setTradeoffSnapshot({
        falsePositiveRatePct: Number(tradeoffRes.data.false_positive_rate_pct) || 0,
        fraudLossSavedTg: Number(tradeoffRes.data.fraud_loss_saved_tg) || 0,
      })
      if (Array.isArray(tradeoffRes.data)) setTradeoffCurve(tradeoffRes.data)
      setTradeoffError(null)
    } else {
      setTradeoffSnapshot(null)
      setTradeoffCurve([])
      setTradeoffError(tradeoffRes.error ?? null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    aliveRef.current = true
    const timer = setTimeout(() => load(), 0)
    return () => {
      aliveRef.current = false
      clearTimeout(timer)
    }
  }, [load])

  const model = modelConfig?.model ?? null
  const threshold = modelConfig?.threshold ?? null
  const version = modelConfig?.version ?? null

  const kpiTiles = useMemo(() => {
    if (!kpi) return []
    const fallback = (v, def = '—') => (v == null ? def : v)
    return [
      {
        icon: Activity,
        label: t.anTotalTx,
        value: fallback(kpi.total_transactions)?.toLocaleString?.('ru-RU') ?? fallback(kpi.total_transactions),
        sub: 'total_transactions',
      },
      {
        icon: ShieldOff,
        label: t.anBlocked,
        value: fallback(kpi.blocked_frauds ?? kpi.blocked_transactions),
        sub: 'blocked_frauds',
        tone: 'light',
      },
      {
        icon: ShieldCheck,
        label: t.anSafe,
        value: fallback(kpi.safe_transactions),
        sub: 'safe_transactions',
      },
      {
        icon: DollarSign,
        label: t.anSaved,
        value: kpi.fraud_loss_saved
          ? formatCompactKZT(kpi.fraud_loss_saved)
          : tradeoffSnapshot
            ? formatCompactKZT(tradeoffSnapshot.fraudLossSavedTg)
            : '—',
        sub: 'fraud_loss_saved_tg',
      },
      {
        icon: Gauge,
        label: t.anFpr,
        value: `${fallback(kpi.false_positive_rate ?? tradeoffSnapshot?.falsePositiveRatePct, '—')}%`,
        sub: 'false_positive_rate_pct',
      },
      {
        icon: TrendingUp,
        label: t.anPrecision,
        value: `${fallback(kpi.precision, '—')}%`,
        sub: 'precision',
      },
      {
        icon: TrendingDown,
        label: t.anRecall,
        value: `${fallback(kpi.recall, '—')}%`,
        sub: 'recall',
      },
      {
        icon: Target,
        label: t.anOptimal,
        value: kpi.optimal_threshold != null ? `${kpi.optimal_threshold}%` : '—',
        sub: 'optimal_threshold',
      },
    ].filter(Boolean)
  }, [kpi, tradeoffSnapshot, t])

  const hasLive = modelConfig != null || kpi != null || tradeoffSnapshot != null

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 text-white px-3.5 py-1.5 text-xs font-bold tracking-wide">
            <Zap size={12} />
            {t.anBadge}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              hasLive ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'
            }`}
          >
            {hasLive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t.anLive}
              </>
            ) : (
              t.anOffline
            )}
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
          {t.anTitle}
        </h1>
        <p className="text-sm text-zinc-400 font-mono max-w-2xl">{t.anSubtitle}</p>
      </div>

      {/* Error banner */}
      {error && !hasLive && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-700">{t.backendUnavailable}</p>
            <p className="text-xs text-rose-500 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-rose-200 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
          >
            <RotateCcw size={13} />
            {t.retry ?? 'Повторить'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-zinc-400">
          <Spinner size={24} label="" />
          <span className="text-sm">{t.dashboardLoading}</span>
        </div>
      ) : (
        <>
          {/* Model config card — GET /api/v1/analytics/model/config */}
          <section aria-label="Model config">
            <div
              className="rounded-[32px] text-white p-6 sm:p-8"
              style={{ background: 'linear-gradient(135deg, #09090b 0%, #111113 100%)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">
                    {t.anModelConfig}
                  </h3>
                </div>
                {model && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 px-3 py-1.5 text-xs font-bold text-violet-300 shrink-0">
                    <Bot size={12} />
                    {model}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
                <ConfigRow label={t.anModelType} value={model ?? '—'} />
                <ConfigRow label={t.anVersion} value={version ?? '—'} />
                <ConfigRow
                  label={t.anThreshold}
                  value={threshold != null ? `${Math.round(threshold * 100)}%` : '—'}
                />
              </div>
            </div>
          </section>

          {/* KPI tiles — GET /api/v1/analytics/kpis */}
          {kpiTiles.length > 0 && (
            <section aria-label="KPI аналитики">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpiTiles.slice(0, 4).map((item) => (
                  <MetricTile key={item.label} {...item} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpiTiles.slice(4).map((item) => (
                  <MetricTile key={item.label} {...item} tone="dark" />
                ))}
              </div>
            </section>
          )}

          {/* Trade-off visualizer — GET /api/v1/analytics/tradeoff */}
          <section aria-label="Trade-off">
            <TradeoffVisualizer
              curve={tradeoffCurve}
              snapshot={tradeoffSnapshot}
              isLoading={false}
              apiError={tradeoffError}
            />
          </section>
        </>
      )}
    </div>
  )
}
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Plus, RotateCcw, Activity, ShieldCheck, Target, TrendingUp } from 'lucide-react'
import StatCard from './StatCard'
import TxTable from './TxTable'
import CreateTxModal from './CreateTxModal'
import ModelWeights, { DEFAULT_WEIGHTS } from './ModelWeights'
import TradeoffVisualizer from './TradeoffVisualizer'
import Spinner from '../../components/ui/Spinner'
import { useLanguage } from '../../context/LanguageContext'
import { TRANSACTIONS } from '../../services/mockData'
import {
  fetchStats,
  fetchTransactions,
  fetchAnalyticsTradeoff,
  fetchAnalyticsKPIs,
  fetchModelConfig,
  mapBackendStats,
  mapBackendTxList,
  updateModelConfig,
} from '../../services/transactionsApi'
import { formatCompactKZT } from '../../utils/formatters'

// ---------------------------------------------------------------------------
// Fallback / Mock values
// ---------------------------------------------------------------------------

const FALLBACK_STATS = {
  total: 100_000,
  blocked: 1_243,
  safe: 98_757,
  fraudLossSavedTg: 48_500_000,
  fprPct: 1.2,
  precisionPct: 94.2,
  recallPct: 89.5,
  optimalThreshold: 62,
}

// ---------------------------------------------------------------------------
// KPI stat cards config
// ---------------------------------------------------------------------------

function buildStatCards(stats, t) {
  return [
    {
      id: 'saved',
      label: t.statSaved ?? 'Спасённый бюджет',
      value: formatCompactKZT(stats.fraudLossSavedTg),
      unit: '',
      sub: (t.statSavedSub ?? 'за последние 30 дней'),
      tone: 'dark',
    },
    {
      id: 'processed',
      label: t.statProcessed ?? 'Обработано транзакций',
      value: stats.total.toLocaleString('ru-RU'),
      unit: '',
      sub: `${stats.blocked.toLocaleString('ru-RU')} ${t.backendBlockedShort ?? 'заблокировано'}`,
      tone: 'light',
    },
    {
      id: 'fpr',
      label: t.statFpr ?? 'False Positive Rate',
      value: stats.fprPct.toFixed(1),
      unit: '%',
      sub: t.statFprSub ?? 'ложные блокировки',
      tone: 'dark',
    },
    {
      id: 'precision',
      label: t.statPrecision ?? 'Precision',
      value: stats.precisionPct.toFixed(1),
      unit: '%',
      sub: t.statPrecisionSub ?? 'точность модели',
      tone: 'light',
    },
  ]
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { t } = useLanguage()

  // --- State ---
  const [stats, setStats] = useState(FALLBACK_STATS)
  const [txs, setTxs] = useState(TRANSACTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Trade-off Visualizer state
  const [tradeoffCurve, setTradeoffCurve] = useState([])
  const [tradeoffSnapshot, setTradeoffSnapshot] = useState(null)
  const [tradeoffLoading, setTradeoffLoading] = useState(true)
  const [tradeoffError, setTradeoffError] = useState(null)

  // Analytics KPI state (extended)
  const [analyticsKPI, setAnalyticsKPI] = useState(null)
  const [analyticsError, setAnalyticsError] = useState(null)

  // UI state
  const [showCreate, setShowCreate] = useState(false)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [weightsSaving, setWeightsSaving] = useState(false)
  const [model, setModel] = useState('xgboost.v3.2k')

  const saveTimer = useRef(null)

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const load = useCallback(async () => {
    // Загружаем транзакции и статы параллельно.
    // 404 означает «эндпоинт ещё не реализован» → тихий fallback на mock-данные.
    // Баннер ошибки показываем только при реальных сетевых сбоях (connection refused, timeout).
    const is404 = (err) => typeof err === 'string' && err.includes('404')

    const [statsRes, txsRes] = await Promise.all([fetchStats(), fetchTransactions()])

    if (statsRes.ok) {
      setStats(mapBackendStats(statsRes.data))
    } else if (!is404(statsRes.error)) {
      setError(statsRes.error)
    }
    // 404 → молча остаёмся на FALLBACK_STATS

    if (txsRes.ok) {
      setTxs(mapBackendTxList(txsRes.data))
    } else if (!is404(txsRes.error)) {
      setError((prev) => (prev ? `${prev}; ` : '') + txsRes.error)
    }
    // 404 → молча остаёмся на TRANSACTIONS mock

    setLoading(false)
  }, [])


  const loadAnalytics = useCallback(async () => {
    // Загружаем KPI аналитики
    const kpiRes = await fetchAnalyticsKPIs()
    if (kpiRes.ok) {
      setAnalyticsKPI(kpiRes.data)
      // Обновляем stats из KPI API если они более свежие
      setStats((prev) => ({
        ...prev,
        fraudLossSavedTg: kpiRes.data.fraud_loss_saved ?? prev.fraudLossSavedTg,
        fprPct: kpiRes.data.false_positive_rate ?? prev.fprPct,
        precisionPct: kpiRes.data.precision ?? prev.precisionPct,
        total: kpiRes.data.total_transactions ?? prev.total,
        blocked: kpiRes.data.blocked_transactions ?? prev.blocked,
        optimalThreshold: kpiRes.data.optimal_threshold ?? prev.optimalThreshold,
      }))
      setModel(kpiRes.data.model_name ?? model)
    } else if (kpiRes.error && !kpiRes.error.includes('404')) {
      setAnalyticsError(kpiRes.error)
    }
    // 404 → analytics API недоступен, Visualizer покажет fallback кривую

    // Загружаем trade-off данные из GET /api/v1/analytics/tradeoff
    setTradeoffLoading(true)
    const tradeoffRes = await fetchAnalyticsTradeoff()
    if (tradeoffRes.ok && tradeoffRes.data) {
      // Живой бэкенд отдаёт одну точку {false_positive_rate_pct, fraud_loss_saved_tg}
      setTradeoffSnapshot({
        falsePositiveRatePct: Number(tradeoffRes.data.false_positive_rate_pct) || 0,
        fraudLossSavedTg: Number(tradeoffRes.data.fraud_loss_saved_tg) || 0,
      })
      // Если пришёл массив кривой → используем его для графика
      if (Array.isArray(tradeoffRes.data)) {
        setTradeoffCurve(tradeoffRes.data)
      }
      setTradeoffError(null)
    } else {
      setTradeoffSnapshot(null)
      setTradeoffCurve([])
      setTradeoffError(tradeoffRes.error ?? null)
    }
    setTradeoffLoading(false)
  }, [model])

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([load(), loadAnalytics()])
    }, 0)
    return () => clearTimeout(timer)
  }, [load, loadAnalytics, refreshKey])

  useEffect(() => {
    let alive = true
    fetchModelConfig().then((res) => {
      if (!alive) return
      if (res.ok) {
        setModel(res.data?.model ?? model)
        setWeights((prev) => ({ ...DEFAULT_WEIGHTS, ...(res.data?.weights ?? {}) }))
      }
    })
    return () => {
      alive = false
      clearTimeout(saveTimer.current)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setAnalyticsError(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleCreated = useCallback(
    (row) => {
      setTxs((prev) => [row, ...prev].slice(0, 500))
      load()
    },
    [load],
  )

  const handleWeightChange = useCallback(
    (key, value) => {
      const next = { ...weights, [key]: value }
      setWeights(next)
      setWeightsSaving(true)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const res = await updateModelConfig({ weights: next })
        setWeightsSaving(false)
        if (res.ok) {
          setModel(res.data?.model ?? model)
          load()
        } else if (!res.error?.includes('404')) {
          // 404 → /api/v1/model/config не реализован, молча игнорируем
          setError(res.error)
        }
      }, 600)
    },
    [weights, model, load],
  )

  const handleResetWeights = useCallback(() => {
    setWeights(DEFAULT_WEIGHTS)
    setWeightsSaving(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const res = await updateModelConfig({ weights: DEFAULT_WEIGHTS })
      setWeightsSaving(false)
      if (res.ok) {
        setModel(res.data?.model ?? model)
        load()
      } else if (!res.error?.includes('404')) {
        // 404 → /api/v1/model/config не реализован, молча игнорируем
        setError(res.error)
      }
    }, 250)
  }, [model, load])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const statCards = buildStatCards(stats, t)

  return (
    <div className="space-y-10">
      {/* Page title */}
      <div className="space-y-3">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
          {t.dashTitle ?? 'Fraud Hunter'}
        </h1>
        {analyticsKPI && (
          <p className="text-sm text-zinc-400 font-mono">
            Оптимальный порог:{' '}
            <span className="text-zinc-700 font-bold">
              {analyticsKPI.optimal_threshold ?? stats.optimalThreshold ?? '—'}%
            </span>
            {' · '}
            Спасено:{' '}
            <span className="text-emerald-600 font-bold">
              {analyticsKPI.fraud_loss_saved_formatted ?? formatCompactKZT(stats.fraudLossSavedTg)}
            </span>
            {' · '}
            Модель:{' '}
            <span className="text-zinc-700 font-bold">{model}</span>
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-700">
              {t.backendUnavailable ?? 'Backend недоступен — показаны демо-данные'}
            </p>
            <p className="text-xs text-rose-500 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-rose-200 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
          >
            <RotateCcw size={13} />
            {t.retry ?? 'Повторить'}
          </button>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <section aria-label="KPI метрики">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <StatCard
              key={s.id}
              label={s.label}
              value={loading && i === 0 ? '···' : s.value}
              unit={s.unit}
              sub={s.sub}
              tone={s.tone}
            />
          ))}
        </div>

        {/* Extended KPI row (from analytics API) */}
        {analyticsKPI && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Recall',
                value: `${analyticsKPI.recall?.toFixed(1) ?? '—'}%`,
                icon: Activity,
                color: 'text-emerald-600',
              },
              {
                label: 'F1-Score',
                value: analyticsKPI.f1_score?.toFixed(3) ?? '—',
                icon: TrendingUp,
                color: 'text-violet-600',
              },
              {
                label: 'Optimal Threshold',
                value: `${analyticsKPI.optimal_threshold ?? '—'}%`,
                icon: Target,
                color: 'text-cyan-600',
              },
              {
                label: 'Min Total Cost',
                value: formatCompactKZT(analyticsKPI.min_total_cost ?? 0),
                icon: ShieldCheck,
                color: 'text-amber-600',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-2xl bg-zinc-50 border border-zinc-200 px-4 py-3 flex items-center gap-3"
              >
                <Icon size={16} className={`${color} shrink-0`} />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {label}
                  </div>
                  <div className="text-sm font-extrabold font-mono text-zinc-900 mt-0.5">
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Trade-off Visualizer ─── */}
      <section aria-label="Trade-off анализ">
        <TradeoffVisualizer
          curve={tradeoffCurve}
          snapshot={tradeoffSnapshot}
          isLoading={tradeoffLoading}
          apiError={tradeoffError}
        />
      </section>

      {/* ─── Model Weights ─── */}
      <section aria-label="Веса модели">
        <div className="xl:col-span-2">
          <ModelWeights
            weights={weights}
            saving={weightsSaving}
            onChange={handleWeightChange}
            onReset={handleResetWeights}
            t={t}
          />
        </div>
      </section>

      {/* ─── Transaction Feed ─── */}
      <section aria-label="Лента транзакций">
        <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-zinc-950">
                {t.txFeed ?? 'Лента транзакций'}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {t.txFeedSub ?? 'Последние обработанные транзакции с оценкой риска'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="create-tx-btn"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus size={14} />
                {t.createTx ?? 'Новая транзакция'}
              </button>
              {loading && <Spinner size={18} label="" />}
            </div>
          </div>

          {loading && txs.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-zinc-400">
              <Spinner size={22} label="" />
              <span className="text-sm">{t.dashboardLoading ?? 'Загрузка...'}</span>
            </div>
          ) : (
            <TxTable transactions={txs} />
          )}
        </div>
      </section>

      <CreateTxModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
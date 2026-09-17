import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import StatCard from './StatCard'
import TxTable from './TxTable'
import Slider from '../../components/ui/Slider'
import Spinner from '../../components/ui/Spinner'
import LossChart from '../../components/charts/LossChart'
import { useLanguage } from '../../context/LanguageContext'
import { LOSS_CURVE, TRANSACTIONS } from '../../services/mockData'
import {
  fetchStats,
  fetchTransactions,
  mapBackendStats,
  mapBackendTx,
} from '../../services/transactionsApi'
import { formatCompactKZT, formatKZT } from '../../utils/formatters'

function pointAt(data, threshold) {
  return data.reduce((acc, p) =>
    Math.abs(p.threshold - threshold) < Math.abs(acc.threshold - threshold) ? p : acc,
  )
}

const FALLBACK_STATS = {
  total: 100000,
  blocked: 1243,
  safe: 92108,
  fraudLossSavedTg: 48_500_000,
  fprPct: 1.2,
  precisionPct: 94.2,
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [threshold, setThreshold] = useState(60)
  const [stats, setStats] = useState(FALLBACK_STATS)
  const [txs, setTxs] = useState(TRANSACTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const op = pointAt(LOSS_CURVE, threshold)

  const load = useCallback(async () => {
    const [statsRes, txsRes] = await Promise.all([fetchStats(), fetchTransactions()])

    if (statsRes.ok) setStats(mapBackendStats(statsRes.data))
    else setError(statsRes.error)

    if (txsRes.ok) setTxs(txsRes.data.map(mapBackendTx))
    else setError((prev) => (prev ? `${prev}; ` : '') + txsRes.error)

    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load, refreshKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((k) => k + 1)
  }

  const STAT_TEXT = {
    saved: [t.statSaved, t.statSavedSub],
    processed: [t.statProcessed, t.statProcessedSub],
    fpr: [t.statFpr, t.statFprSub],
    precision: [t.statPrecision, t.statPrecisionSub],
  }

  const liveStats = [
    {
      id: 'saved',
      label: t.statSaved,
      value: formatCompactKZT(stats.fraudLossSavedTg),
      unit: '',
      sub: STAT_TEXT.saved[1],
    },
    {
      id: 'processed',
      label: t.statProcessed,
      value: stats.total.toLocaleString('ru-RU'),
      unit: '',
      sub: `${stats.blocked.toLocaleString('ru-RU')} ${t.backendBlockedShort}`,
    },
    {
      id: 'fpr',
      label: t.statFpr,
      value: stats.fprPct.toFixed(1),
      unit: '%',
      sub: STAT_TEXT.fpr[1],
    },
    {
      id: 'precision',
      label: t.statPrecision,
      value: stats.precisionPct.toFixed(1),
      unit: '%',
      sub: STAT_TEXT.precision[1],
    },
  ]

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {t.dashBadge}
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
          {t.dashTitle}
        </h1>
        <p className="text-lg text-zinc-500">
          {t.dashSubtitle}
        </p>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-700">{t.backendUnavailable}</p>
            <p className="text-xs text-rose-500 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-rose-200 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
          >
            <RotateCcw size={13} />
            {t.retry}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {liveStats.map((s, i) => (
          <StatCard
            key={s.id}
            label={s.label}
            value={loading && i === 0 ? '···' : s.value}
            unit={s.unit}
            sub={s.sub}
            tone={i % 2 === 0 ? 'dark' : 'light'}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-[32px] bg-zinc-950 text-white p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{t.lossTradeOff}</h3>
              <p className="text-sm text-zinc-500 mt-1">
                {t.lossTradeOffSub}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300">
              xgboost.3.2k
            </span>
          </div>

          <LossChart data={LOSS_CURVE} threshold={threshold} />

          <div className="mt-7 pt-6 border-t border-white/10">
            <Slider
              dark
              label={t.thresholdSlider}
              value={threshold}
              onChange={setThreshold}
            />
            <div className="mt-2 flex justify-between text-[11px] font-mono text-zinc-600">
              <span>false negatives ↑</span>
              <span>{t.optimalPoint}</span>
              <span>false positives ↑</span>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8">
          <h3 className="text-xl font-bold tracking-tight text-zinc-950">{t.operatingPoint}</h3>
          <p className="text-sm text-zinc-500 mt-1">{t.operatingSub}</p>

          <dl className="mt-6 space-y-4">
            {[
              ['threshold', `${threshold}%`, 'text-zinc-900'],
              ['fraud_loss', formatKZT(op.fraudLoss), 'text-rose-600'],
              ['client_friction', `${op.friction.toFixed(2)}`, 'text-zinc-900'],
              ['false_positive', `${op.fpr.toFixed(2)}%`, 'text-amber-600'],
            ].map(([k, v, color]) => (
              <div key={k} className="flex items-center justify-between">
                <dt className="text-sm font-mono text-zinc-500">{k}</dt>
                <dd className={`text-sm font-bold font-mono ${color}`}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-2xl bg-zinc-50 px-4 py-3.5 flex items-center justify-between">
            <span className="text-sm font-mono text-zinc-500">deployed_model</span>
            <span className="text-sm font-bold font-mono text-zinc-700">xgboost.3.2k</span>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-zinc-950">{t.txFeed}</h3>
            <p className="text-sm text-zinc-500 mt-1">
              {t.txFeedSub}
            </p>
          </div>
          {loading ? (
            <Spinner size={18} label="" />
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
              live · 24/7
            </span>
          )}
        </div>

        {loading && txs.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400">
            <Spinner size={22} label="" />
            <span className="text-sm">{t.dashboardLoading}</span>
          </div>
        ) : (
          <TxTable transactions={txs} />
        )}
      </div>
    </div>
  )
}
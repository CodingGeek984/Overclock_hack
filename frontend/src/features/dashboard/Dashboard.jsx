import { useState } from 'react'
import StatCard from './StatCard'
import TxTable from './TxTable'
import Slider from '../../components/ui/Slider'
import LossChart from '../../components/charts/LossChart'
import { DASHBOARD_STATS, LOSS_CURVE, TRANSACTIONS } from '../../services/mockData'
import { formatKZT } from '../../utils/formatters'

function pointAt(data, threshold) {
  return data.reduce((acc, p) =>
    Math.abs(p.threshold - threshold) < Math.abs(acc.threshold - threshold) ? p : acc,
  )
}

export default function Dashboard() {
  const [threshold, setThreshold] = useState(60)
  const stats = DASHBOARD_STATS
  const op = pointAt(LOSS_CURVE, threshold)

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Analytics &amp; Dynamic Thresholds
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
          Дашборд аналитика
        </h1>
        <p className="text-lg text-zinc-500">
          Ключевые метрики модели и живая настройка порога риска.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard
            key={s.id}
            label={s.label}
            value={s.value}
            unit={s.unit}
            delta={s.delta}
            trend={s.trend}
            sub={s.sub}
            tone={i % 2 === 0 ? 'dark' : 'light'}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-[32px] bg-zinc-950 text-white p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Loss trade-off</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Потери от фрода vs фрикция честных клиентов по порогу риска
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
              label="Динамический порог риска"
              value={threshold}
              onChange={setThreshold}
            />
            <div className="mt-2 flex justify-between text-[11px] font-mono text-zinc-600">
              <span>false negatives ↑</span>
              <span>оптимум</span>
              <span>false positives ↑</span>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8">
          <h3 className="text-xl font-bold tracking-tight text-zinc-950">Operating point</h3>
          <p className="text-sm text-zinc-500 mt-1">Значение в текущей точке</p>

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
            <h3 className="text-xl font-bold tracking-tight text-zinc-950">Лента транзакций</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Клик по строке — SHAP-объяснение решения
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
            live · 24/7
          </span>
        </div>
        <TxTable transactions={TRANSACTIONS} />
      </div>
    </div>
  )
}
import { useState } from 'react'
import StatCard from './StatCard'
import TxTable from './TxTable'
import Card from '../../components/ui/Card'
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard
            key={s.id}
            label={s.label}
            value={s.value}
            unit={s.unit}
            delta={s.delta}
            trend={s.trend}
            sub={s.sub}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card
          className="xl:col-span-2"
          title="Trade-off"
          subtitle="Потери от фрода vs фрикция честных клиентов по порогу риска"
        >
          <LossChart data={LOSS_CURVE} threshold={threshold} />
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <Slider label="Порог риска" value={threshold} onChange={setThreshold} />
          </div>
        </Card>

        <Card title="Operating point" subtitle="Значение в текущей точке">
          <dl className="mt-2 space-y-3">
            {[
              ['threshold', `${threshold}%`, 'text-zinc-100'],
              ['fraud_loss', formatKZT(op.fraudLoss), 'text-rose-400'],
              ['client_friction', `${op.friction.toFixed(2)}`, 'text-zinc-100'],
              ['false_positive', `${op.fpr.toFixed(2)}%`, 'text-amber-400'],
            ].map(([k, v, color]) => (
              <div key={k} className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                <dt className="text-xs font-mono text-zinc-500">{k}</dt>
                <dd className={`text-sm font-mono ${color}`}>{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <dt className="text-xs font-mono text-zinc-500">deployed_model</dt>
              <dd className="text-sm font-mono text-zinc-400">xgboost.3.2k</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Лента транзакций" subtitle="Клик по строке — SHAP-объяснение решения">
        <TxTable transactions={TRANSACTIONS} />
      </Card>
    </div>
  )
}
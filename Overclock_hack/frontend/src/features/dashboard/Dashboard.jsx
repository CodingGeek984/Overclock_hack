import { useState, useEffect, useRef } from 'react'
import StatCard from './StatCard'
import TxTable from './TxTable'
import GeoThreatMap from './GeoThreatMap'
import FraudRingGraph from './FraudRingGraph'
import ScoreDistribution from './ScoreDistribution'
import ModelHealthWidget from './ModelHealthWidget'
import DriftHeatmap from './DriftHeatmap'
import RulesBuilder from '../rules/RulesBuilder'
import Card from '../../components/ui/Card'
import Slider from '../../components/ui/Slider'
import LossChart from '../../components/charts/LossChart'
import {
  DASHBOARD_STATS, LOSS_CURVE, TRANSACTIONS,
  SCORE_DISTRIBUTION, MODEL_METRICS, DRIFT_DATA,
} from '../../services/mockData'
import { formatKZT } from '../../utils/formatters'

function pointAt(data, threshold) {
  return data.reduce((acc, p) =>
    Math.abs(p.threshold - threshold) < Math.abs(acc.threshold - threshold) ? p : acc,
  )
}

export default function Dashboard() {
  const [threshold, setThreshold] = useState(60)
  const [liveTxs, setLiveTxs] = useState(TRANSACTIONS)
  const [rules, setRules] = useState([{ id: 1, field: 'amount', operator: '>', value: '5000', action: 'BLOCK' }])

  const rulesRef = useRef(rules)
  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  useEffect(() => {
    let ws = new WebSocket('ws://localhost:8000/api/v1/ws/transactions')

    ws.onmessage = (event) => {
      const tx = JSON.parse(event.data)
      const mappedCountry = tx.location ? tx.location.split(', ')[1] || 'UN' : 'UN'
      let finalStatus = tx.risk_score >= 80 ? 'BLOCK' : tx.risk_score >= 50 ? 'CHALLENGE' : 'APPROVE'

      // Apply Hard Rules
      rulesRef.current.forEach(rule => {
        let txValue = tx[rule.field]
        if (rule.field === 'amount') txValue = tx.amount
        else if (rule.field === 'country') txValue = mappedCountry
        else if (rule.field === 'risk_score') txValue = tx.risk_score

        let ruleValue = rule.value
        if (rule.field === 'amount' || rule.field === 'risk_score') ruleValue = Number(rule.value)

        if (rule.operator === '>' && txValue > ruleValue) finalStatus = rule.action
        if (rule.operator === '<' && txValue < ruleValue) finalStatus = rule.action
        if (rule.operator === '==' && txValue == ruleValue) finalStatus = rule.action
      })

      const mappedTx = {
        id: tx.id,
        date: tx.timestamp,
        amount: tx.amount,
        card: '**** **** **** ' + Math.floor(1000 + Math.random() * 9000),
        ip: Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.0.1',
        country: mappedCountry,
        merchant: tx.user_id,
        score: tx.risk_score,
        status: finalStatus,
        features: tx.features,
      }
      setLiveTxs(prev => [mappedTx, ...prev].slice(0, 100))
    }

    return () => ws.close()
  }, [])

  const stats = DASHBOARD_STATS
  const op = pointAt(LOSS_CURVE, threshold)

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard
            key={s.id}
            id={s.id}
            label={s.label}
            value={s.value}
            unit={s.unit}
            delta={s.delta}
            trend={s.trend}
            sub={s.sub}
          />
        ))}
      </div>

      {/* Trade-off chart + Operating point */}
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
              ['threshold',      `${threshold}%`,             'text-zinc-100'],
              ['fraud_loss',     formatKZT(op.fraudLoss),     'text-rose-400'],
              ['client_friction',`${op.friction.toFixed(2)}`, 'text-zinc-100'],
              ['false_positive', `${op.fpr.toFixed(2)}%`,     'text-amber-400'],
            ].map(([k, v, color]) => (
              <div key={k} className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                <dt className="text-xs font-mono text-zinc-500">{k}</dt>
                <dd className={`text-sm font-mono ${color}`}>{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <dt className="text-xs font-mono text-zinc-500">deployed_model</dt>
              <dd className="text-sm font-mono text-zinc-400">{MODEL_METRICS.version}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Score Distribution + Model Health */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <ScoreDistribution data={SCORE_DISTRIBUTION} threshold={threshold} />
        </div>
        <ModelHealthWidget metrics={MODEL_METRICS} />
      </div>

      {/* Drift Heatmap */}
      <DriftHeatmap data={DRIFT_DATA} />

      {/* Geo Map + Rules + Ring Graph */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <GeoThreatMap transactions={liveTxs} />
        <div className="flex flex-col gap-3">
          <RulesBuilder onRulesChange={setRules} liveTxs={liveTxs} />
          <FraudRingGraph transactions={liveTxs} />
        </div>
      </div>

      {/* Transaction feed */}
      <Card title="Лента транзакций" subtitle="Клик по строке — SHAP-объяснение решения (Live WebSockets)">
        <TxTable transactions={liveTxs} />
      </Card>
    </div>
  )
}
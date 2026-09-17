import { Activity, Cpu, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import Card from '../../components/ui/Card'

const STATUS_CONFIG = {
  healthy:  { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-800/50', label: 'Healthy',  dot: 'bg-emerald-400' },
  warning:  { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-800/50',   label: 'Warning',  dot: 'bg-amber-400 animate-pulse' },
  critical: { icon: XCircle,       color: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-800/50',    label: 'Critical', dot: 'bg-rose-400 animate-ping' },
}

function MiniAucChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <YAxis domain={[0.92, 0.96]} hide />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
                AUC {payload[0].value.toFixed(3)}
              </div>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="auc"
          stroke="#818cf8"
          strokeWidth={1.5}
          dot={{ r: 2, fill: '#818cf8', strokeWidth: 0 }}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function ModelHealthWidget({ metrics }) {
  if (!metrics) return null
  const cfg = STATUS_CONFIG[metrics.status] ?? STATUS_CONFIG.healthy
  const StatusIcon = cfg.icon
  const aucDelta = metrics.auc - metrics.aucPrev
  const aucDeltaFmt = `${aucDelta >= 0 ? '+' : ''}${(aucDelta * 1000).toFixed(1)}‰`

  return (
    <Card
      title="Model Health"
      subtitle={`${metrics.version} · обучена ${metrics.trainedAt}`}
      action={
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      }
    >
      {/* AUC mini chart */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">AUC-ROC · 7 дней</span>
          <span className={`text-[10px] font-mono ${aucDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {aucDeltaFmt}
          </span>
        </div>
        <MiniAucChart data={metrics.aucTimeline} />
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'AUC-ROC',   value: metrics.auc.toFixed(3),         icon: Activity, color: 'text-indigo-400' },
          { label: 'Precision', value: `${metrics.precision}%`,         icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Latency P95', value: `${metrics.latencyP95}ms`,     icon: Clock, color: 'text-sky-400' },
          { label: 'Latency P99', value: `${metrics.latencyP99}ms`,     icon: Cpu,  color: 'text-zinc-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-2 rounded-md bg-zinc-950/60 border border-zinc-800 px-3 py-2">
            <Icon size={13} className={color} />
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
              <div className={`text-sm font-mono font-medium ${color}`}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {metrics.status !== 'healthy' && (
        <div className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
          <StatusIcon size={13} className={`${cfg.color} mt-0.5 shrink-0`} />
          <p className="text-[11px] font-mono text-zinc-300 leading-relaxed">
            {metrics.status === 'warning'
              ? 'Обнаружен дрейф признаков. Рекомендуем переобучение модели в течение 48ч.'
              : 'Критическая деградация AUC. Срочно требуется переобучение!'}
          </p>
        </div>
      )}
    </Card>
  )
}

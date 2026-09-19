import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Mock data — используется при недоступности API (Fallback)
// ---------------------------------------------------------------------------
import { LOSS_CURVE } from '../../services/mockData.js'

/**
 * Генерирует синтетическую кривую компромисса из LOSS_CURVE
 * с расчётом Precision/Recall аналитически.
 */
function buildFallbackCurve() {
  return LOSS_CURVE.map((pt) => {
    const t = pt.threshold / 100
    const recall = 1.0 / (1.0 + Math.exp(8 * (t - 0.5)))
    const precision = Math.min(0.02 + 0.95 / (1.0 + Math.exp(-10 * (t - 0.4))), 1.0)
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0

    return {
      threshold: pt.threshold,
      precision: +precision.toFixed(4),
      recall: +recall.toFixed(4),
      f1: +f1.toFixed(4),
      fraud_loss: pt.fraudLoss,
      customer_inconvenience: Math.round(pt.friction * 80_000),
      total_cost: pt.fraudLoss + Math.round(pt.friction * 80_000),
      fraud_loss_saved: Math.round((1 - (1 - recall)) * 2_000 * 250_000),
      fpr: pt.fpr,
    }
  })
}

const FALLBACK_CURVE = buildFallbackCurve()

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatCompact(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B ₸`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ₸`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K ₸`
  return `${v.toFixed(0)} ₸`
}
function pct(v) {
  return `${(v * 100).toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------
const COLORS = {
  precision: '#a78bfa',      // violet-400
  recall: '#34d399',         // emerald-400
  fraudLoss: '#f87171',      // red-400
  customerInc: '#fb923c',    // orange-400
  totalCost: '#facc15',      // yellow-400
  threshold: '#94a3b8',      // slate-400
  optimal: '#22d3ee',        // cyan-400
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
function TradeoffTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const get = (key) => payload.find((p) => p.dataKey === key)?.value ?? 0

  return (
    <div
      style={{
        background: 'rgba(9,9,11,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '12px 16px',
        fontSize: 12,
        minWidth: 200,
        backdropFilter: 'blur(12px)',
      }}
    >
      <p style={{ color: '#71717a', marginBottom: 8, fontFamily: 'monospace' }}>
        порог {label}%
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row color={COLORS.precision} label="Precision" value={pct(get('precision'))} />
        <Row color={COLORS.recall} label="Recall" value={pct(get('recall'))} />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0' }} />
        <Row color={COLORS.fraudLoss} label="Fraud Loss" value={formatCompact(get('fraud_loss'))} />
        <Row color={COLORS.customerInc} label="Customer Penalty" value={formatCompact(get('customer_inconvenience'))} />
        <Row color={COLORS.totalCost} label="Total Cost" value={formatCompact(get('total_cost'))} bold />
      </div>
    </div>
  )
}

function Row({ color, label, value, bold = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#71717a', fontFamily: 'monospace' }}>
        <span style={{ color, marginRight: 4 }}>●</span>
        {label}
      </span>
      <span
        style={{
          color: bold ? '#f4f4f5' : color,
          fontFamily: 'monospace',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric Badge
// ---------------------------------------------------------------------------
function MetricBadge({ icon: Icon, label, value, sub, color = '#a1a1aa', highlight = false }) {
  return (
    <div
      style={{
        background: highlight ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 1,
        minWidth: 130,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={highlight ? COLORS.optimal : color} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? COLORS.optimal : '#f4f4f5', fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#52525b', fontFamily: 'monospace' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * TradeoffVisualizer
 *
 * Компонент дашборда для анализа компромисса между ML-метриками (Precision/Recall)
 * и финансовыми потерями бизнеса.
 *
 * Props:
 *   curve      — массив точек кривой [{threshold, precision, recall, fraud_loss, ...}]
 *   isLoading  — флаг загрузки (показывает skeleton)
 *   apiError   — строка с ошибкой API (показывает fallback-баннер)
 */
export default function TradeoffVisualizer({ curve, isLoading = false, apiError = null, snapshot = null }) {
  const [threshold, setThreshold] = useState(60)
  const [isDragging, setIsDragging] = useState(false)
  const [activeMode, setActiveMode] = useState('financial') // 'financial' | 'ml'
  const sliderRef = useRef(null)

  // Выбираем кривую: из props или fallback
  const data = useMemo(
    () => (curve && curve.length > 0 ? curve : FALLBACK_CURVE),
    [curve],
  )

  // Находим точку, соответствующую текущему threshold
  const currentPoint = useMemo(() => {
    if (!data.length) return null
    return data.reduce((best, pt) =>
      Math.abs(pt.threshold - threshold) < Math.abs(best.threshold - threshold) ? pt : best,
    )
  }, [data, threshold])

  // Оптимальная точка (минимум total_cost)
  const optimalPoint = useMemo(() => {
    if (!data.length) return null
    return data.reduce((best, pt) => (pt.total_cost < best.total_cost ? pt : best))
  }, [data])

  // Обработка слайдера
  const handleSliderChange = useCallback((e) => {
    setThreshold(Number(e.target.value))
  }, [])

  const handleSliderClick = useCallback((e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const maxThreshold = data.length > 0 ? Math.max(...data.map((d) => d.threshold)) : 100
    setThreshold(Math.round(ratio * maxThreshold))
  }, [data])

  if (isLoading) {
    return (
      <div className="rounded-[32px] bg-zinc-950 p-6 sm:p-8 animate-pulse">
        <div className="h-7 w-48 bg-zinc-800 rounded-xl mb-4" />
        <div className="h-4 w-64 bg-zinc-800 rounded mb-8" />
        <div className="h-64 bg-zinc-900 rounded-2xl" />
        <div className="mt-6 h-10 bg-zinc-900 rounded-2xl" />
      </div>
    )
  }

  const savedAmount = snapshot?.fraudLossSavedTg ?? currentPoint?.fraud_loss_saved ?? 0
  const frictionCost = currentPoint?.customer_inconvenience ?? 0
  const totalCost = currentPoint?.total_cost ?? 0
  const precisionVal = currentPoint?.precision ?? 0
  const recallVal = currentPoint?.recall ?? 0
  const fprVal = snapshot?.falsePositiveRatePct ?? currentPoint?.fpr ?? 0

  return (
    <div
      className="rounded-[32px] text-white p-6 sm:p-8"
      style={{ background: 'linear-gradient(135deg, #09090b 0%, #111113 100%)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white">
            Trade-off Visualizer
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            ML-метрики vs финансовые потери · порог {threshold}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apiError && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-800/40 px-3 py-1.5 text-xs text-amber-400">
              <AlertTriangle size={11} />
              Mock data
            </span>
          )}
          {/* Mode toggle */}
          <div className="flex rounded-full bg-zinc-900 border border-zinc-800 p-0.5 text-xs">
            {[
              { id: 'financial', label: 'Financial' },
              { id: 'ml', label: 'ML Metrics' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMode(m.id)}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  activeMode === m.id
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        {activeMode === 'financial' ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradFraud" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.fraudLoss} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS.fraudLoss} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.customerInc} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS.customerInc} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="none" vertical={false} />
            <XAxis
              dataKey="threshold"
              tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(v)}
              width={72}
            />
            <Tooltip content={<TradeoffTooltip />} cursor={{ stroke: '#3f3f46', strokeDasharray: '4 4' }} />
            <ReferenceLine
              x={threshold}
              stroke={COLORS.threshold}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `▼ ${threshold}%`,
                position: 'top',
                fill: COLORS.threshold,
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            {optimalPoint && (
              <ReferenceLine
                x={optimalPoint.threshold}
                stroke={COLORS.optimal}
                strokeDasharray="none"
                strokeWidth={1}
                strokeOpacity={0.5}
                label={{
                  value: '★ opt',
                  position: 'insideTopRight',
                  fill: COLORS.optimal,
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="fraud_loss"
              name="Fraud Loss"
              stroke={COLORS.fraudLoss}
              strokeWidth={2}
              fill="url(#gradFraud)"
              dot={false}
              activeDot={{ r: 4, fill: COLORS.fraudLoss }}
            />
            <Area
              type="monotone"
              dataKey="customer_inconvenience"
              name="Customer Penalty"
              stroke={COLORS.customerInc}
              strokeWidth={2}
              fill="url(#gradInc)"
              dot={false}
              activeDot={{ r: 4, fill: COLORS.customerInc }}
            />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }}
            />
          </AreaChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="none" vertical={false} />
            <XAxis
              dataKey="threshold"
              tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              width={40}
            />
            <Tooltip content={<TradeoffTooltip />} cursor={{ stroke: '#3f3f46', strokeDasharray: '4 4' }} />
            <ReferenceLine
              x={threshold}
              stroke={COLORS.threshold}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `▼ ${threshold}%`,
                position: 'top',
                fill: COLORS.threshold,
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            <Line
              type="monotone"
              dataKey="precision"
              name="Precision"
              stroke={COLORS.precision}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: COLORS.precision }}
            />
            <Line
              type="monotone"
              dataKey="recall"
              name="Recall"
              stroke={COLORS.recall}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: COLORS.recall }}
            />
            <Line
              type="monotone"
              dataKey="f1"
              name="F1"
              stroke={COLORS.totalCost}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, fill: COLORS.totalCost }}
            />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Threshold Slider */}
      <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Порог чувствительности
          </span>
          <span
            className="font-mono text-lg font-extrabold"
            style={{ color: COLORS.optimal }}
          >
            {threshold}%
          </span>
        </div>

        {/* Custom slider */}
        <div className="relative" ref={sliderRef}>
          <input
            id="fraud-threshold-slider"
            type="range"
            min={0}
            max={data.length > 0 ? Math.max(...data.map((d) => d.threshold)) : 100}
            step={1}
            value={threshold}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            className="w-full appearance-none cursor-pointer"
            style={{
              height: 6,
              background: `linear-gradient(to right, ${COLORS.optimal} ${threshold}%, rgba(255,255,255,0.1) ${threshold}%)`,
              borderRadius: 9999,
              outline: 'none',
              border: 'none',
            }}
          />
          {/* Tick marks for reference points */}
          <div className="flex justify-between mt-1.5 px-0.5">
            {[0, 25, 50, 75, 100].map((v) => (
              <span key={v} className="text-[9px] font-mono text-zinc-700">
                {v}%
              </span>
            ))}
          </div>
        </div>

        <div className="mt-1 flex justify-between text-[10px] font-mono text-zinc-700">
          <span>↑ false negatives (пропущенный фрод)</span>
          <span>↑ false positives (раздражение клиентов)</span>
        </div>
      </div>

      {/* Operating Point Metrics */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
        <MetricBadge
          icon={DollarSign}
          label="Спасено"
          value={formatCompact(savedAmount)}
          sub="fraud_loss_saved"
          color={COLORS.recall}
          highlight
        />
        <MetricBadge
          icon={Users}
          label="Фрикции"
          value={formatCompact(frictionCost)}
          sub="customer penalty"
          color={COLORS.customerInc}
        />
        <MetricBadge
          icon={TrendingUp}
          label="Precision"
          value={pct(precisionVal)}
          sub={`Recall ${pct(recallVal)}`}
          color={COLORS.precision}
        />
        <MetricBadge
          icon={TrendingDown}
          label="FPR"
          value={`${fprVal.toFixed(2)}%`}
          sub="false positive rate"
          color={COLORS.fraudLoss}
        />
      </div>

      {/* Optimal Point CTA */}
      {optimalPoint && Math.abs(threshold - optimalPoint.threshold) > 2 && (
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}
        >
          <div className="flex items-center gap-2.5">
            <Target size={14} color={COLORS.optimal} />
            <span className="text-xs text-zinc-400">
              Оптимальный порог:{' '}
              <span className="font-bold font-mono" style={{ color: COLORS.optimal }}>
                {optimalPoint.threshold}%
              </span>{' '}
              — минимальные потери{' '}
              <span className="font-bold font-mono text-white">
                {formatCompact(optimalPoint.total_cost)}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setThreshold(optimalPoint.threshold)}
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all"
            style={{
              background: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.3)',
              color: COLORS.optimal,
            }}
          >
            <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
            Применить
          </button>
        </div>
      )}

      {/* Slider CSS (injected once) */}
      <style>{`
        #fraud-threshold-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${COLORS.optimal};
          border: 3px solid #09090b;
          box-shadow: 0 0 0 2px ${COLORS.optimal}40;
          cursor: pointer;
          transition: box-shadow 0.15s;
        }
        #fraud-threshold-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 5px ${COLORS.optimal}30;
        }
        #fraud-threshold-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${COLORS.optimal};
          border: 3px solid #09090b;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

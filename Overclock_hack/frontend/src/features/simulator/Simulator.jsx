import { useEffect, useRef, useState } from 'react'
import { Banknote, Clock, Play, RotateCcw, Wifi } from 'lucide-react'
import { assessTransaction } from '../../services/fraudApi'
import { COUNTRIES, DEVICES, MERCHANTS } from '../../services/mockData'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import RiskGauge from '../../components/charts/RiskGauge'
import ShapChart from '../../components/charts/ShapChart'
import Presets from './Presets'
import XaiLog from './XaiLog'
import { STATUS_META } from '../../utils/riskColors'
import { formatTime } from '../../utils/formatters'

const FACTOR_CODES = {
  'VPN / Proxy': 'VPN_PROXY',
  'Amount Deviation': 'AMOUNT_DEV',
  'Country Risk': 'GEO_RISK',
  'Merchant Category': 'MCC_RISK',
  'Device Fingerprint': 'DEVICE_ANOM',
  'Transaction Frequency': 'VELOCITY',
  'Geo Velocity': 'GEO_VELOCITY',
}

const DEFAULT_FORM = {
  amount: 15900,
  country: 'KZ',
  ip: '178.89.91.22',
  merchant: 'Kaspi.kz',
  device: 'iPhone 15 · known',
  frequency: 1,
}

const PRESET_LABELS = {
  legit: 'Легитимный',
  borderline: 'Пограничный 2FA',
  fraud: 'Критический Фрод',
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 hover:border-zinc-700 transition-colors appearance-none"
    >
      {options.map((o) => (
        <option key={o.code ?? o} value={o.code ?? o} className="bg-zinc-950">
          {o.name ?? o}
        </option>
      ))}
    </select>
  )
}

function reasonCodes(factors) {
  return factors
    .filter((f) => f.effect > 0)
    .slice(0, 3)
    .map((f) => FACTOR_CODES[f.name] ?? f.name.toUpperCase().replace(/[^\w]+/g, '_'))
}

export default function Simulator() {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [shownSteps, setShownSteps] = useState(0)
  const [activePreset, setActivePreset] = useState(null)
  const [showAudit, setShowAudit] = useState(false)
  const abortRef = useRef(null)

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setActivePreset(null)
  }

  const run = async (extra) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setResult(null)
    setShownSteps(0)

    const payload = { ...form, ...(extra ?? {}) }
    try {
      const res = await assessTransaction(payload)
      if (controller.signal.aborted) return
      setResult(res)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (!result) return
    if (shownSteps >= result.log.length) return
    const timer = setTimeout(() => setShownSteps((s) => s + 1), 300)
    return () => clearTimeout(timer)
  }, [result, shownSteps])

  const handlePreset = (preset) => {
    setForm({ ...DEFAULT_FORM, ...preset.values })
    setActivePreset(preset.id)
    run(preset.values)
  }

  const meta = result ? STATUS_META[result.status] : null
  const codes = result ? reasonCodes(result.factors) : []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <div className="xl:col-span-2 space-y-5">
        <Card title="Пресеты" subtitle="Заполнение формы одним кликом">
          <Presets onSelect={handlePreset} />
        </Card>

        <Card
          title="Параметры транзакции"
          subtitle={
            activePreset ? `пресет: ${PRESET_LABELS[activePreset]}` : 'ручной ввод'
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Сумма, ₸"
                type="number"
                min={0}
                value={form.amount}
                icon={Banknote}
                onChange={(e) => setField('amount', Number(e.target.value))}
              />
              <Input
                label="Частота / час"
                type="number"
                min={1}
                max={20}
                value={form.frequency}
                icon={Clock}
                onChange={(e) => setField('frequency', Number(e.target.value))}
              />
            </div>

            <Field label="Страна">
              <Select value={form.country} onChange={(v) => setField('country', v)} options={COUNTRIES} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="IP-адрес"
                value={form.ip}
                icon={Wifi}
                placeholder="185.220.101.4"
                onChange={(e) => setField('ip', e.target.value)}
              />
              <Field label="Мерчант">
                <Select value={form.merchant} onChange={(v) => setField('merchant', v)} options={MERCHANTS} />
              </Field>
            </div>

            <Field label="Устройство">
              <Select value={form.device} onChange={(v) => setField('device', v)} options={DEVICES} />
            </Field>

            <div className="pt-2 grid grid-cols-2 gap-3">
              <Button fullWidth variant="ghost" onClick={() => setForm(DEFAULT_FORM)}>
                <RotateCcw size={14} /> Сброс
              </Button>
              <Button fullWidth variant="primary" loading={loading} onClick={() => run()}>
                <Play size={14} /> Анализ
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="xl:col-span-3 space-y-5">
        <Card title="Вердикт" subtitle="Risk score · действие · объяснимость">
          {loading && !result && (
            <div className="flex items-center justify-center py-16">
              <Spinner size={20} label="inference..." />
            </div>
          )}

          {!loading && !result && (
            <div className="py-16 text-center text-sm text-zinc-600">
              Выберите пресет или заполните форму и запустите анализ
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <RiskGauge value={result.score} label="Risk Score" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3 border border-zinc-800 rounded-md px-4 py-3 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
                    action
                  </span>
                  <span className={`font-mono text-xl font-semibold tracking-tight ${meta?.text}`}>
                    {meta?.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs text-zinc-500">
                    tx <span className="text-zinc-300">{result.id}</span>
                  </div>
                  <div className="font-mono text-xs text-zinc-500">
                    latency <span className="text-zinc-300">{result.latencyMs}ms</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                  reason_codes
                </div>
                <div className="font-mono text-sm text-rose-400">
                  {codes.length > 0 ? codes.join(', ') : 'no_risk_factors'}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                  shap_factors
                </p>
                <ShapChart data={result.factors.map((f) => ({ ...f, name: f.name }))} />
              </div>
            </div>
          )}
        </Card>

        <Card title="XAI Reasoning" subtitle="Консольный вывод модели">
          {loading && !result ? (
            <div className="py-4">
              <XaiLog thinking />
            </div>
          ) : (
            <XaiLog steps={result ? result.log.slice(0, shownSteps) : []} />
          )}
          {result && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-600">
                decision_time {formatTime(result.log[result.log.length - 1]?.time ?? new Date())}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAudit(true)}>
                  Audit
                </Button>
                <Button variant="neutral" size="sm" onClick={() => run()}>
                  <RotateCcw size={13} /> Переанализ
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={showAudit} onClose={() => setShowAudit(false)} title="Audit record" subtitle={result?.id}>
        {result && (
          <div className="font-mono text-xs text-zinc-400 space-y-3">
            {result.log.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 shrink-0">{formatTime(step.time)}</span>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
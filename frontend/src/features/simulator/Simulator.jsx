import { useEffect, useRef, useState } from 'react'
import { Banknote, Bot, ChevronDown, ChevronUp, Clock, Play, RotateCcw, Wifi } from 'lucide-react'
import { assessTransaction } from '../../services/fraudApi'
import { COUNTRIES, DEVICES, MERCHANTS } from '../../services/mockData'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import RiskDonut from '../../components/charts/RiskDonut'
import ShapFactors from '../../components/charts/ShapFactors'
import Presets from './Presets'
import XaiLog from './XaiLog'
import { scoreToStatus, STATUS_META } from '../../utils/riskColors'
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

function Field({ label, children, dark = false }) {
  return (
    <label className="block">
      <span
        className={`block text-xs font-semibold mb-1.5 ${
          dark ? 'text-zinc-400' : 'text-zinc-600'
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options, dark = false }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-2xl text-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-2 appearance-none ${
        dark
          ? 'bg-white/[0.06] border border-white/10 text-white focus:ring-white/10'
          : 'bg-zinc-100 border border-transparent text-zinc-900 focus:bg-white focus:ring-zinc-900/10'
      }`}
    >
      {options.map((o) => (
        <option key={o.code ?? o} value={o.code ?? o} className={dark ? 'bg-zinc-900' : 'bg-white'}>
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
  const [logOpen, setLogOpen] = useState(true)
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
    const timer = setTimeout(() => setShownSteps((s) => s + 1), 260)
    return () => clearTimeout(timer)
  }, [result, shownSteps])

  const handlePreset = (preset) => {
    setForm({ ...DEFAULT_FORM, ...preset.values })
    setActivePreset(preset.id)
    run(preset.values)
  }

  const meta = result ? STATUS_META[result.status] : null
  const statusTone = result ? scoreToStatus(result.score) : null
  const codes = result ? reasonCodes(result.factors) : []

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      <div className="space-y-7 pt-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white pl-1.5 pr-4 py-1.5 text-xs font-semibold">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-soft" />
          </span>
          Real-time Fraud Detection
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-[54px] font-extrabold tracking-tight text-zinc-950 leading-[1.04]">
            Monitor transactions
            <br />
            with AI precision.
          </h1>
          <p className="text-lg text-zinc-500 max-w-[460px] leading-relaxed">
            Получайте мгновенные вердикты и SHAP-объяснения факторов риска для каждой операции.
          </p>
        </div>

        <div className="pt-1">
          <Presets onSelect={handlePreset} activeId={activePreset} />
        </div>

        <div className="rounded-[28px] bg-white border border-zinc-200 p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-950">Параметры транзакции</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {activePreset ? `пресет: ${PRESET_LABELS[activePreset]}` : 'ручной ввод'}
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Live input
            </span>
          </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Страна">
                <Select
                  value={form.country}
                  onChange={(v) => setField('country', v)}
                  options={COUNTRIES}
                />
              </Field>
              <Field label="Мерчант">
                <Select
                  value={form.merchant}
                  onChange={(v) => setField('merchant', v)}
                  options={MERCHANTS}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="IP-адрес"
                value={form.ip}
                icon={Wifi}
                placeholder="185.220.101.4"
                onChange={(e) => setField('ip', e.target.value)}
              />
              <Field label="Устройство">
                <Select
                  value={form.device}
                  onChange={(v) => setField('device', v)}
                  options={DEVICES}
                />
              </Field>
            </div>

            <div className="pt-1 grid grid-cols-2 gap-3">
              <Button variant="neutral" onClick={() => setForm(DEFAULT_FORM)}>
                <RotateCcw size={14} /> Сброс
              </Button>
              <Button variant="primary" loading={loading} onClick={() => run()}>
                <Play size={14} /> Анализ
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <div className="rounded-[32px] bg-zinc-950 text-white p-6 sm:p-8 shadow-2xl shadow-zinc-900/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Live Verdict
              </div>
              <h2 className="text-xl font-bold tracking-tight mt-1">Инференс xAI</h2>
            </div>
            {result ? (
              <div className="text-right">
                <div className="font-mono text-xs text-zinc-500">
                  tx <span className="text-zinc-300">{result.id}</span>
                </div>
                <div className="font-mono text-xs text-zinc-500 mt-0.5">
                  latency <span className="text-zinc-300">{result.latencyMs}ms</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse-soft" />
                engine online
              </div>
            )}
          </div>

          {loading && !result ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <RiskDonut value={0} label="thinking" showStatus={false} />
              <Spinner dark label="inference..." />
            </div>
          ) : (
            <>
              <RiskDonut value={result?.score ?? 0} />

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5">
                  <span className="text-xs font-semibold text-zinc-500">Decision</span>
                  <span
                    className={`text-lg font-extrabold tracking-tight ${
                      meta ? meta.text : 'text-zinc-600'
                    }`}
                  >
                    {result ? meta.label : '— awaiting input —'}
                  </span>
                </div>

                {result && (
                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5">
                    <span className="text-xs font-semibold text-zinc-500">Reason codes</span>
                    <span className="font-mono text-xs font-semibold text-rose-400 text-right">
                      {codes.length > 0 ? codes.join(', ') : 'no_risk_factors'}
                    </span>
                  </div>
                )}

                {!result && !loading && (
                  <p className="text-sm text-zinc-500 text-center py-2">
                    Выберите пресет или заполните форму — дашборд покажет Risk Score и SHAP-факторы.
                  </p>
                )}

                {statusTone && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2.5">
                      Top-3 SHAP factors
                    </p>
                    <ShapFactors data={result.factors} limit={3} />
                  </div>
                )}

                <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLogOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="flex items-center gap-2.5 text-sm font-semibold text-zinc-300">
                      <Bot size={16} className="text-zinc-500" />
                      LLM-ассистент · служба поддержки
                    </span>
                    {logOpen ? (
                      <ChevronUp size={16} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={16} className="text-zinc-500" />
                    )}
                  </button>
                  {logOpen && (
                    <div className="px-3 pb-3 animate-fade-in">
                      {loading ? (
                        <XaiLog thinking />
                      ) : (
                        <XaiLog steps={result ? result.log.slice(0, shownSteps) : []} />
                      )}
                    </div>
                  )}
                </div>

                {result && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-zinc-600">
                      decision_time{' '}
                      {formatTime(result.log[result.log.length - 1]?.time ?? new Date())}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="darkGhost" size="sm" onClick={() => setShowAudit(true)}>
                        Audit
                      </Button>
                      <Button variant="light" size="sm" onClick={() => run()}>
                        <RotateCcw size={13} /> Переанализ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={showAudit} onClose={() => setShowAudit(false)} title="Audit record" subtitle={result?.id}>
        {result && (
          <div className="font-mono text-xs text-zinc-500 space-y-3">
            {result.log.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-400 shrink-0">{formatTime(step.time)}</span>
                <span className="text-zinc-700">{step.text}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  )
}
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Banknote, Bot, ChevronDown, ChevronUp, Clock, FileText, Gauge, Play, RotateCcw, Send, Wifi } from 'lucide-react'
import { assessTransaction } from '../../services/fraudApi'
import { checkTransaction } from '../../services/transactionsApi'
import { COUNTRIES, DEVICES, MERCHANTS } from '../../services/mockData'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import RiskDonut from '../../components/charts/RiskDonut'
import ShapFactors from '../../components/charts/ShapFactors'
import Presets from './Presets'
import XaiLog from './XaiLog'
import { scoreToStatus, STATUS, STATUS_META } from '../../utils/riskColors'
import { getDynamicThreshold } from '../../utils/dynamicThresholds'
import { formatTime } from '../../utils/formatters'
import { buildClientMessage, buildSupportReport, downloadTextFile } from '../../utils/xaiExplainer'
import { useLanguage } from '../../context/LanguageContext'

const RULE_ICON = {
  NIGHT_TIME: '🌙',
  RISKY_MCC: '🎰',
}

const FACTOR_CODES = {
  'VPN / Proxy': 'VPN_PROXY',
  'Amount Deviation': 'AMOUNT_DEV',
  'Country Risk': 'GEO_RISK',
  'Merchant Category': 'MCC_RISK',
  'Device Fingerprint': 'DEVICE_ANOM',
  'Transaction Frequency': 'VELOCITY',
  'Geo Velocity': 'GEO_VELOCITY',
}

const PRESET_KEY = {
  legit: 'presetLegit',
  borderline: 'presetBorderline',
  fraud: 'presetFraud',
}

const DEFAULT_FORM = {
  amount: 850000,
  country: 'NG',
  ip: '194.187.248.1',
  device: 'Android Emulator',
  merchant: 'Crypto Exchange',
  frequency: 12,
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

function buildLiveLog(data, risk, status) {
  const t0 = new Date()
  const steps = [
    { time: t0, level: 'info', text: 'POST /api/v1/transactions/check → ответ получен' },
    {
      time: new Date(t0.getTime() + 40),
      level: risk >= 80 ? 'danger' : risk >= 50 ? 'warn' : 'success',
      text: `risk_score = ${risk}% → ${status}`,
    },
    { time: new Date(t0.getTime() + 80), level: 'info', text: data.message || '—' },
  ]
  if (data.explanation) {
    steps.push({
      time: new Date(t0.getTime() + 120),
      level: 'warn',
      text: `explanation: ${data.explanation}`,
    })
  }
  return steps
}

function buildLiveResult(data) {
  const risk = Math.max(0, Math.min(100, Math.round((Number(data.risk_score) || 0) * 100)))
  const status = data.is_fraud
    ? STATUS.BLOCK
    : risk >= 50
      ? STATUS.CHALLENGE
      : STATUS.APPROVE
  return {
    id: data.id != null ? `TX-${data.id}` : `TX-LIVE-${Date.now().toString().slice(-5)}`,
    score: risk,
    status,
    is_fraud: Boolean(data.is_fraud),
    factors: [],
    log: buildLiveLog(data, risk, status),
    latencyMs: 0,
    backendMessage: data.message ?? '',
    backendExplanation: data.explanation ?? '',
  }
}

export default function Simulator() {
  const { t, lang } = useLanguage()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)
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
    setError(null)
    setSource(null)

    const payload = { ...form, ...(extra ?? {}) }

    const remote = await checkTransaction(payload)
    if (controller.signal.aborted) return

    if (remote.ok) {
      setResult(buildLiveResult(remote.data))
      setSource('live')
      setLoading(false)
      return
    }

    setError(remote.error)
    setSource('fallback')
    try {
      const fallback = await assessTransaction(payload)
      if (controller.signal.aborted) return
      setResult(fallback)
    } catch (err) {
      console.error('Ошибка при анализе транзакции:', err)
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

  const statusTone = result ? scoreToStatus(result.score) : null;

  const handleExport = (kind) => {
    if (!result || !statusTone) return
    const payload = {
      tx: { id: result.id, card: '—', ...form },
      params: form,
      assessment: result,
    }
    const threshold = dynamic.finalThreshold
    const text =
      kind === 'client'
        ? buildClientMessage(payload, { language: lang })
        : buildSupportReport(payload, { threshold, topN: 5 })
    downloadTextFile(`${result.id}-${kind === 'client' ? 'client' : 'xai-report'}.txt`, text)
  }
  const dynamic = getDynamicThreshold({ ...form, hour: new Date().getHours() });
  const finalStatus = result && statusTone && result.score >= dynamic.finalThreshold ? STATUS.BLOCK : statusTone;
  const meta = finalStatus ? STATUS_META[finalStatus] : null;
  const codes = result ? reasonCodes(result.factors) : [];

  const RULE_TEXT = {
    NIGHT_TIME: t.ruleNight,
    RISKY_MCC: t.ruleMcc,
  };

  


  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      <div className="space-y-7 pt-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white pl-1.5 pr-4 py-1.5 text-xs font-semibold">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-soft" />
          </span>
          {t.realtimeTag}
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-[54px] font-extrabold tracking-tight text-zinc-950 leading-[1.05]">
            {t.mainTitle}
          </h1>
          <p className="text-lg text-zinc-500 max-w-[460px] leading-relaxed">{t.mainSubtitle}</p>
        </div>

        <div className="pt-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
            {t.presetsTitle}
          </p>
          <Presets onSelect={handlePreset} activeId={activePreset} />
        </div>

        <div className="rounded-[28px] bg-white border border-zinc-200 p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-950">{t.paramsTitle}</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {activePreset
                  ? `${t.presetPrefix}: ${t[PRESET_KEY[activePreset] ?? 'presetLegit']}`
                  : t.manualInput}
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {t.liveInput}
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t.amount}
                type="number"
                min={0}
                value={form.amount}
                icon={Banknote}
                onChange={(e) => setField('amount', Number(e.target.value))}
              />
              <Input
                label={t.frequency}
                type="number"
                min={1}
                max={20}
                value={form.frequency}
                icon={Clock}
                onChange={(e) => setField('frequency', Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t.country}>
                <Select
                  value={form.country}
                  onChange={(v) => setField('country', v)}
                  options={COUNTRIES}
                />
              </Field>
              <Field label={t.merchant}>
                <Select
                  value={form.merchant}
                  onChange={(v) => setField('merchant', v)}
                  options={MERCHANTS}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t.ip}
                value={form.ip}
                icon={Wifi}
                placeholder="185.220.101.4"
                onChange={(e) => setField('ip', e.target.value)}
              />
              <Field label={t.device}>
                <Select
                  value={form.device}
                  onChange={(v) => setField('device', v)}
                  options={DEVICES}
                />
              </Field>
            </div>

            <div className="pt-1 grid grid-cols-2 gap-3">
              <Button variant="neutral" onClick={() => setForm(DEFAULT_FORM)}>
                <RotateCcw size={14} /> {t.reset}
              </Button>
              <Button variant="primary" loading={loading} onClick={() => run()}>
                <Play size={14} /> {t.analyze}
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
                {t.liveVerdict}
              </div>
              <h2 className="text-xl font-bold tracking-tight mt-1">{t.xaiInference}</h2>
            </div>
            {result ? (
              <div className="text-right">
                <div className="font-mono text-xs text-zinc-500">
                  tx <span className="text-zinc-300">{result.id}</span>
                </div>
                <div className="font-mono text-xs text-zinc-500 mt-0.5">
                  latency <span className="text-zinc-300">{result.latencyMs}ms</span>
                </div>
                <div className="font-mono text-[10px] font-bold mt-1">
                  {source === 'live' && (
                    <span className="text-emerald-400">● live · backend</span>
                  )}
                  {source === 'fallback' && (
                    <span className="text-amber-400">● fallback · local engine</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse-soft" />
                {t.engineOnline}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200 leading-relaxed min-w-0">
                <span className="font-bold block">{t.backendUnavailable}</span>
                {error}
                {source === 'fallback' && (
                  <span className="block mt-1 text-rose-300/80">{t.fallbackMode}</span>
                )}
              </p>
            </div>
          )}

          {loading && !result ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <RiskDonut value={0} label="thinking" showStatus={false} />
              <Spinner dark label={t.analyzing} />
            </div>
          ) : (
            <>
              <RiskDonut value={result?.score ?? 0} />

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5">
                  <span className="text-xs font-semibold text-zinc-500">{t.decision}</span>
                  <span
                    className={`text-lg font-extrabold tracking-tight ${
                      meta ? meta.text : 'text-zinc-600'
                    }`}
                  >
                    {result ? meta.label : t.awaitingInput}
                  </span>
                </div>

                {result && (
                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5">
                    <span className="text-xs font-semibold text-zinc-500">{t.reasonCodes}</span>
                    <span className="font-mono text-xs font-semibold text-rose-400 text-right">
                      {codes.length > 0 ? codes.join(', ') : t.noRiskFactors}
                    </span>
                  </div>
                )}

                {result?.backendMessage && (
                  <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4 animate-fade-in">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      <Bot size={12} className="text-zinc-500" />
                      {t.serverMessage}
                    </div>
                    <p className="mt-2 text-sm text-zinc-200 leading-relaxed">{result.backendMessage}</p>
                    {result.backendExplanation && (
                      <>
                        <div className="mt-3 pt-3 border-t border-white/10 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                          {t.serverExplanation}
                        </div>
                        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                          {result.backendExplanation}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {!result && !loading && (
                  <p className="text-sm text-zinc-500 text-center py-2">{t.promptSelectPreset}</p>
                )}

                {finalStatus && result.factors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2.5">
                      {t.topShapFactors}
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
                      {t.llmAssistant}
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
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Button variant="light" size="sm" onClick={() => handleExport('report')}>
                        <FileText size={13} /> {t.xaiSupportReport}
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleExport('client')}
                      >
                        <Send size={13} /> {t.xaiClientMessage}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-mono text-zinc-600">
                        {t.decisionTime}{' '}
                        {formatTime(result.log[result.log.length - 1]?.time ?? new Date())}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="darkGhost" size="sm" onClick={() => setShowAudit(true)}>
                          {t.audit}
                        </Button>
                        <Button variant="light" size="sm" onClick={() => run()}>
                          <RotateCcw size={13} /> {t.reanalyze}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <Gauge size={13} className="text-zinc-500" />
              {t.thresholdTitle}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tabular-nums text-white">
                {dynamic.finalThreshold}%
              </span>
              <span className="text-xs font-mono text-zinc-600 line-through tabular-nums">
                {dynamic.baseThreshold}%
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-white/10 pt-3 flex flex-wrap gap-1.5">
            {dynamic.isStrict ? (
              dynamic.rules.map((rule) => (
                <span
                  key={rule.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300"
                >
                  <span>{RULE_ICON[rule.id] ?? '⚠️'}</span>
                  {RULE_TEXT[rule.id] ?? rule.label}
                  <span className="text-rose-300 font-bold">-{rule.penalty}%</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-600">{t.noRules}</span>
            )}
          </div>
        </div>
      </div>

      <Modal open={showAudit} onClose={() => setShowAudit(false)} title={t.audit} subtitle={result?.id}>
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
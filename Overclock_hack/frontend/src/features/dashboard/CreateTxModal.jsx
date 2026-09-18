import { useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  ListPlus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { COUNTRIES, DEVICES } from '../../services/mockData'
import { buildAssessment } from '../../services/fraudApi'
import { buildCreatedRow, createTransaction } from '../../services/transactionsApi'
import { STATUS_META } from '../../utils/riskColors'
import { useLanguage } from '../../context/LanguageContext'

const DEFAULT_FORM = {
  amount: 15900,
  country: 'KZ',
  device: 'iPhone 15 · known',
  frequency: 1,
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5 text-zinc-600">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl text-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-2 bg-zinc-100 border border-transparent text-zinc-900 focus:bg-white focus:ring-zinc-900/10 appearance-none"
    >
      {options.map((o) => (
        <option key={o.code ?? o} value={o.code ?? o} className="bg-white">
          {o.name ?? o}
        </option>
      ))}
    </select>
  )
}

export default function CreateTxModal({ open, onClose, onCreated }) {
  const { t } = useLanguage()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setCreated(null)

    const res = await createTransaction(form)
    if (res.ok) {
      const row = buildCreatedRow(form, res.data)
      setCreated({
        row,
        live: true,
        message: res.data.message ?? '',
        explanation: res.data.explanation ?? '',
      })
    } else {
      const assessment = buildAssessment(form, Math.floor(Math.random() * 900) + 100)
      const row = buildCreatedRow(form, { score: assessment.score, status: assessment.status })
      setCreated({
        row,
        live: false,
        message: '',
        explanation: '',
        error: res.error,
      })
    }
    setSubmitting(false)
  }

  const handleClose = () => {
    setForm(DEFAULT_FORM)
    setCreated(null)
    setError(null)
    onClose?.()
  }

  const handleDone = () => {
    if (created) onCreated?.(created.row)
    handleClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.createTxTitle}
      subtitle={t.createTxSub}
      width="max-w-xl"
      footer={[
        !created ? (
          <Button
            key="cancel"
            variant="neutral"
            size="md"
            onClick={handleClose}
            disabled={submitting}
          >
            {t.reset}
          </Button>
        ) : null,
        !created ? (
          <Button
            key="submit"
            variant="primary"
            size="md"
            loading={submitting}
            onClick={handleSubmit}
          >
            <ListPlus size={15} /> {t.createCta}
          </Button>
        ) : (
          <Button key="done" variant="success" size="md" onClick={handleDone}>
            <CheckCircle2 size={15} /> {t.addToFeed}
          </Button>
        ),
      ]}
    >
      {created ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between rounded-2xl bg-zinc-950 px-5 py-4 text-white">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <ShieldCheck size={13} className={created.live ? 'text-emerald-400' : 'text-amber-400'} />
                {created.live ? t.serverMessage : t.fallbackMode}
              </div>
              <div className="mt-1.5 font-mono text-sm text-zinc-300">
                {created.row.id}{' '}
                <span className="text-zinc-600">·</span> {created.row.amount.toLocaleString('ru-RU')} ₸{' '}
                <span className="text-zinc-600">·</span> {created.row.country}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                risk_score
              </div>
              <div
                className="mt-0.5 font-mono text-4xl font-extrabold tabular-nums"
                style={{ color: STATUS_META[created.row.status]?.text }}
              >
                {created.row.score}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">{t.decision}</span>
            <Badge status={created.row.status} size="md" />
          </div>

          {created.message && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm text-zinc-700 leading-relaxed">{created.message}</p>
              {created.explanation && (
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{created.explanation}</p>
              )}
            </div>
          )}

          {!created.live && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                {created.error}
                <span className="block mt-0.5 text-amber-600/80">{t.fallbackMode}</span>
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
            <Sparkles size={14} className="inline -mt-0.5 mr-1.5" />
            {t.createdInFeed}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2.5 animate-fade-in">
              <AlertTriangle size={15} className="text-rose-500 shrink-0" />
              <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
            </div>
          )}

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
              <Select value={form.country} onChange={(v) => setField('country', v)} options={COUNTRIES} />
            </Field>
            <Field label={t.device}>
              <Select value={form.device} onChange={(v) => setField('device', v)} options={DEVICES} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  )
}
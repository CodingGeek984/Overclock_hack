import { useRef, useState } from 'react'
import { Loader2, RotateCcw, ShieldCheck, ShieldOff, Square, TriangleAlert } from 'lucide-react'
import FileDrop from './FileDrop'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { runBatch } from '../../services/fraudApi'
import { formatCompactKZT } from '../../utils/formatters'

const BATCH_TOTAL = 10000

const PLAN_CARDS = [
  {
    key: 'blocked',
    icon: ShieldOff,
    title: 'Заблокировано',
    desc: 'авто-блок · карта заморожена',
    accent: '#fb7185',
    tone: 'bg-rose-500',
  },
  {
    key: 'challenged',
    icon: TriangleAlert,
    title: '2FA / Suspect',
    desc: 'шаг OTP или биометрия',
    accent: '#fbbf24',
    tone: 'bg-amber-500',
  },
  {
    key: 'approved',
    icon: ShieldCheck,
    title: 'Безопасные',
    desc: 'пропуск без трения',
    accent: '#34d399',
    tone: 'bg-emerald-500',
  },
]

export default function BatchView() {
  const [fileName, setFileName] = useState(null)
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const cancelRef = useRef(null)

  const start = async () => {
    const controller = new AbortController()
    cancelRef.current = controller
    setRunning(true)
    setSummary(null)
    setProgress(0)

    const res = await runBatch({
      total: BATCH_TOTAL,
      onProgress: ({ progress: p }) => {
        if (!controller.signal.aborted) setProgress(p)
      },
    })
    if (!controller.signal.aborted) {
      setSummary(res)
      setProgress(100)
    }
    setRunning(false)
  }

  const stop = () => {
    cancelRef.current?.abort()
    setRunning(false)
  }

  const handleFile = (file) => {
    setFileName(file.name)
    start()
  }

  const handleDemo = () => {
    setFileName('mock-100k-sample.csv (demo 10k)')
    start()
  }

  const reset = () => {
    cancelRef.current?.abort()
    setFileName(null)
    setSummary(null)
    setProgress(0)
    setRunning(false)
  }

  const values = summary
    ? {
        blocked: summary.blocked,
        challenged: summary.challenged,
        approved: summary.approved,
        saved: summary.valueBlocked,
      }
    : null

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 text-white px-3.5 py-1.5 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-soft" />
          Batch 100k inference
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
          Массовый скрининг датасета
        </h1>
        <p className="text-lg text-zinc-500">Загружайте CSV и получайте разбивку решений на выборке.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            Итоги обработки
          </h2>
          {(running || fileName) && (
            <span className="text-sm font-semibold text-zinc-500 truncate max-w-[60%]">{fileName}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLAN_CARDS.map((plan) => {
            const Icon = plan.icon
            const value = values ? values[plan.key] : null
            return (
              <div
                key={plan.key}
                className="relative overflow-hidden rounded-[28px] bg-zinc-950 text-white p-7"
              >
                <div
                  className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-25"
                  style={{ backgroundColor: plan.accent }}
                />
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full"
                    style={{ backgroundColor: `${plan.accent}1f`, color: plan.accent }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span
                    className="w-2 h-2 rounded-full animate-pulse-soft"
                    style={{ backgroundColor: plan.accent }}
                  />
                </div>

                <div className="mt-6 text-[40px] font-extrabold tracking-tight leading-none tabular-nums">
                  {value === null ? (running ? '—' : '—') : value.toLocaleString('ru-RU')}
                </div>
                <div className="mt-2 text-lg font-bold tracking-tight">{plan.title}</div>
                <div className="mt-1 text-sm text-zinc-500">{plan.desc}</div>

                {plan.key === 'blocked' && values && (
                  <div className="mt-4 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 inline-block">
                    saved {formatCompactKZT(values.saved)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {!running && !fileName && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Загрузка данных</h2>
          <FileDrop onFile={handleFile} onDemo={handleDemo} />
        </div>
      )}

      {(running || fileName) && (
        <div className="space-y-5 animate-fade-in">
          {running ? (
            <div className="rounded-[28px] bg-white border border-zinc-200 p-6 sm:p-7">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                  <Loader2 size={15} className="animate-spin" />
                  processing batch
                </span>
                <span className="text-2xl font-extrabold tracking-tight text-zinc-950 tabular-nums">
                  {progress.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-500">
                  {Math.round((progress / 100) * BATCH_TOTAL).toLocaleString('ru-RU')} /{' '}
                  {BATCH_TOTAL.toLocaleString('ru-RU')} tx · ~2ms/tx
                </span>
                <Button variant="neutral" size="sm" onClick={stop}>
                  <Square size={11} /> Стоп
                </Button>
              </div>
            </div>
          ) : (
            summary && (
              <div className="space-y-5 animate-fade-in">
                <div className="rounded-[28px] bg-white border border-zinc-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                      sample · первые 8
                    </span>
                    <span className="text-xs font-mono text-zinc-500">elapsed {summary.elapsedMs}ms</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[440px]">
                      <thead>
                        <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-50">
                          <th className="px-6 py-3 font-bold">ID</th>
                          <th className="px-6 py-3 font-bold">Сумма</th>
                          <th className="px-6 py-3 font-bold">Гео</th>
                          <th className="px-6 py-3 font-bold">Решение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.sample.map((row) => (
                          <tr key={row.id} className="border-t border-zinc-100">
                            <td className="px-6 py-3 font-mono text-xs text-zinc-500">{row.id}</td>
                            <td className="px-6 py-3 font-mono text-xs font-semibold text-zinc-900">
                              {formatCompactKZT(row.amount)}
                            </td>
                            <td className="px-6 py-3 font-mono text-xs text-zinc-500">{row.country}</td>
                            <td className="px-6 py-3">
                              <Badge status={row.status} size="xs" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[28px] bg-zinc-950 px-6 py-5 text-white">
                  <div className="flex-1 text-sm font-medium text-zinc-300 leading-relaxed">
                    fpr <span className="text-amber-400 font-bold">{summary.fpr}%</span> · saved{' '}
                    <span className="text-emerald-400 font-bold">{formatCompactKZT(summary.valueBlocked)}</span>{' '}
                    · precision{' '}
                    <span className="text-white font-bold">
                      {((summary.approved / summary.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="darkGhost" size="sm" onClick={reset}>
                      <RotateCcw size={13} /> Сброс
                    </Button>
                    <Button variant="light" size="sm" onClick={start}>
                      Повторить прогон
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
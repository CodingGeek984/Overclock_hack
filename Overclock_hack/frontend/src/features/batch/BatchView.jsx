import { useRef, useState } from 'react'
import { CheckCircle2, FolderCog, RotateCcw, ShieldOff, Square, TriangleAlert } from 'lucide-react'
import FileDrop from './FileDrop'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { runBatch } from '../../services/fraudApi'
import { formatCompactKZT } from '../../utils/formatters'

const BATCH_TOTAL = 10000

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

  const stats = summary
    ? [
        { icon: CheckCircle2, label: 'approved', value: summary.approved, text: 'text-emerald-400' },
        { icon: TriangleAlert, label: 'challenge_2fa', value: summary.challenged, text: 'text-amber-400' },
        { icon: ShieldOff, label: 'blocked', value: summary.blocked, text: 'text-rose-400' },
        { icon: FolderCog, label: 'saved', value: formatCompactKZT(summary.valueBlocked), text: 'text-zinc-100' },
      ]
    : []

  return (
    <div className="space-y-5">
      <Card
        title="Массовый скрининг"
        subtitle={`Batch inference на выборке ${BATCH_TOTAL.toLocaleString('ru-RU')} транзакций`}
      >
        {!running && !fileName ? (
          <FileDrop onFile={handleFile} onDemo={handleDemo} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-mono text-zinc-300 truncate">{fileName}</span>
              <Button variant="ghost" size="sm" onClick={reset} disabled={!running && !summary}>
                <RotateCcw size={13} /> Сброс
              </Button>
            </div>

            {running && (
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-zinc-500">processing</span>
                  <span className="text-zinc-200">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-100 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-600">
                    {Math.round((progress / 100) * BATCH_TOTAL).toLocaleString('ru-RU')} /
                    {BATCH_TOTAL.toLocaleString('ru-RU')} tx · ~2ms/tx
                  </span>
                  <Button variant="ghost" size="sm" onClick={stop}>
                    <Square size={11} /> Стоп
                  </Button>
                </div>
              </div>
            )}

            {summary && !running && (
              <div className="space-y-5 animate-fade-in">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {stats.map((s) => {
                    const Icon = s.icon
                    return (
                      <div key={s.label} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                          <Icon size={12} className={s.text} />
                          {s.label}
                        </div>
                        <div className={`mt-1.5 font-mono text-xl text-zinc-100 ${s.label === 'blocked' || s.label === 'challenge_2fa' || s.label === 'approved' ? s.text : ''}`}>
                          {s.value}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/50 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    sample · первые 8
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[440px]">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          <th className="px-3 py-2 font-medium">ID</th>
                          <th className="px-3 py-2 font-medium">Сумма</th>
                          <th className="px-3 py-2 font-medium">Гео</th>
                          <th className="px-3 py-2 font-medium">Решение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.sample.map((row) => (
                          <tr key={row.id} className="border-t border-zinc-800/70">
                            <td className="px-3 py-2 font-mono text-xs text-zinc-400">{row.id}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-300">{formatCompactKZT(row.amount)}</td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.country}</td>
                            <td className="px-3 py-2">
                              <Badge status={row.status} size="xs" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <div className="flex-1 font-mono text-xs text-zinc-400 leading-relaxed">
                    fpr <span className="text-amber-400/90">{summary.fpr}%</span> · saved{' '}
                    <span className="text-emerald-400/90">{formatCompactKZT(summary.valueBlocked)}</span> ·
                    precision{' '}
                    <span className="text-zinc-100">{(summary.approved / summary.total * 100).toFixed(1)}%</span>
                  </div>
                  <Button variant="primary" size="sm" onClick={start}>
                    Повторить прогон
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
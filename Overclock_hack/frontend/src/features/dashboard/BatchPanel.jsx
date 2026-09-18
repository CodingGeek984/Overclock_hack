import { useState } from 'react'
import { Play, SlidersHorizontal } from 'lucide-react'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { formatCompactKZT } from '../../utils/formatters'
import { runBatch } from '../../services/transactionsApi'

const SIZES = [
  { value: 1000, label: '1 000' },
  { value: 10000, label: '10 000' },
  { value: 100000, label: '100 000' },
]

export default function BatchPanel({ onDone, t }) {
  const [size, setSize] = useState(10000)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setRunning(true)
    setSummary(null)
    setError(null)
    const res = await runBatch({ count: size })
    setRunning(false)
    if (res.ok) {
      setSummary(res.data)
      onDone?.()
    } else {
      setError(res.error)
    }
  }

  const stats = summary
    ? [
        [t.batchAdded, summary.added.toLocaleString('ru-RU')],
        [t.batchBlocked, summary.blocked_frauds.toLocaleString('ru-RU')],
        [t.batchSaved, formatCompactKZT(summary.fraud_loss_saved_tg)],
        [t.batchAvgScore, `${summary.avg_score}%`],
      ]
    : []

  return (
    <div className="rounded-[32px] bg-zinc-950 text-white p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={16} className="text-zinc-500" />
        <h3 className="text-lg font-bold tracking-tight">{t.batchTitle}</h3>
      </div>
      <p className="text-sm text-zinc-500">{t.batchSubtitle}</p>

      {summary ? (
        <div className="mt-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-zinc-400">{t.batchDone}</span>
            <span className="text-xs font-mono text-emerald-400">{summary.model}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{k}</div>
                <div className="mt-1 font-mono text-base font-bold text-white">{v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <span className="block text-xs font-semibold mb-1.5 text-zinc-400">{t.batchCount}</span>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSize(s.value)}
                  className={`rounded-2xl px-3 py-2.5 text-sm font-mono font-bold transition-colors ${
                    size === s.value
                      ? 'bg-white text-zinc-950'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={run}
            disabled={running}
            variant="light"
            fullWidth
            className="justify-center"
          >
            {running ? (
              <>
                <Spinner size={15} label="" />
                {t.batchRunning}
              </>
            ) : (
              <>
                <Play size={14} />
                {t.batchRun}
              </>
            )}
          </Button>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      )}
      {summary && (
        <button
          type="button"
          onClick={() => setSummary(null)}
          className="mt-4 w-full text-center text-[11px] font-semibold text-zinc-500 hover:text-white transition-colors"
        >
          {t.batchRerun}
        </button>
      )}
    </div>
  )
}
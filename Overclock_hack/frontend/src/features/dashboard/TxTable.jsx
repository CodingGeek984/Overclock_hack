import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ShapChart from '../../components/charts/ShapChart'
import { useLanguage } from '../../context/LanguageContext'
import { STATUS } from '../../utils/riskColors'
import { formatDateTime, formatKZT } from '../../utils/formatters'

const PAGE_SIZE = 10

function scoreCls(score) {
  if (score >= 80) return 'text-rose-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-emerald-600'
}

export default function TxTable({ transactions }) {
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  const FILTERS = [
    { id: 'ALL', label: t.txAll, countKey: null },
    { id: STATUS.APPROVE, label: 'Approve' },
    { id: STATUS.BLOCK, label: 'Block' },
  ]

  const counts = useMemo(() => {
    const acc = { ALL: transactions.length, [STATUS.APPROVE]: 0, [STATUS.BLOCK]: 0 }
    transactions.forEach((tx) => {
      if (acc[tx.status] !== undefined) acc[tx.status] += 1
    })
    return acc
  }, [transactions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((tx) => {
      const matchStatus = statusFilter === 'ALL' || tx.status === statusFilter
      if (!matchStatus) return false
      if (!q) return true
      return (
        tx.id.toLowerCase().includes(q) ||
        String(tx.amount).includes(q) ||
        String(tx.country ?? '').toLowerCase().includes(q)
      )
    })
  }, [transactions, statusFilter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setStatusFilter(f.id)
                setPage(1)
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === f.id
                  ? 'bg-zinc-950 border-zinc-950 text-white'
                  : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 ${statusFilter === f.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                {counts[f.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="relative md:ml-auto">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t.txSearchPlaceholder}
            className="w-full md:w-64 pl-10 pr-4 py-2.5 rounded-full bg-zinc-100 border border-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10 transition-all"
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[540px]">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-50">
                <th className="px-4 py-3 font-bold">TXN ID</th>
                <th className="px-4 py-3 font-bold">{t.thDate}</th>
                <th className="px-4 py-3 font-bold">{t.thAmount}</th>
                <th className="px-4 py-3 font-bold">Country</th>
                <th className="px-4 py-3 font-bold">Score</th>
                <th className="px-4 py-3 font-bold">{t.thDecision}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelected(tx)}
                  className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      {tx.id}
                      {tx.created && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 mr-1" />
                          {t.newInFeed}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{formatDateTime(tx.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900">{formatKZT(tx.amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{tx.country}</td>
                  <td className={`px-4 py-3 font-mono text-xs font-bold ${scoreCls(tx.score)}`}>
                    {tx.score}%
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={tx.status} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-400">
            {t.noTx}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-100 bg-zinc-50/60">
          <p className="text-xs font-mono text-zinc-500">
            {filtered.length} / {transactions.length} · {t.pageOf} {safePage}/{totalPages}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={t.prev}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={t.next}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.id} subtitle={t.shapModalSub}>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                [t.txAmount, formatKZT(selected.amount)],
                ['Country', selected.country],
                [t.device, selected.device],
                [t.thDate, formatDateTime(selected.date)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{k}</div>
                  <div className="mt-1 text-xs font-mono font-medium text-zinc-800 truncate">{v}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                {t.shapFactors}
              </p>
              <ShapChart
                data={[
                  { name: t.txAmount, effect: selected.score / 220 + 0.08, detail: t.shapAmountDetail },
                  { name: t.shapIp, effect: selected.score / 240, detail: t.shapIpDetail },
                  { name: t.shapGeo, effect: 0.15 - selected.score / 700, detail: t.shapGeoDetail },
                ]}
              />
            </div>

            {selected.reasons?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  {t.expLogTitle}
                </p>
                <div className="rounded-2xl bg-zinc-950 text-zinc-200 px-4 py-3.5 font-mono text-xs leading-relaxed">
                  {selected.reasons.map((reason) => (
                    <div key={reason} className="flex gap-2">
                      <span className="text-zinc-600">▸</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Risk Score</span>
              <span className={`font-mono text-xl font-extrabold ${scoreCls(selected.score)}`}>
                {selected.score}%
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
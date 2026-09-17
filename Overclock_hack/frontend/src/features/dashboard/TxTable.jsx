import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, ExternalLink } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ShapWaterfall from '../../components/charts/ShapWaterfall'
import { STATUS } from '../../utils/riskColors'
import { maskCard, formatDateTime, formatKZT } from '../../utils/formatters'

const PAGE_SIZE = 10

const FILTERS = [
  { id: 'ALL',            label: 'Все',       countKey: null },
  { id: STATUS.APPROVE,   label: 'Approve' },
  { id: STATUS.CHALLENGE, label: 'Challenge' },
  { id: STATUS.BLOCK,     label: 'Block' },
]

function scoreCls(score) {
  if (score >= 80) return 'text-rose-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-emerald-400'
}

// Build SHAP factors from tx features or fallback mock
function buildShapFactors(tx) {
  if (tx.features) {
    return [
      {
        name: 'Отклонение суммы',
        effect: Math.min(Math.max(tx.features.amount_z_score ?? 0.1, -0.5), 0.5),
        detail: `Z-Score: ${(tx.features.amount_z_score ?? 0).toFixed(2)}`,
      },
      {
        name: 'Гео-скорость',
        effect: tx.features.travel_speed > 900 ? tx.score / 150 : -0.05,
        detail: `${tx.features.travel_speed ?? 0} км/ч`,
      },
      {
        name: 'Частота 1h',
        effect: tx.features.velocity_1h > 15 ? tx.score / 200 : -0.08,
        detail: `${tx.features.velocity_1h ?? 0} транзакций за час`,
      },
    ].sort((a, b) => b.effect - a.effect)
  }
  // Fallback based on score
  return [
    { name: 'Сумма транзакции',  effect: tx.score / 220 + 0.06, detail: `${(tx.score / 25).toFixed(1)}x выше среднего чека` },
    { name: 'Репутация IP',      effect: tx.score / 260 + 0.02, detail: 'Proxy / VPN диапазон' },
    { name: 'Гео-скорость',      effect: tx.score / 300 + 0.01, detail: 'Подозрительная смена локации' },
    { name: 'Устройство',        effect: tx.score >= 80 ? 0.12 : 0.04, detail: tx.device || 'Неизвестное устройство' },
    { name: 'Время суток',       effect: -0.03, detail: 'Типичное время активности' },
    { name: 'Доверенный мерчант',effect: -0.05, detail: 'Мерчант не в чёрном списке' },
  ]
    .sort((a, b) => b.effect - a.effect)
    .slice(0, 5)
}

export default function TxTable({ transactions }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  const counts = useMemo(() => {
    const acc = { ALL: transactions.length, [STATUS.APPROVE]: 0, [STATUS.CHALLENGE]: 0, [STATUS.BLOCK]: 0 }
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
        tx.ip?.toLowerCase().includes(q) ||
        tx.merchant?.toLowerCase().includes(q) ||
        tx.id?.toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
      )
    })
  }, [transactions, statusFilter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const shapFactors = useMemo(
    () => (selected ? buildShapFactors(selected) : []),
    [selected],
  )

  return (
    <>
      {/* Filters + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setStatusFilter(f.id); setPage(1) }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                statusFilter === f.id
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-zinc-500">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="relative md:ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="IP / merchant / amount / id"
            className="w-full md:w-64 pl-9 pr-3 py-2 rounded-md bg-zinc-950 border border-zinc-800
              text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none
              focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-md border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[860px]">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-950/50">
                <th className="px-3 py-2.5 font-medium">TXN ID</th>
                <th className="px-3 py-2.5 font-medium">Дата / время</th>
                <th className="px-3 py-2.5 font-medium">Сумма</th>
                <th className="px-3 py-2.5 font-medium">Карта</th>
                <th className="px-3 py-2.5 font-medium">IP</th>
                <th className="px-3 py-2.5 font-medium">Мерчант</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Решение</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelected(tx)}
                  className="border-t border-zinc-800/70 hover:bg-zinc-900/50 cursor-pointer transition-colors group"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    <span className="flex items-center gap-1">
                      {tx.id}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{formatDateTime(tx.date)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-200 font-medium">{formatKZT(tx.amount)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{maskCard(tx.card)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                    {tx.ip}
                    <span className="ml-1.5 text-zinc-600">{tx.country}</span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-300 text-xs">{tx.merchant}</td>
                  <td className={`px-3 py-2.5 font-mono text-xs font-semibold ${scoreCls(tx.score)}`}>
                    {tx.score}%
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge status={tx.status} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-600">
            Нет транзакций по заданным фильтрам
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-zinc-800 bg-zinc-950/40">
          <p className="text-xs font-mono text-zinc-500">
            {filtered.length} / {transactions.length} · стр. {safePage}/{totalPages}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Назад"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Вперёд"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* SHAP Waterfall Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.id}
        subtitle={`Risk Score ${selected?.score}% · ${selected?.merchant} · ${selected?.country}`}
        width="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            {/* Quick info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                ['Сумма',   formatKZT(selected.amount)],
                ['Карта',   maskCard(selected.card)],
                ['IP',      `${selected.ip} (${selected.country})`],
                ['Мерчант', selected.merchant],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-zinc-950 border border-zinc-800 p-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{k}</div>
                  <div className="mt-1 text-xs font-mono text-zinc-200 truncate">{v}</div>
                </div>
              ))}
            </div>

            {/* Decision badge */}
            <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Решение модели</span>
              <div className="flex items-center gap-3">
                <Badge status={selected.status} size="md" />
                <span className={`font-mono text-xl font-bold ${scoreCls(selected.score)}`}>
                  {selected.score}%
                </span>
              </div>
            </div>

            {/* Waterfall SHAP */}
            <ShapWaterfall factors={shapFactors} score={selected.score} />
          </div>
        )}
      </Modal>
    </>
  )
}
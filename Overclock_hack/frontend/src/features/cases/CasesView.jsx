import { useState, useMemo } from 'react'
import { Search, ChevronRight, AlertTriangle, CheckCircle2, Clock, User, MessageSquare, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ShapWaterfall from '../../components/charts/ShapWaterfall'
import { CASES } from '../../services/mockData'
import { formatKZT, formatDateTime, maskCard } from '../../utils/formatters'

// Status config
const CASE_STATUS = {
  OPEN:      { label: 'Открыт',      bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-800/50',    dot: 'bg-rose-400 animate-pulse' },
  IN_REVIEW: { label: 'На проверке', bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-800/50',   dot: 'bg-amber-400' },
  RESOLVED:  { label: 'Закрыт',      bg: 'bg-zinc-700/30',    text: 'text-zinc-500',    border: 'border-zinc-700/50',    dot: 'bg-zinc-500' },
}

const PRIORITY = {
  CRITICAL: { label: 'CRITICAL', color: 'text-rose-400',   bg: 'bg-rose-500/10'   },
  HIGH:     { label: 'HIGH',     color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  MEDIUM:   { label: 'MEDIUM',   color: 'text-sky-400',    bg: 'bg-sky-500/10'    },
}

const VERDICT_META = {
  CONFIRMED_FRAUD: { label: '🔴 Подтверждён фрод',    color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-800/50' },
  FALSE_POSITIVE:  { label: '✅ Ложное срабатывание', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-800/50' },
}

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-rose-500' : score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${score >= 80 ? 'text-rose-400' : score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
        {score}%
      </span>
    </div>
  )
}

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED']

export default function CasesView() {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [cases, setCases] = useState(CASES)
  const [note, setNote] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases.filter((c) => {
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter
      if (!matchStatus) return false
      if (!q) return true
      return c.id.toLowerCase().includes(q) || c.merchant.toLowerCase().includes(q) || c.txId.toLowerCase().includes(q)
    })
  }, [cases, statusFilter, query])

  const counts = useMemo(() => {
    const acc = { ALL: cases.length, OPEN: 0, IN_REVIEW: 0, RESOLVED: 0 }
    cases.forEach((c) => { if (acc[c.status] !== undefined) acc[c.status]++ })
    return acc
  }, [cases])

  function resolveCase(verdict) {
    setCases(prev => prev.map(c =>
      c.id === selectedCase.id
        ? { ...c, status: 'RESOLVED', verdict, notes: note || c.notes, updatedAt: new Date().toISOString() }
        : c
    ))
    setSelectedCase(prev => ({ ...prev, status: 'RESOLVED', verdict }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Alert Queue / Case Management</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Очередь фрод-алертов для ручной проверки аналитиком</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Все кейсы',    count: counts.ALL,      color: 'text-zinc-300',   icon: ChevronRight },
          { label: 'Открытые',     count: counts.OPEN,     color: 'text-rose-400',   icon: AlertTriangle },
          { label: 'На проверке',  count: counts.IN_REVIEW,color: 'text-amber-400',  icon: Clock },
          { label: 'Закрытые',     count: counts.RESOLVED, color: 'text-zinc-500',   icon: CheckCircle2 },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <Icon size={18} className={`${color} shrink-0`} />
            <div>
              <div className={`text-xl font-mono font-semibold ${color}`}>{count}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card title="Кейсы" subtitle="Клик по строке — детали кейса и SHAP-объяснение">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map((s) => {
              const meta = CASE_STATUS[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                    statusFilter === s
                      ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                      : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {s === 'ALL' ? 'Все' : (meta?.label ?? s)}
                  <span className="ml-1.5 text-zinc-600">{counts[s] ?? 0}</span>
                </button>
              )
            })}
          </div>
          <div className="relative md:ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Case ID / TXN ID / мерчант"
              className="w-full md:w-64 pl-9 pr-3 py-2 rounded-md bg-zinc-950 border border-zinc-800
                text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[860px]">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-950/50">
                  <th className="px-3 py-2.5">Case ID</th>
                  <th className="px-3 py-2.5">Приоритет</th>
                  <th className="px-3 py-2.5">Сумма</th>
                  <th className="px-3 py-2.5">Мерчант</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Статус</th>
                  <th className="px-3 py-2.5">Аналитик</th>
                  <th className="px-3 py-2.5">Создан</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const statusMeta = CASE_STATUS[c.status]
                  const priorityMeta = PRIORITY[c.priority]
                  return (
                    <tr
                      key={c.id}
                      onClick={() => { setSelectedCase(c); setNote(c.notes || '') }}
                      className="border-t border-zinc-800/70 hover:bg-zinc-900/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-zinc-300 font-medium group-hover:text-zinc-100">{c.id}</div>
                        <div className="font-mono text-[10px] text-zinc-600">{c.txId}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${priorityMeta?.bg} ${priorityMeta?.color}`}>
                          {priorityMeta?.label ?? c.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-200 font-medium">
                        {formatKZT(c.amount)}
                        <div className="text-[10px] text-zinc-600">{c.country} · {c.merchant}</div>
                      </td>
                      <td className="px-3 py-3 text-zinc-400 text-xs">{c.merchant}</td>
                      <td className="px-3 py-3"><ScoreBar score={c.score} /></td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md border ${statusMeta?.bg} ${statusMeta?.text} ${statusMeta?.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta?.dot}`} />
                          {statusMeta?.label ?? c.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-500 font-mono">
                        {c.assignee ? (
                          <span className="flex items-center gap-1">
                            <User size={10} className="text-zinc-600" />
                            {c.assignee}
                          </span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[10px] text-zinc-600 font-mono">
                        {formatDateTime(c.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-zinc-600">
              Нет кейсов по заданным фильтрам
            </div>
          )}
        </div>
      </Card>

      {/* Case Detail Modal */}
      <Modal
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        title={selectedCase?.id}
        subtitle={`${selectedCase?.txId} · ${selectedCase?.merchant} · ${selectedCase?.country}`}
        width="max-w-3xl"
      >
        {selectedCase && (() => {
          const statusMeta = CASE_STATUS[selectedCase.status]
          const priorityMeta = PRIORITY[selectedCase.priority]
          const isResolved = selectedCase.status === 'RESOLVED'
          const verdictMeta = VERDICT_META[selectedCase.verdict]
          return (
            <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  ['Сумма',     formatKZT(selectedCase.amount)],
                  ['Карта',     maskCard(selectedCase.card)],
                  ['IP',        selectedCase.ip],
                  ['Устройство',selectedCase.device],
                  ['Страна',    selectedCase.country],
                  ['Мерчант',   selectedCase.merchant],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-zinc-950 border border-zinc-800 p-2.5">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{k}</div>
                    <div className="mt-1 text-xs font-mono text-zinc-200 truncate">{v}</div>
                  </div>
                ))}
              </div>

              {/* Status + priority row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-md border ${statusMeta?.bg} ${statusMeta?.text} ${statusMeta?.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta?.dot}`} />
                  {statusMeta?.label ?? selectedCase.status}
                </span>
                <span className={`text-[10px] font-mono px-2 py-1 rounded ${priorityMeta?.bg} ${priorityMeta?.color}`}>
                  {priorityMeta?.label ?? selectedCase.priority}
                </span>
                <span className={`font-mono text-lg font-bold ml-auto ${selectedCase.score >= 80 ? 'text-rose-400' : selectedCase.score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {selectedCase.score}%
                </span>
              </div>

              {/* Verdict banner (if resolved) */}
              {isResolved && verdictMeta && (
                <div className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${verdictMeta.bg} ${verdictMeta.border}`}>
                  <span className={`text-sm font-semibold ${verdictMeta.color}`}>{verdictMeta.label}</span>
                </div>
              )}

              {/* SHAP Waterfall */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">SHAP Analysis</p>
                <ShapWaterfall factors={selectedCase.shapFactors} score={selectedCase.score} />
              </div>

              {/* Transaction history */}
              {selectedCase.history?.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">История транзакций</p>
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-950/50">
                          <th className="px-3 py-2">TXN ID</th>
                          <th className="px-3 py-2">Дата</th>
                          <th className="px-3 py-2">Сумма</th>
                          <th className="px-3 py-2">Мерчант</th>
                          <th className="px-3 py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCase.history.map((h) => (
                          <tr key={h.id} className="border-t border-zinc-800/60">
                            <td className="px-3 py-2 font-mono text-zinc-400">{h.id}</td>
                            <td className="px-3 py-2 font-mono text-zinc-500">{formatDateTime(h.date)}</td>
                            <td className="px-3 py-2 font-mono text-zinc-200">{formatKZT(h.amount)}</td>
                            <td className="px-3 py-2 text-zinc-400">{h.merchant}</td>
                            <td className={`px-3 py-2 font-mono font-semibold ${h.score >= 80 ? 'text-rose-400' : h.score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {h.score}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Analyst notes */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <MessageSquare size={11} />
                  Заметки аналитика
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isResolved}
                  placeholder="Добавьте заметки по кейсу..."
                  rows={3}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono
                    text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Action buttons */}
              {!isResolved && (
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => resolveCase('CONFIRMED_FRAUD')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25
                      border border-rose-800/50 hover:border-rose-700 text-rose-400 text-xs font-mono py-2 px-3
                      rounded-md transition-colors"
                  >
                    🔴 Подтвердить фрод
                  </button>
                  <button
                    onClick={() => resolveCase('FALSE_POSITIVE')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25
                      border border-emerald-800/50 hover:border-emerald-700 text-emerald-400 text-xs font-mono py-2 px-3
                      rounded-md transition-colors"
                  >
                    ✅ Ложное срабатывание
                  </button>
                  <button
                    onClick={() => {
                      setCases(prev => prev.map(c =>
                        c.id === selectedCase.id ? { ...c, status: 'IN_REVIEW', assignee: 'Мне', notes: note } : c
                      ))
                      setSelectedCase(prev => ({ ...prev, status: 'IN_REVIEW', assignee: 'Мне' }))
                    }}
                    className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-800/50
                      hover:border-amber-700 text-amber-400 text-xs font-mono rounded-md transition-colors"
                  >
                    ⚠️ В работу
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

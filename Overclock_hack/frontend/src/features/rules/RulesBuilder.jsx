import { useMemo, useState } from 'react'
import { Plus, X, ShieldAlert, BarChart2, GripVertical } from 'lucide-react'
import Card from '../../components/ui/Card'

const ACTION_META = {
  BLOCK:     { label: 'BLOCK',     bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-800/50' },
  CHALLENGE: { label: 'CHALLENGE', bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-800/50' },
  APPROVE:   { label: 'APPROVE',   bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-800/50' },
}

function evaluateRule(tx, rule) {
  let txValue
  if      (rule.field === 'amount')     txValue = tx.amount
  else if (rule.field === 'country')    txValue = tx.country
  else if (rule.field === 'risk_score') txValue = tx.score
  else return false

  const ruleValue = (rule.field === 'amount' || rule.field === 'risk_score')
    ? Number(rule.value)
    : rule.value

  if (rule.operator === '>'  && txValue >  ruleValue) return true
  if (rule.operator === '<'  && txValue <  ruleValue) return true
  if (rule.operator === '==' && txValue == ruleValue) return true
  return false
}

export default function RulesBuilder({ onRulesChange, liveTxs = [] }) {
  const [rules, setRules] = useState([
    { id: 1, field: 'amount', operator: '>', value: '5000', action: 'BLOCK', logic: 'AND' },
  ])
  const [newRule, setNewRule] = useState({ field: 'amount', operator: '>', value: '', action: 'BLOCK', logic: 'AND' })

  const addRule = () => {
    if (!newRule.value) return
    const updated = [...rules, { ...newRule, id: Date.now() }]
    setRules(updated)
    onRulesChange?.(updated)
    setNewRule({ ...newRule, value: '' })
  }

  const removeRule = (id) => {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    onRulesChange?.(updated)
  }

  // Compute hit counts from liveTxs for each rule
  const hitCounts = useMemo(() => {
    const counts = {}
    rules.forEach(rule => {
      counts[rule.id] = liveTxs.filter(tx => evaluateRule(tx, rule)).length
    })
    return counts
  }, [rules, liveTxs])

  const selectCls = 'bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500 font-mono text-xs transition-colors hover:border-zinc-600'

  return (
    <Card
      title="Business Rules Engine"
      subtitle="Hard overrides — применяются до ML-модели"
      action={
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
          <ShieldAlert size={12} className="text-amber-400" />
          {rules.length} правил
        </span>
      }
    >
      <div className="space-y-2.5">
        {/* Rules list */}
        {rules.length === 0 ? (
          <p className="text-xs text-zinc-600 italic py-2">Нет активных правил.</p>
        ) : (
          rules.map((rule, idx) => {
            const actionMeta = ACTION_META[rule.action] ?? ACTION_META.BLOCK
            const hits = hitCounts[rule.id] ?? 0
            return (
              <div
                key={rule.id}
                className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-md
                  hover:border-zinc-700 transition-colors group"
              >
                {/* Priority badge */}
                <span className="text-[10px] font-mono text-zinc-600 w-4 shrink-0 text-center">
                  #{idx + 1}
                </span>

                {/* Logic connector (show for 2nd+ rules) */}
                {idx > 0 && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                    {rule.logic}
                  </span>
                )}

                {/* Rule expression */}
                <div className="flex items-center gap-1.5 font-mono text-xs flex-1 min-w-0 flex-wrap">
                  <span className="text-zinc-500">IF</span>
                  <span className="text-sky-400 px-1 bg-sky-400/10 rounded border border-sky-800/30">
                    {rule.field}
                  </span>
                  <span className="text-zinc-300">{rule.operator}</span>
                  <span className="text-emerald-400 px-1 bg-emerald-400/10 rounded border border-emerald-800/30">
                    {rule.value}
                  </span>
                  <span className="text-zinc-500">→</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] ${actionMeta.bg} ${actionMeta.text} ${actionMeta.border}`}>
                    {actionMeta.label}
                  </span>
                </div>

                {/* Hit count */}
                <div className="flex items-center gap-1 shrink-0">
                  <BarChart2 size={11} className="text-zinc-600" />
                  <span className={`text-[10px] font-mono ${hits > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {hits}
                  </span>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Удалить правило"
                >
                  <X size={13} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Add new rule form */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-2.5">
          Добавить правило
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Logic selector (only if there are existing rules) */}
          {rules.length > 0 && (
            <select
              value={newRule.logic}
              onChange={(e) => setNewRule({ ...newRule, logic: e.target.value })}
              className={selectCls}
              title="Логика объединения с предыдущим правилом"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          )}

          <span className="text-zinc-500 text-xs font-mono">IF</span>

          <select
            value={newRule.field}
            onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
            className={selectCls}
          >
            <option value="amount">amount</option>
            <option value="country">country</option>
            <option value="risk_score">risk_score</option>
          </select>

          <select
            value={newRule.operator}
            onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
            className={selectCls}
          >
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="==">==</option>
          </select>

          <input
            type="text"
            value={newRule.value}
            onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Значение..."
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-md px-2 py-1.5 focus:outline-none
              focus:border-zinc-500 font-mono text-xs w-24 transition-colors hover:border-zinc-600"
          />

          <span className="text-zinc-500 text-xs font-mono">→</span>

          <select
            value={newRule.action}
            onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
            className={selectCls}
          >
            <option value="BLOCK">BLOCK</option>
            <option value="CHALLENGE">CHALLENGE</option>
            <option value="APPROVE">APPROVE</option>
          </select>

          <button
            onClick={addRule}
            disabled={!newRule.value}
            className="ml-auto flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40
              disabled:cursor-not-allowed text-zinc-200 px-3 py-1.5 rounded-md transition-colors text-xs font-mono border border-zinc-700"
          >
            <Plus size={13} />
            Добавить
          </button>
        </div>
      </div>
    </Card>
  )
}

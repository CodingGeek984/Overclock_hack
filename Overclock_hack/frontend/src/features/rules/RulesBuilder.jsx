import { useState } from 'react'
import { Plus, X, ShieldAlert } from 'lucide-react'
import Card from '../../components/ui/Card'

export default function RulesBuilder({ onRulesChange }) {
  const [rules, setRules] = useState([
    { id: 1, field: 'amount', operator: '>', value: '5000', action: 'BLOCK' }
  ])

  const [newRule, setNewRule] = useState({ field: 'amount', operator: '>', value: '', action: 'BLOCK' })

  const addRule = () => {
    if (!newRule.value) return
    const updated = [...rules, { ...newRule, id: Date.now() }]
    setRules(updated)
    if (onRulesChange) onRulesChange(updated)
    setNewRule({ ...newRule, value: '' })
  }

  const removeRule = (id) => {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    if (onRulesChange) onRulesChange(updated)
  }

  return (
    <Card title="Business Rules Engine" subtitle="Hard overrides evaluated before ML models">
      <div className="space-y-4">
        {/* Rules List */}
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No active rules.</p>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-md">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-400">IF</span>
                  <span className="text-blue-400 px-1 bg-blue-400/10 rounded">{rule.field}</span>
                  <span className="text-zinc-300">{rule.operator}</span>
                  <span className="text-emerald-400 px-1 bg-emerald-400/10 rounded">{rule.value}</span>
                  <span className="text-zinc-400 ml-2">THEN</span>
                  <span className={`px-1.5 py-0.5 rounded ${rule.action === 'BLOCK' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {rule.action}
                  </span>
                </div>
                <button onClick={() => removeRule(rule.id)} className="text-zinc-500 hover:text-rose-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Rule */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap gap-2 items-center text-sm">
          <select 
            value={newRule.field}
            onChange={(e) => setNewRule({...newRule, field: e.target.value})}
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500 font-mono text-xs"
          >
            <option value="amount">Amount</option>
            <option value="country">Country</option>
            <option value="risk_score">Risk Score</option>
          </select>

          <select
            value={newRule.operator}
            onChange={(e) => setNewRule({...newRule, operator: e.target.value})}
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500 font-mono text-xs"
          >
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="==">==</option>
          </select>

          <input 
            type="text"
            value={newRule.value}
            onChange={(e) => setNewRule({...newRule, value: e.target.value})}
            placeholder="Value..."
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500 font-mono text-xs w-24"
          />

          <span className="text-zinc-500 text-xs font-mono ml-1">THEN</span>

          <select
            value={newRule.action}
            onChange={(e) => setNewRule({...newRule, action: e.target.value})}
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500 font-mono text-xs"
          >
            <option value="BLOCK">BLOCK</option>
            <option value="APPROVE">APPROVE</option>
          </select>

          <button 
            onClick={addRule}
            className="ml-auto bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

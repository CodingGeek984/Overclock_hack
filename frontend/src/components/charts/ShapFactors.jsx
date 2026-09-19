import { Banknote, Clock, Globe, MapPin, ShieldOff, Smartphone, Store, Wifi } from 'lucide-react'

const FACTOR_ICONS = {
  'Amount Deviation': Banknote,
  'Country Risk': Globe,
  'VPN / Proxy': ShieldOff,
  'Geo Velocity': MapPin,
  'Merchant Category': Store,
  'Device Fingerprint': Smartphone,
  'Transaction Frequency': Clock,
}

function iconFor(name) {
  return FACTOR_ICONS[name] ?? Wifi
}

export default function ShapFactors({ data = [], limit = 3 }) {
  const rows = data.slice(0, limit)
  const maxAbs = Math.max(1, ...rows.map((f) => Math.abs(f.effect)))

  return (
    <div className="space-y-2.5">
      {rows.map((factor) => {
        const Icon = iconFor(factor.name)
        const positive = factor.effect >= 0
        const color = positive ? '#fb7185' : '#34d399'
        return (
          <div
            key={factor.name}
            className="flex items-center gap-3.5 rounded-2xl bg-white/[0.05] px-4 py-3"
          >
            <span
              className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <Icon size={16} strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white truncate">{factor.name}</span>
                <span
                  className="text-sm font-bold tabular-nums shrink-0"
                  style={{ color }}
                >
                  {positive ? '+' : ''}
                  {factor.effect.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(Math.abs(factor.effect) / maxAbs) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
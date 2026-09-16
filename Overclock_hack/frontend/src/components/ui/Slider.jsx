import { useId } from 'react'
import { scoreHex } from '../../utils/riskColors'

export default function Slider({
  label = 'Risk Threshold',
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v) => `${v}%`,
  showValue = true,
  accent = null,
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  const color = accent || scoreHex(value)

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          {label}
        </label>
        {showValue && (
          <span className="text-xs font-mono text-zinc-300">{format(value)}</span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-zinc-800 cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #27272a ${pct}%, #27272a 100%)`,
        }}
        aria-label={label}
      />
      <style>{`#${id}::-webkit-slider-thumb{appearance:none;width:12px;height:12px;border-radius:9999px;background:#fafafa;border:1px solid #71717a;cursor:pointer;transition:transform .1s}#${id}::-webkit-slider-thumb:hover{transform:scale(1.15)}#${id}::-moz-range-thumb{width:10px;height:10px;border-radius:9999px;background:#fafafa;border:1px solid #71717a;cursor:pointer}`}</style>
    </div>
  )
}
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
  dark = false,
}) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  const color = accent || scoreHex(value)
  const track = dark ? '#3f3f46' : '#e4e4e7'

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2.5">
        <label
          htmlFor={id}
          className={`text-xs font-semibold ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}
        >
          {label}
        </label>
        {showValue && (
          <span
            className={`text-sm font-bold ${dark ? 'text-white' : 'text-zinc-900'}`}
            style={{ color }}
          >
            {format(value)}
          </span>
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
        className={`w-full h-1.5 appearance-none rounded-full cursor-pointer ${
          dark ? 'bg-zinc-800' : 'bg-zinc-200'
        }`}
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, ${track} ${pct}%, ${track} 100%)`,
        }}
        aria-label={label}
      />
      <style>{`#${id}::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:9999px;background:#ffffff;border:1px solid ${dark ? '#3f3f46' : '#d4d4d8'};box-shadow:0 1px 4px rgba(0,0,0,.18);cursor:pointer;transition:transform .12s}#${id}::-webkit-slider-thumb:hover{transform:scale(1.12)}#${id}::-moz-range-thumb{width:16px;height:16px;border-radius:9999px;background:#ffffff;border:1px solid #d4d4d8;box-shadow:0 1px 4px rgba(0,0,0,.18);cursor:pointer}`}</style>
    </div>
  )
}
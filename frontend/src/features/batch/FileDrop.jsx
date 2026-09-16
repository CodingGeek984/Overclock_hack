import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'

export default function FileDrop({ onFile, onDemo, accept = '.csv' }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (event) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) onFile?.(file)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-[28px] border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
        dragOver
          ? 'border-zinc-950 bg-zinc-50 scale-[1.01]'
          : 'border-zinc-300 bg-zinc-50/50 hover:border-zinc-950 hover:bg-zinc-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile?.(file)
          e.target.value = ''
        }}
      />

      <div className="flex flex-col items-center gap-3">
        <span
          className={`flex items-center justify-center w-16 h-16 rounded-full transition-colors ${
            dragOver ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200 text-zinc-500'
          }`}
        >
          <FileUp size={26} strokeWidth={1.8} />
        </span>
        <p className="text-lg font-bold tracking-tight text-zinc-950">
          {dragOver ? 'Отпустите файл' : 'Перетащите CSV-файл сюда'}
        </p>
        <p className="text-sm text-zinc-500 font-mono">mock-100k-sample.csv · клик для выбора</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDemo?.()
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 text-white px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          демо-файл 10k без загрузки
        </button>
      </div>
    </div>
  )
}
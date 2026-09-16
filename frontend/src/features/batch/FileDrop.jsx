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
      className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
        dragOver
          ? 'border-zinc-500 bg-zinc-900/40'
          : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
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

      <div className="flex flex-col items-center gap-2">
        <FileUp size={22} className="text-zinc-600" />
        <p className="text-sm text-zinc-300">
          {dragOver ? 'Отпустите файл' : 'Перетащите CSV-файл сюда'}
        </p>
        <p className="text-xs font-mono text-zinc-600">mock-100k-sample.csv · клик для выбора</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDemo?.()
          }}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          демо-файл 10k без загрузки
        </button>
      </div>
    </div>
  )
}
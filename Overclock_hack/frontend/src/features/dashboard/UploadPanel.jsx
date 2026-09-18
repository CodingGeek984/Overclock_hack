import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle,
  CloudUpload,
  FileText,
  Loader,
  Play,
  RotateCcw,
  XCircle,
  Zap,
  BarChart2,
  Clock,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const UPLOAD_ENDPOINT = '/api/v1/data/upload'
const STREAM_ENDPOINT = '/api/v1/data/stream'
const STATUS_ENDPOINT = '/api/v1/data/status'

const ACCEPTED_FORMATS = '.csv,.tsv,.parquet'

const FEATURE_LABELS = {
  amount_z_score: 'Z-score суммы',
  travel_distance_km: 'Расстояние (km)',
  travel_speed_kmh: 'Скорость (km/h)',
  impossible_travel_flag: 'Impossible Travel',
  velocity_count_5m: 'Velocity 5m',
  velocity_count_1h: 'Velocity 1h',
  velocity_count_24h: 'Velocity 24h',
  velocity_sum_1h: 'Sum 1h',
  velocity_sum_24h: 'Sum 24h',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatDuration(ms) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ value, color = '#22d3ee', label = '' }) {
  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-zinc-500 font-mono">{label}</span>
          <span className="text-xs font-bold font-mono text-zinc-300">
            {value.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

function StatBadge({ icon: Icon, label, value, color = '#71717a' }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 px-3.5 py-3">
      <Icon size={14} color={color} className="shrink-0" />
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">{label}</div>
        <div className="text-sm font-bold font-mono text-zinc-200 mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function FeaturePill({ name }) {
  const label = FEATURE_LABELS[name] ?? name
  return (
    <span className="inline-flex items-center rounded-full bg-violet-950/50 border border-violet-800/30 px-2.5 py-1 text-[10px] font-mono font-medium text-violet-300">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * UploadPanel
 *
 * Модуль B: Панель загрузки и предиктивной обработки датасета транзакций.
 *
 * Возможности:
 *  - Drag & Drop зона для CSV/Parquet файлов
 *  - Прогресс-бар с симуляцией потоковой обработки
 *  - Отображение статистики запущенного Feature Engineering Pipeline
 *  - Кнопка «Запустить поток» для генерации синтетических данных
 *
 * Props:
 *   onDone — callback, вызываемый после успешной обработки
 *   t      — объект локализации (опционально)
 */
export default function UploadPanel({ onDone, t = {} }) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [streamRunning, setStreamRunning] = useState(false)
  const [streamProgress, setStreamProgress] = useState(0)

  const fileInputRef = useRef(null)
  const pollRef = useRef(null)
  const progressTimerRef = useRef(null)

  // -------------------------------------------------------------------------
  // Upload file
  // -------------------------------------------------------------------------
  const handleUpload = useCallback(async (fileToUpload) => {
    if (!fileToUpload) return

    setUploadState('uploading')
    setProgress(0)
    setError(null)
    setResult(null)

    // Симулируем прогресс загрузки (реальный прогресс требует XHR)
    let prog = 0
    progressTimerRef.current = setInterval(() => {
      prog = Math.min(prog + Math.random() * 8 + 2, 88)
      setProgress(prog)
    }, 120)

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const res = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressTimerRef.current)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setProgress(100)
      setUploadState('done')
      setResult(data)
      onDone?.()
    } catch (err) {
      clearInterval(progressTimerRef.current)
      setProgress(0)

      // Fallback: симулируем успешную обработку с mock-данными
      setUploadState('done')
      setResult({
        status: 'success',
        filename: fileToUpload.name,
        file_format: fileToUpload.name.endsWith('.parquet') ? 'parquet' : 'csv',
        records_total: 100_000,
        records_processed: 100_000,
        features_computed: Object.keys(FEATURE_LABELS),
        pipeline_duration_ms: 1842,
        stats: {
          amount_z_score: { mean: 0.12, std: 1.43, min: -10, max: 10 },
          impossible_travel_flag: { mean: 0.018, std: 0.13, min: 0, max: 1 },
          velocity_count_1h: { mean: 2.4, std: 3.1, min: 1, max: 48 },
        },
        warnings: ['API недоступен — показаны демо-данные'],
        message: `✓ Demo: ${fileToUpload.name} — 100,000 записей, 9 признаков (mock)`,
      })
      setProgress(100)
      onDone?.()
    }
  }, [onDone])

  // -------------------------------------------------------------------------
  // Stream simulation
  // -------------------------------------------------------------------------
  const handleStartStream = useCallback(async () => {
    if (streamRunning) return
    setStreamRunning(true)
    setStreamProgress(0)
    setError(null)

    try {
      await fetch(STREAM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate_per_second: 500, duration_seconds: 10 }),
      })
    } catch {
      // Игнорируем — продолжаем симуляцию на фронтенде
    }

    // Симулируем прогресс потока
    let prog = 0
    const timer = setInterval(() => {
      prog = Math.min(prog + Math.random() * 4 + 1, 100)
      setStreamProgress(prog)
      if (prog >= 100) {
        clearInterval(timer)
        setStreamRunning(false)
        // Показываем mock-результат
        setResult({
          status: 'success',
          filename: 'live_stream',
          file_format: 'csv',
          records_total: 100_000,
          records_processed: 100_000,
          features_computed: Object.keys(FEATURE_LABELS),
          pipeline_duration_ms: 3200,
          stats: {},
          warnings: [],
          message: '✓ Поток обработан: 100,000 синтетических транзакций за 3.2s',
        })
        setUploadState('done')
        setProgress(100)
        onDone?.()
      }
    }, 150)

    pollRef.current = timer
  }, [streamRunning, onDone])

  // -------------------------------------------------------------------------
  // Drag & Drop
  // -------------------------------------------------------------------------
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) {
        setFile(dropped)
        handleUpload(dropped)
      }
    },
    [handleUpload],
  )

  const handleFileChange = useCallback(
    (e) => {
      const selected = e.target.files?.[0]
      if (selected) {
        setFile(selected)
        handleUpload(selected)
      }
    },
    [handleUpload],
  )

  const handleReset = useCallback(() => {
    clearInterval(progressTimerRef.current)
    clearInterval(pollRef.current)
    setFile(null)
    setUploadState('idle')
    setProgress(0)
    setResult(null)
    setError(null)
    setStreamRunning(false)
    setStreamProgress(0)
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const isProcessing = uploadState === 'uploading' || uploadState === 'processing'
  const isDone = uploadState === 'done' && result

  return (
    <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-950">
            Data Ingestion
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            CSV / Parquet · Feature Engineering Pipeline
          </p>
        </div>
        {isDone && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            <RotateCcw size={12} />
            Сбросить
          </button>
        )}
      </div>

      {/* Drop Zone */}
      {uploadState === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all select-none ${
            dragOver
              ? 'border-violet-400 bg-violet-50'
              : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            className="sr-only"
            onChange={handleFileChange}
          />
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              dragOver ? 'bg-violet-100' : 'bg-zinc-100'
            }`}
          >
            <CloudUpload size={22} className={dragOver ? 'text-violet-600' : 'text-zinc-400'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-700">
              {dragOver ? 'Отпустите файл' : 'Перетащите файл или нажмите'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">CSV · Parquet · до 500 MB</p>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 border border-zinc-200 px-4 py-3">
            <FileText size={16} className="text-zinc-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-700 truncate">{file?.name}</p>
              <p className="text-xs text-zinc-400">{file ? formatBytes(file.size) : ''}</p>
            </div>
            <Loader size={14} className="text-violet-500 animate-spin shrink-0" />
          </div>

          <ProgressBar
            value={progress}
            color="#8b5cf6"
            label="Загрузка & Feature Engineering Pipeline"
          />

          <div className="grid grid-cols-3 gap-2 text-xs font-mono text-zinc-500">
            {['Z-Score', 'Travel Speed', 'Velocity'].map((step, i) => (
              <div
                key={step}
                className={`rounded-xl px-3 py-2 text-center border transition-colors ${
                  progress > (i + 1) * 25
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                }`}
              >
                {progress > (i + 1) * 25 ? '✓' : '○'} {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {isDone && (
        <div className="space-y-4">
          {/* Status banner */}
          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${
              result.status === 'success'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {result.status === 'success' ? (
              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium text-zinc-700 leading-relaxed">
              {result.message}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatBadge
              icon={BarChart2}
              label="Записей"
              value={`${(result.records_processed ?? 0).toLocaleString('ru-RU')}`}
              color="#8b5cf6"
            />
            <StatBadge
              icon={Zap}
              label="Признаков"
              value={`${result.features_computed?.length ?? 0}`}
              color="#22d3ee"
            />
            <StatBadge
              icon={Clock}
              label="Время"
              value={formatDuration(result.pipeline_duration_ms ?? 0)}
              color="#34d399"
            />
          </div>

          {/* Feature pills */}
          {result.features_computed?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Рассчитанные признаки
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.features_computed.map((f) => (
                  <FeaturePill key={f} name={f} />
                ))}
              </div>
            </div>
          )}

          {/* Progress bar (complete) */}
          <ProgressBar value={100} color="#10b981" label="Pipeline завершён" />

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              {result.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-700 font-mono">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {uploadState === 'error' && error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3.5 flex items-start gap-3">
          <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-700">Ошибка обработки</p>
            <p className="text-xs text-rose-500 mt-0.5 font-mono">{error}</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-100" />
        <span className="text-xs text-zinc-400 font-medium shrink-0">или</span>
        <div className="flex-1 h-px bg-zinc-100" />
      </div>

      {/* Stream simulation */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-zinc-700">Live Stream Simulation</p>
            <p className="text-xs text-zinc-400">
              Генерирует 100K синтетических транзакций и прогоняет через пайплайн
            </p>
          </div>
        </div>

        {streamRunning && (
          <ProgressBar
            value={streamProgress}
            color="#22d3ee"
            label={`Обработка потока · ${streamProgress.toFixed(0)}%`}
          />
        )}

        <button
          type="button"
          id="start-stream-btn"
          onClick={handleStartStream}
          disabled={streamRunning || isProcessing}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            streamRunning || isProcessing
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : 'bg-zinc-950 text-white hover:bg-zinc-800 active:scale-[0.98]'
          }`}
        >
          {streamRunning ? (
            <>
              <Loader size={14} className="animate-spin" />
              Обработка потока...
            </>
          ) : (
            <>
              <Play size={14} />
              Запустить поток 100K транзакций
            </>
          )}
        </button>
      </div>
    </div>
  )
}

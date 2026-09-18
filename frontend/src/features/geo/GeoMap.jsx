import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { AlertTriangle, Shield, Zap, MapPin, ArrowRight, X, Globe, Wifi, RotateCcw } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { generateGeoEvents, analyzeGeoAnomaly, CITY_COORDS } from '../../utils/geoAnalyzer'
import { fetchTransactions, mapBackendGeoEvent } from '../../services/transactionsApi'
import Spinner from '../../components/ui/Spinner'
import { STATUS } from '../../utils/riskColors'
import 'leaflet/dist/leaflet.css'

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>'

const ANOMALY_TYPES = {
  impossible_travel: { label: 'Impossible Travel', color: '#fb7185', icon: Zap },
  sanctioned_zone: { label: 'Sanctioned Zone', color: '#fbbf24', icon: Shield },
  geo_deviation: { label: 'Geo Deviation', color: '#f97316', icon: Globe },
  anomaly_gap: { label: 'Anomaly Gap', color: '#fb7185', icon: AlertTriangle },
  none: { label: 'Normal', color: '#34d399', icon: MapPin },
}

function createIcon(color, size = 28, pulsing = false) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid rgba(255,255,255,0.9);
      color:${color};
      box-shadow:0 0 ${pulsing ? '20px 8px' : '8px 3px'} ${color}66;
      ${pulsing ? 'animation:pulse-glow 1.5s ease-in-out infinite;' : ''}
    "></div>`,
  })
}

function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function createArrowIcon(color, deg) {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<svg width="22" height="22" viewBox="0 0 22 22" style="transform:rotate(${deg}deg)">
      <polygon points="0,4 22,11 0,18 5,11" fill="${color}" opacity="0.9"/>
    </svg>`,
  })
}

function LineArrows({ lines }) {
  return lines.map((line) => {
    const midLat = (line.positions[0][0] + line.positions[1][0]) / 2
    const midLng = (line.positions[0][1] + line.positions[1][1]) / 2
    const deg = bearing(line.positions[0][0], line.positions[0][1], line.positions[1][0], line.positions[1][1])
    return (
      <Marker
        key={`${line.key}-arrow`}
        position={[midLat, midLng]}
        icon={createArrowIcon(line.color, deg)}
        interactive={false}
      />
    )
  })
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])
  return null
}

function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) })
  return null
}

function SidePanel({ event, onClose }) {
  const { t } = useLanguage()
  if (!event) return null

  const analysis = event.analysis || {}
  const meta = ANOMALY_TYPES[analysis.type] || ANOMALY_TYPES.none

  return (
    <div className="absolute top-0 right-0 z-[1000] w-full sm:w-[380px] h-full bg-zinc-950/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto animate-fade-in">
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}88` }}
            />
            <span className="text-white font-semibold text-sm">{meta.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-3">
          <InfoRow label="ID" value={event.id} mono />
          <InfoRow label={t.thDate} value={new Date(event.date).toLocaleString('ru-RU')} />
          <InfoRow label="IP" value={event.ip} mono />
          <InfoRow label="Устройство" value={event.device} />
          <InfoRow label="Мерчант" value={event.merchant} />
          <InfoRow label={t.txAmount} value={`${event.amount?.toLocaleString('ru-RU')} ₸`} mono />
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Geo-детали</h4>
          <div className="space-y-3">
            {analysis.fromCity && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <MapPin size={12} className="text-zinc-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Откуда</div>
                  <div className="text-white text-sm">{analysis.fromCity}, {analysis.fromCountry}</div>
                </div>
              </div>
            )}
            {analysis.toCity && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <MapPin size={12} style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Куда</div>
                  <div className="text-white text-sm">{analysis.toCity}, {analysis.toCountry}</div>
                </div>
              </div>
            )}
            {analysis.distanceKm > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <ArrowRight size={12} className="text-zinc-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Дистанция</div>
                  <div className="text-white text-sm">{analysis.distanceKm.toLocaleString('ru-RU')} км</div>
                </div>
              </div>
            )}
            {analysis.speedKmH > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Zap size={12} className="text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Рассчитанная скорость</div>
                  <div className="text-white text-sm">{analysis.speedKmH.toLocaleString('ru-RU')} км/ч</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Risk Score</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${analysis.riskScore || 0}%`,
                  background: analysis.riskScore > 70 ? '#fb7185' : analysis.riskScore > 40 ? '#fbbf24' : '#34d399',
                }}
              />
            </div>
            <span className="text-white text-sm font-mono font-bold">{analysis.riskScore || 0}</span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Wifi size={12} />
            <span>Статус: </span>
            <span
              className="font-semibold"
              style={{ color: event.status === STATUS.BLOCK ? '#fb7185' : event.status === STATUS.CHALLENGE ? '#fbbf24' : '#34d399' }}
            >
              {event.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

const DEMO_ATTACKS = [
  { id: 'DEMO-001', city: 'London', country: 'GB', ip: '89.247.164.12', merchant: 'Binance', device: 'Browser + VPN', amount: 2500000, frequency: 1, status: STATUS.BLOCK, score: 99 },
  { id: 'DEMO-002', city: 'New York', country: 'US', ip: '198.51.100.42', merchant: 'Coinbase', device: 'Android Emulator', amount: 1800000, frequency: 3, status: STATUS.BLOCK, score: 97 },
]

export default function GeoMap() {
  const { t } = useLanguage()
  const [filter, setFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [demoRunning, setDemoRunning] = useState(false)
  const mapRef = useRef(null)

  const load = useCallback(async () => {
    const res = await fetchTransactions()
    if (res.ok) {
      const now = Date.now()
      setEvents(
        generateGeoEvents(res.data.map((row, i) => mapBackendGeoEvent(row, i, now))),
      )
    } else {
      setError(res.error)
      setEvents([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load, refreshKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((k) => k + 1)
  }

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'fraud') return events.filter((e) => e.analysis?.isAnomaly)
    if (filter === 'impossible') return events.filter((e) => e.analysis?.type === 'impossible_travel')
    return events
  }, [events, filter])

  const polylines = useMemo(() => {
    const lines = []
    const byCard = {}
    filteredEvents.forEach((e) => {
      if (!byCard[e.card]) byCard[e.card] = []
      byCard[e.card].push(e)
    })
    Object.values(byCard).forEach((cardEvents) => {
      const sorted = [...cardEvents].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        if (prev.coords && curr.coords && curr.analysis?.isAnomaly) {
          lines.push({
            key: `${prev.id}-${curr.id}`,
            positions: [
              [prev.coords.lat, prev.coords.lng],
              [curr.coords.lat, curr.coords.lng],
            ],
            color: curr.analysis.type === 'impossible_travel' ? '#fb7185' : '#fbbf24',
            analysis: curr.analysis,
            event: curr,
          })
        }
      }
    })
    return lines
  }, [filteredEvents])

  const bounds = useMemo(() => {
    const pts = filteredEvents
      .filter((e) => e.coords)
      .map((e) => [e.coords.lat, e.coords.lng])
    if (pts.length === 0) return [[43, 76], [43, 76]]
    return pts
  }, [filteredEvents])

  const runDemoAttack = useCallback(() => {
    if (demoRunning) return
    setDemoRunning(true)

    const card = '4400 1234 8790 1122'
    const baseline = {
      city: 'Almaty',
      country: 'KZ',
      ip: '92.46.11.3',
      device: 'iPhone 15 · known',
    }
    const now = Date.now()

    DEMO_ATTACKS.forEach((attack, i) => {
      const t = now + (i + 1) * 5 * 60000
      setTimeout(() => {
        const prev = i === 0 ? { ...baseline, date: new Date(t - 5 * 60000).toISOString() } : { ...DEMO_ATTACKS[i - 1], date: new Date(t - 5 * 60000).toISOString() }
        const current = { ...attack, date: new Date(t).toISOString(), card }
        const analysis = analyzeGeoAnomaly(current, { ...prev, card })
        const coords = CITY_COORDS[attack.city]
        const enriched = { ...current, analysis, coords }

        setEvents((prevEvents) => {
          let next = [...prevEvents]
          if (i === 0) {
            const home = { ...baseline, card, date: prev.date }
            next = [
              {
                ...home,
                coords: CITY_COORDS[baseline.city],
                analysis: {
                  isAnomaly: false,
                  type: 'none',
                  riskScore: 5,
                  distanceKm: 0,
                  speedKmH: 0,
                  toCity: baseline.city,
                  toCountry: baseline.country,
                  ip: baseline.ip,
                },
              },
              ...next,
            ]
          }
          return [enriched, ...next]
        })
        setSelectedEvent(enriched)
        if (i === DEMO_ATTACKS.length - 1) setDemoRunning(false)
      }, (i + 1) * 1500)
    })
  }, [demoRunning])

  const handleMapClick = useCallback(() => {
    setSelectedEvent(null)
  }, [])

  const FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'fraud', label: 'Только Фрод' },
    { id: 'impossible', label: 'Impossible Travel' },
  ]

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-zinc-950" style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px 3px currentColor; transform: scale(1); }
          50% { box-shadow: 0 0 24px 10px currentColor; transform: scale(1.15); }
        }
        .leaflet-container { background: #0a0a0f !important; font-family: inherit; }
        .custom-popup .leaflet-popup-content-wrapper {
          background: #18181b; color: #fafafa; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
        }
        .custom-popup .leaflet-popup-content { margin: 12px 14px; font-family: inherit; }
        .custom-popup .leaflet-popup-tip { background: #18181b; border: 1px solid rgba(255,255,255,0.1); }
        .custom-popup .leaflet-popup-close-button { color: #a1a1aa; }
        .custom-popup .leaflet-popup-close-button:hover { color: #fff; }
      `}</style>

      <MapContainer
        center={[43.238, 76.945]}
        zoom={4}
        className="w-full h-full"
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer url={DARK_TILE} attribution={TILE_ATTR} maxZoom={18} />
        <FitBounds bounds={bounds} />
        <MapClickHandler onClick={handleMapClick} />

        {filteredEvents.map((event) => {
          if (!event.coords) return null
          const analysis = event.analysis || {}
          const meta = ANOMALY_TYPES[analysis.type] || ANOMALY_TYPES.none
          const pulsing = analysis.isAnomaly && event.status === STATUS.BLOCK
          const icon = createIcon(meta.color, pulsing ? 34 : 26, pulsing)

          return (
            <Marker
              key={event.id}
              position={[event.coords.lat, event.coords.lng]}
              icon={icon}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent)
                  setSelectedEvent(event)
                },
              }}
            >
              <Popup className="custom-popup">
                <div className="text-xs">
                  <strong>{event.id}</strong><br />
                  {event.city}, {event.country}<br />
                  {meta.label}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {polylines.map((line) => (
          <Polyline
            key={line.key}
            positions={line.positions}
            pathOptions={{
              color: line.color,
              weight: 2,
              dashArray: '8 8',
              opacity: 0.8,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent)
                setSelectedEvent(line.event)
              },
            }}
          />
        ))}

        <LineArrows lines={polylines} />
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 z-[1200] flex flex-col items-center justify-center gap-3 bg-zinc-950/70 backdrop-blur-sm">
          <Spinner size={26} dark label={t.dashboardLoading} />
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] w-[min(92%,480px)] rounded-2xl border border-rose-500/30 bg-rose-950/90 backdrop-blur-xl px-4 py-3 flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-rose-200">{t.backendUnavailable}</p>
            <p className="text-[11px] text-rose-300/80 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors shrink-0"
          >
            <RotateCcw size={12} />
            {t.retry}
          </button>
        </div>
      )}

      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl border border-white/10 p-1.5 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filter === f.id
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={runDemoAttack}
          disabled={demoRunning}
          className={`bg-zinc-950/90 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold transition-all hover:border-rose-500/50 hover:bg-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed ${
            demoRunning ? 'border-rose-500/50 bg-rose-950/40 text-rose-400' : 'text-zinc-300'
          }`}
        >
          <AlertTriangle size={14} className={demoRunning ? 'animate-pulse' : ''} />
          {demoRunning ? 'Атака...' : 'Geo Attack Demo'}
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-[1000] bg-zinc-950/90 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-2.5 flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          Норма
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          Аномалия
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          Риск
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-zinc-500" />
          Трек
        </span>
      </div>

      <SidePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

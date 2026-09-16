import { useMemo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps"
import Card from '../../components/ui/Card'

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Predefined coordinates for our simulated cities
const CITY_COORDS = {
  "New York": [-74.006, 40.7128],
  "London": [-0.1276, 51.5072],
  "Tokyo": [139.6917, 35.6895],
  "Berlin": [13.4050, 52.5200],
  "Sydney": [151.2093, -33.8688],
  "Lagos": [3.3792, 6.5244]
}

export default function GeoThreatMap({ transactions = [] }) {
  const markers = useMemo(() => {
    // Only show the 20 most recent transactions on the map
    return transactions.slice(0, 20).map(tx => {
      const city = tx.location ? tx.location.split(',')[0] : null
      const coordinates = CITY_COORDS[city] || [0, 0]
      const isFraud = tx.risk_score >= 80 || tx.status === 'BLOCK'
      
      return {
        id: tx.id,
        coordinates,
        isFraud,
        amount: tx.amount
      }
    })
  }, [transactions])

  return (
    <Card title="Geographical Threat Map" subtitle="Real-time transaction origins">
      <div className="w-full h-[300px] bg-zinc-950/50 rounded-md overflow-hidden relative">
        <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={400} style={{ width: "100%", height: "100%" }}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#27272a" // zinc-800
                  stroke="#3f3f46" // zinc-700
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#3f3f46", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          
          {markers.map(({ id, coordinates, isFraud, amount }) => {
            if (coordinates[0] === 0 && coordinates[1] === 0) return null;
            
            return (
              <Marker key={id} coordinates={coordinates}>
                <circle
                  r={isFraud ? 8 : 4}
                  fill={isFraud ? "#f43f5e" : "#10b981"} // rose-500 or emerald-500
                  className={isFraud ? "animate-ping opacity-75" : "opacity-90"}
                />
                <circle
                  r={isFraud ? 4 : 2}
                  fill={isFraud ? "#fff" : "#fff"}
                />
              </Marker>
            )
          })}
        </ComposableMap>
        
        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-zinc-900/80 p-2 rounded border border-zinc-800 flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> High Risk (Blocked)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Safe (Allowed)
          </div>
        </div>
      </div>
    </Card>
  )
}

const CITY_COORDS = {
  'Almaty':    { lat: 43.2380, lng: 76.9455 },
  'Astana':    { lat: 51.1282, lng: 71.4304 },
  'Shymkent':  { lat: 42.3417, lng: 69.5901 },
  'Karaganda': { lat: 49.8064, lng: 73.1095 },
  'Atyrau':    { lat: 47.0945, lng: 51.8923 },
  'Pavlodar':  { lat: 52.2855, lng: 76.9409 },
  'Taraz':     { lat: 42.9014, lng: 71.3783 },
  'Moscow':    { lat: 55.7558, lng: 37.6173 },
  'Yekaterinburg': { lat: 56.8389, lng: 60.6057 },
  'Istanbul':  { lat: 41.0082, lng: 28.9784 },
  'London':    { lat: 51.5074, lng: -0.1278 },
  'New York':  { lat: 40.7128, lng: -74.0060 },
  'Lagos':     { lat: 6.5244, lng: 3.3792 },
  'Abuja':     { lat: 9.0579, lng: 7.4951 },
  'Manila':    { lat: 14.5995, lng: 120.9842 },
  'Ho Chi Minh': { lat: 10.8231, lng: 106.6297 },
  'Shenzhen':  { lat: 22.5431, lng: 114.0579 },
  'Kyiv':      { lat: 50.4501, lng: 30.5234 },
  'Baku':      { lat: 40.4093, lng: 49.8671 },
  'Casablanca': { lat: 33.5731, lng: -7.5898 },
  'Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Minsk':     { lat: 53.9045, lng: 27.5615 },
  'Bucharest': { lat: 44.4268, lng: 26.1025 },
  'Tbilisi':   { lat: 41.7151, lng: 44.8271 },
  'Tashkent':  { lat: 41.2995, lng: 69.2401 },
  'Bishkek':   { lat: 42.8746, lng: 74.5698 },
}

const SANCTIONED_RISK_ZONES = [
  { code: 'NG', risk: 0.9, label: 'Нигерия' },
  { code: 'PH', risk: 0.7, label: 'Филиппины' },
  { code: 'VN', risk: 0.6, label: 'Вьетнам' },
  { code: 'CN', risk: 0.5, label: 'Китай' },
  { code: 'MA', risk: 0.5, label: 'Марокко' },
  { code: 'UA', risk: 0.4, label: 'Украина' },
  { code: 'BY', risk: 0.7, label: 'Беларусь' },
  { code: 'RU', risk: 0.35, label: 'Россия' },
]

const USER_HOME_CITIES = {
  default: 'Almaty',
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCityCoords(city) {
  return CITY_COORDS[city] || null
}

function getCountryRisk(code) {
  const zone = SANCTIONED_RISK_ZONES.find((z) => z.code === code)
  return zone || null
}

export function analyzeGeoAnomaly(tx, prevTx = null) {
  const result = {
    isAnomaly: false,
    type: 'none',
    riskScore: 0,
    distanceKm: 0,
    speedKmH: 0,
    fromCity: null,
    toCity: null,
    fromCountry: null,
    toCountry: null,
    ip: tx.ip || null,
  }

  const currentCoords = getCityCoords(tx.city)
  if (!currentCoords) {
    const sanctioned = getCountryRisk(tx.country)
    if (sanctioned) {
      result.isAnomaly = true
      result.type = 'sanctioned_zone'
      result.riskScore = Math.round(sanctioned.risk * 100)
      result.toCity = tx.city
      result.toCountry = tx.country
    }
    return result
  }

  result.toCity = tx.city
  result.toCountry = tx.country

  if (prevTx) {
    const prevCoords = getCityCoords(prevTx.city)
    result.fromCity = prevTx.city
    result.fromCountry = prevTx.country

    if (prevCoords) {
      const dist = haversineDistance(
        prevCoords.lat, prevCoords.lng,
        currentCoords.lat, currentCoords.lng
      )
      result.distanceKm = Math.round(dist)

      const t1 = new Date(prevTx.date).getTime()
      const t2 = new Date(tx.date).getTime()
      const diffMs = Math.abs(t2 - t1)
      const diffH = diffMs / 3600000

      if (diffH > 0) {
        result.speedKmH = Math.round(dist / diffH)
      }

      const IMPOSSIBLE_SPEED = 900
      if (dist > 500 && result.speedKmH > IMPOSSIBLE_SPEED) {
        result.isAnomaly = true
        result.type = 'impossible_travel'
        result.riskScore = Math.min(99, Math.round(50 + (result.speedKmH / IMPOSSIBLE_SPEED) * 30))
      } else if (dist > 2000 && diffH < 24) {
        result.isAnomaly = true
        result.type = 'anomaly_gap'
        result.riskScore = Math.min(85, Math.round(40 + (dist / 10000) * 30))
      }
    }
  }

  if (!result.isAnomaly) {
    const sanctioned = getCountryRisk(tx.country)
    if (sanctioned && sanctioned.risk > 0.5) {
      result.isAnomaly = true
      result.type = 'sanctioned_zone'
      result.riskScore = Math.round(sanctioned.risk * 100)
    } else if (sanctioned) {
      result.riskScore = Math.round(sanctioned.risk * 50)
    }
  }

  const homeCity = USER_HOME_CITIES[tx.userId] || USER_HOME_CITIES.default
  if (!result.isAnomaly && tx.city !== homeCity) {
    const homeCoords = getCityCoords(homeCity)
    if (homeCoords) {
      const deviation = haversineDistance(
        homeCoords.lat, homeCoords.lng,
        currentCoords.lat, currentCoords.lng
      )
      if (deviation > 3000) {
        result.isAnomaly = true
        result.type = 'geo_deviation'
        result.riskScore = Math.min(75, Math.round(30 + (deviation / 15000) * 30))
        result.distanceKm = Math.round(deviation)
      }
    }
  }

  return result
}

export function generateGeoEvents(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const userHistory = {}
  return sorted.map((tx) => {
    const key = tx.card
    const prev = userHistory[key] || null
    const analysis = analyzeGeoAnomaly(tx, prev)
    userHistory[key] = tx
    return {
      ...tx,
      analysis,
      coords: getCityCoords(tx.city),
    }
  })
}

export { CITY_COORDS, SANCTIONED_RISK_ZONES }

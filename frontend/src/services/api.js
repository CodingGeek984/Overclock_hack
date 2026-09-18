// Same-origin: requests go through the Vite dev/preview proxy to the backend
// (see vite.config.js), avoiding cross-origin CORS preflights entirely.
// Override with VITE_API_URL to call some backend directly.
export const BASE_URL = import.meta.env.VITE_API_URL || ''

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '69420',
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apiGet(path, timeout = 10000) {
  return request(path, { method: 'GET' }, timeout)
}

export async function apiPost(path, body, timeout = 15000) {
  return request(path, { method: 'POST', body: JSON.stringify(body) }, timeout)
}

export async function apiPut(path, body, timeout = 15000) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) }, timeout)
}

async function request(path, options = {}, timeout = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { ...DEFAULT_HEADERS, ...(options.headers ?? {}) },
      ...options,
    })

    if (!response.ok) {
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      const htmlBackend = contentType.includes('text/html')
      throw new Error(
        htmlBackend
          ? `Бэкенд недоступен или оффлайн (HTTP ${response.status})`
          : `HTTP ${response.status} ${response.statusText || ''}`.trim(),
      )
    }

    const data = await response.json()
    return { ok: true, data }
  } catch (error) {
    const message =
      error.name === 'AbortError'
        ? `Превышен таймаут запроса (${path})`
        : error.message || 'Сетевая ошибка'
    return { ok: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}
// Same-origin по умолчанию: запросы идут через Vite-proxy на ngrok-бэкенд
// (см. vite.config.js — target ngrok, заголовок ngrok-skip-browser-warning
// добавляется на стороне прокси, DNS резолвится в Node, а не в браузере
// → нет ERR_NAME_NOT_RESOLVED и CORS-префлайтов).
// Прямые кросс-доменные вызовы доступны через VITE_API_URL,
// тогда заголовки ниже применяются браузером к каждому запросу.
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
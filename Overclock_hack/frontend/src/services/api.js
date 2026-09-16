const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apiGet(path, timeout = 8000) {
  return request(path, { method: 'GET' }, timeout)
}

export async function apiPost(path, body, timeout = 12000) {
  return request(path, { method: 'POST', body: JSON.stringify(body) }, timeout)
}

async function request(path, options = {}, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!response.ok) {
      throw new Error(`API ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: error.message }
  } finally {
    clearTimeout(timer)
  }
}
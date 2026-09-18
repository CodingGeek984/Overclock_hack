import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend target. Default: local FastAPI (backend/run.sh) — currently running.
// Requests stay same-origin (Vite proxies them), so no CORS preflights.
// To use the remote ngrok backend instead:
//   API_TARGET="https://unnegotiated-apocalyptically-paulette.ngrok-free.dev" npm run dev
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:8000'

const proxyRule = {
  target: API_TARGET,
  changeOrigin: true,
  secure: true,
  headers: {
    'ngrok-skip-browser-warning': '69420',
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': proxyRule,
      '/analyze': proxyRule,
    },
  },
  preview: {
    proxy: {
      '/api': proxyRule,
      '/analyze': proxyRule,
    },
  },
})
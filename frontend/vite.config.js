import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend target. Default: деплой-бэкенд через ngrok-туннель.
// Запросы остаются same-origin (Vite их проксирует), поэтому:
//  - DNS ngrok-хоста резолвится в Node (надёжнее, чем устный браузерный DNS);
//  - заголовок ngrok-skip-browser-warning добавляется на стороне прокси;
//  - нет CORS-префлайтов.
// Чтобы использовать локальный бэкенд вместо ngrok:
//   API_TARGET="http://127.0.0.1:8000" npm run dev
// Чтобы вызывать бэкенд напрямую из браузера (кросс-доменно):
//   VITE_API_URL="https://unnegotiated-apocalyptically-paulette.ngrok-free.dev" npm run dev
const API_TARGET = process.env.API_TARGET || 'https://unnegotiated-apocalyptically-paulette.ngrok-free.dev'

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
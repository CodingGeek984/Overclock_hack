# FraudSeeker - Frontend

React-приложение - дашборд антифрод-системы: мониторинг транзакций, аналитика модели и XAI-симулятор. Стек: **React 19 + Vite 8 + Tailwind CSS 3**, иконки - Lucide, графики - Recharts, карта - Leaflet.

## Быстрый старт

```bash
npm install
npm run dev       # http://localhost:5173
```

## Вкладки

- **Dashboard** - KPI-карточки, trade-off кривая, веса модели, лента транзакций, создание транзакции.
  - **Analytics** - метрики модели: KPI, конфигурация, optimal threshold, trade-off анализ.
  - **Simulator** - ручная проверка транзакции с объяснением решения (SHAP-факторы, лог, экспорт отчетов).

Языки интерфейса: RU/EN (переключатель в шапке, выбор сохраняется в localStorage).

## Структура

```
src/
├── components/     # UI-кит (Button, Card, Modal...), layout, графики (charts/)
├── context/        # Языковой контекст (RU/EN/KZ)
├── features/       # Один каталог на вкладку: dashboard/, analytics/, simulator/
├── services/       # API-слой (api.js, transactionsApi.js, fraudApi.js, mockData.js)
└── utils/          # Форматтеры, переводы, XAI-объяснения, цвета риска
```

## Подключение к бэкенду

Запросы идут через Vite-proxy (same-origin, без CORS). Целевой адрес — в `vite.config.js`:

```bash
# Локальный FastAPI-бэкенд
API_TARGET="http://127.0.0.1:8080" npm run dev

# Или напрямую в браузере
VITE_API_URL="https://your-host/api" npm run dev
```

По умолчанию цель — деплой-бэкенд через ngrok (заголовок `ngrok-skip-browser-warning` добавляет прокси). Если бэкенд недоступен или эндпоинт вернул 404 — приложение молча работает на mock-данных.

## Команды

```bash
npm run dev       # dev-сервер
npm run build     # продакшен-сборка
npm run preview   # превью сборки (тоже с прокси)
npm run lint      # oxlint
```
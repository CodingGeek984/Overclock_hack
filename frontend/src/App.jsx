import { Suspense, lazy, useCallback, useState } from 'react'
import Layout from './components/layout/Layout.jsx'
import Spinner from './components/ui/Spinner.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard.jsx'))
const AnalyticsView = lazy(() => import('./features/analytics/AnalyticsView.jsx'))
const Simulator = lazy(() => import('./features/simulator/Simulator.jsx'))

const VIEWS = {
  dashboard: Dashboard,
  analytics: AnalyticsView,
  simulator: Simulator,
}

const TAB_STORAGE_KEY = 'app_tab'

function readInitialTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    return saved && VIEWS[saved] ? saved : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function Fallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size={26} label="Загрузка модуля..." />
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState(readInitialTab)

  const handleTabChange = useCallback((tab) => {
    if (!VIEWS[tab]) return
    setActiveTab(tab)
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const ActiveView = VIEWS[activeTab] ?? Dashboard

  return (
    <LanguageProvider>
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        <Suspense fallback={<Fallback />}>
          <ActiveView />
        </Suspense>
      </Layout>
    </LanguageProvider>
  )
}

export default App
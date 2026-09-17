import { Suspense, lazy, useState } from 'react'
import Layout from './components/layout/Layout'
import Spinner from './components/ui/Spinner'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const Simulator = lazy(() => import('./features/simulator/Simulator'))
const BatchView = lazy(() => import('./features/batch/BatchView'))
const CasesView = lazy(() => import('./features/cases/CasesView'))

const VIEWS = {
  dashboard: Dashboard,
  simulator: Simulator,
  batch: BatchView,
  cases: CasesView,
}

function Fallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size={26} label="Загрузка модуля..." />
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [lang, setLang] = useState('RU')

  const ActiveView = VIEWS[activeTab] ?? Dashboard

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      lang={lang}
      onLangChange={setLang}
    >
      <Suspense fallback={<Fallback />}>
        <ActiveView />
      </Suspense>
    </Layout>
  )
}

export default App
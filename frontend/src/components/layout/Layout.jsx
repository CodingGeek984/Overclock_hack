import Header from './Header.jsx'

export default function Layout({ activeTab, onTabChange, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header activeTab={activeTab} onTabChange={onTabChange} />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-24">
        <div key={activeTab} className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
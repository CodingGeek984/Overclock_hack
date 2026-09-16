import Header from './Header'

export default function Layout({ activeTab, onTabChange, lang = 'RU', onLangChange, children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        activeTab={activeTab}
        onTabChange={onTabChange}
        lang={lang}
        onLangChange={onLangChange}
      />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 py-6 pb-16">
        <div key={activeTab} className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
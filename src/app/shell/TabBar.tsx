import { useAppStore } from '../store.ts'

function hrefForSite(site: 'home' | 'shop' | 'booking'): string {
  return site === 'home' ? '#/' : `#/${site}`
}

export function TabBar() {
  const tabs = useAppStore((state) => state.tabs)
  const activeTabId = useAppStore((state) => state.activeTabId)
  const activateTab = useAppStore((state) => state.activateTab)
  const createTab = useAppStore((state) => state.createTab)
  const closeTab = useAppStore((state) => state.closeTab)

  return (
    <div className="flex h-9 items-center gap-1 border-b border-[#d7e0e6] bg-[#f0f4f6] px-4" aria-label="Browser tabs">
      {tabs.map((tab, index) => (
        <a
          key={tab.id}
          href={hrefForSite(tab.site)}
          aria-current={tab.id === activeTabId ? 'page' : undefined}
          className={`max-w-40 truncate rounded-t px-3 py-1 text-xs ${tab.id === activeTabId ? 'bg-white font-bold text-[#17324f]' : 'text-[#718096] hover:bg-white/70'}`}
          onClick={() => activateTab(tab.id)}
        >
          {index + 1}. {tab.site === 'booking' ? 'Appointments' : tab.site === 'shop' ? 'Shop' : 'Home'}
        </a>
      ))}
      <button
        type="button"
        className="grid size-7 place-items-center rounded text-sm font-bold text-[#17324f] hover:bg-white"
        aria-label="New tab"
        title="New tab"
        onClick={() => {
          const tab = createTab()
          window.location.hash = hrefForSite(tab.site)
        }}
      >
        +
      </button>
      <button
        type="button"
        className="ml-auto rounded px-2 py-1 text-xs text-[#718096] hover:bg-white"
        aria-label="Close current tab"
        title="Close current tab"
        onClick={() => {
          const tab = closeTab()
          window.location.hash = hrefForSite(tab.site)
        }}
      >
        ×
      </button>
    </div>
  )
}
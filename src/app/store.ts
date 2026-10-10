import { create } from 'zustand'
import type { BrowserSite } from '../core/events.ts'

export type BrowserTab = {
  id: number
  site: BrowserSite
}

type AppState = {
  paused: boolean
  tabs: BrowserTab[]
  activeTabId: number
  nextTabId: number
  setPaused: (paused: boolean) => void
  syncTabSite: (site: BrowserSite) => void
  createTab: () => BrowserTab
  nextTab: () => BrowserTab
  closeTab: () => BrowserTab
  activateTab: (id: number) => BrowserTab | null
}

export const useAppStore = create<AppState>((set, get) => ({
  paused: false,
  tabs: [{ id: 1, site: 'home' }],
  activeTabId: 1,
  nextTabId: 2,
  setPaused: (paused) => set({ paused }),
  syncTabSite: (site) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === state.activeTabId ? { ...tab, site } : tab),
  })),
  createTab: () => {
    const tab = { id: get().nextTabId, site: 'home' as const }
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      nextTabId: tab.id + 1,
    }))
    return tab
  },
  nextTab: () => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((tab) => tab.id === activeTabId)
    const tab = tabs[(index + 1) % tabs.length]
    set({ activeTabId: tab.id })
    return tab
  },
  closeTab: () => {
    const { tabs, activeTabId } = get()
    if (tabs.length === 1) return get().createTab()
    const index = tabs.findIndex((tab) => tab.id === activeTabId)
    const remaining = tabs.filter((tab) => tab.id !== activeTabId)
    const tab = remaining[Math.max(0, index - 1)]
    set({ tabs: remaining, activeTabId: tab.id })
    return tab
  },
  activateTab: (id) => {
    const tab = get().tabs.find((item) => item.id === id)
    if (!tab) return null
    set({ activeTabId: id })
    return tab
  },
}))

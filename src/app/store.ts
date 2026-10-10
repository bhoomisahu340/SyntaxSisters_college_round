import { create } from 'zustand'

type AppState = {
  paused: boolean
  setPaused: (paused: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  paused: false,
  setPaused: (paused) => set({ paused }),
}))

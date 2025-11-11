import { create } from 'zustand'

interface LevelFilterState {
  maxDisplayLevel: number
  setMaxDisplayLevel: (level: number) => void
  resetFilter: () => void
}

export const useLevelFilter = create<LevelFilterState>((set) => ({
  maxDisplayLevel: 0, // 0 means show all levels
  setMaxDisplayLevel: (level: number) => set({ maxDisplayLevel: level }),
  resetFilter: () => set({ maxDisplayLevel: 0 }),
}))

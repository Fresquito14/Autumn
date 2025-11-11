import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type ViewMode = 'plan' | 'actual'

interface ViewModeState {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
}

export const useViewMode = create<ViewModeState>()(
  devtools(
    (set, get) => ({
      viewMode: 'plan',

      setViewMode: (mode) => {
        set({ viewMode: mode })
      },

      toggleViewMode: () => {
        const currentMode = get().viewMode
        set({ viewMode: currentMode === 'plan' ? 'actual' : 'plan' })
      },
    }),
    { name: 'ViewModeStore' }
  )
)

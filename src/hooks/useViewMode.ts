import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type ViewMode = 'plan' | 'actual'
export type ZoomLevel = 'day' | 'week' | 'month'

interface ViewModeState {
  viewMode: ViewMode
  zoomLevel: ZoomLevel
  setViewMode: (mode: ViewMode) => void
  setZoomLevel: (level: ZoomLevel) => void
  toggleViewMode: () => void
}

export const useViewMode = create<ViewModeState>()(
  devtools(
    (set, get) => ({
      viewMode: 'plan',
      zoomLevel: 'week',

      setViewMode: (mode) => {
        set({ viewMode: mode })
      },

      setZoomLevel: (level) => {
        set({ zoomLevel: level })
      },

      toggleViewMode: () => {
        const currentMode = get().viewMode
        set({ viewMode: currentMode === 'plan' ? 'actual' : 'plan' })
      },
    }),
    { name: 'ViewModeStore' }
  )
)

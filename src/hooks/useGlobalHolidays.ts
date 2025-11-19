import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { GlobalHoliday } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface GlobalHolidayState {
  holidays: GlobalHoliday[]
  isLoading: boolean
  error: string | null

  // Actions
  loadAllHolidays: () => Promise<void>
  createHoliday: (holiday: Omit<GlobalHoliday, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateHoliday: (id: string, changes: Partial<GlobalHoliday>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
  clearHolidays: () => void
}

export const useGlobalHolidays = create<GlobalHolidayState>()(
  devtools(
    (set, get) => ({
      holidays: [],
      isLoading: false,
      error: null,

      loadAllHolidays: async () => {
        set({ isLoading: true, error: null })
        try {
          const holidays = await dbHelpers.getAllGlobalHolidays()
          set({ holidays, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      createHoliday: async (holidayData) => {
        set({ isLoading: true, error: null })
        try {
          const now = new Date()
          const holiday: GlobalHoliday = {
            ...holidayData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }

          await dbHelpers.createGlobalHoliday(holiday)

          // Reload holidays
          const holidays = await dbHelpers.getAllGlobalHolidays()
          set({ holidays, isLoading: false })

          return holiday.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateHoliday: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateGlobalHoliday(id, changes)

          // Reload holidays
          const holidays = await dbHelpers.getAllGlobalHolidays()
          set({ holidays, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteHoliday: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.deleteGlobalHoliday(id)

          // Reload holidays
          const holidays = await dbHelpers.getAllGlobalHolidays()
          set({ holidays, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearHolidays: () => {
        set({ holidays: [], error: null })
      },
    }),
    { name: 'GlobalHolidayStore' }
  )
)

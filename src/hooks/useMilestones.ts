import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Milestone } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface MilestoneState {
  milestones: Milestone[]
  isLoading: boolean
  error: string | null

  // Actions
  loadMilestones: (projectId: string) => Promise<void>
  getMilestone: (id: string) => Milestone | undefined
  createMilestone: (milestone: Omit<Milestone, 'id'>) => Promise<Milestone>
  updateMilestone: (id: string, changes: Partial<Milestone>) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>
  clearMilestones: () => void
}

export const useMilestones = create<MilestoneState>()(
  devtools(
    (set, get) => ({
      milestones: [],
      isLoading: false,
      error: null,

      loadMilestones: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          const milestones = await dbHelpers.getProjectMilestones(projectId)
          // Sort by date
          milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
          set({ milestones, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getMilestone: (id: string) => {
        return get().milestones.find(milestone => milestone.id === id)
      },

      createMilestone: async (milestoneData) => {
        set({ isLoading: true, error: null })
        try {
          const milestone: Milestone = {
            ...milestoneData,
            id: crypto.randomUUID(),
          }

          await dbHelpers.createMilestone(milestone)

          const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
          milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
          set({ milestones, isLoading: false })

          return milestone
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateMilestone: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateMilestone(id, changes)

          const milestone = get().milestones.find(m => m.id === id)
          if (milestone) {
            const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
            milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
            set({ milestones, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteMilestone: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const milestone = get().milestones.find(m => m.id === id)
          if (!milestone) {
            set({ isLoading: false })
            return
          }

          await dbHelpers.deleteMilestone(id)

          const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
          milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
          set({ milestones, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearMilestones: () => {
        set({ milestones: [], error: null })
      },
    }),
    { name: 'MilestoneStore' }
  )
)

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Milestone } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { supabase } from '@/lib/supabase/client'

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
        set({ error: null })
        try {
          const milestone: Milestone = {
            ...milestoneData,
            id: crypto.randomUUID(),
          }

          await dbHelpers.createMilestone(milestone)

          const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
          milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
          set({ milestones })

          return milestone
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      updateMilestone: async (id, changes) => {
        set({ error: null })
        try {
          await dbHelpers.updateMilestone(id, changes)

          const milestone = get().milestones.find(m => m.id === id)
          if (milestone) {
            const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
            milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
            set({ milestones })
          }
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      deleteMilestone: async (id) => {
        set({ error: null })
        try {
          const milestone = get().milestones.find(m => m.id === id)
          if (!milestone) return

          await dbHelpers.deleteMilestone(id)

          try {
            await supabase.from('milestones').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete milestone skipped:', cloudErr)
          }

          const milestones = await dbHelpers.getProjectMilestones(milestone.projectId)
          milestones.sort((a, b) => a.date.getTime() - b.date.getTime())
          set({ milestones })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      clearMilestones: () => {
        set({ milestones: [], error: null })
      },
    }),
    { name: 'MilestoneStore' }
  )
)

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Resource } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface ResourceState {
  resources: Resource[]
  isLoading: boolean
  error: string | null

  // Actions
  loadResources: (projectId: string) => Promise<void>
  getResource: (id: string) => Resource | undefined
  createResource: (resource: Omit<Resource, 'id'>) => Promise<string>
  updateResource: (id: string, changes: Partial<Resource>) => Promise<void>
  deleteResource: (id: string) => Promise<void>
  clearResources: () => void
}

export const useResources = create<ResourceState>()(
  devtools(
    (set, get) => ({
      resources: [],
      isLoading: false,
      error: null,

      loadResources: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          const resources = await dbHelpers.getProjectResources(projectId)
          set({ resources, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getResource: (id: string) => {
        return get().resources.find(resource => resource.id === id)
      },

      createResource: async (resourceData) => {
        set({ isLoading: true, error: null })
        try {
          const resource: Resource = {
            ...resourceData,
            id: crypto.randomUUID(),
            maxHoursPerWeek: resourceData.maxHoursPerWeek || 40,
            calendar: resourceData.calendar || { vacations: [] },
          }

          await dbHelpers.createResource(resource)

          const resources = await dbHelpers.getProjectResources(resource.projectId)
          set({ resources, isLoading: false })

          return resource.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateResource: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateResource(id, changes)

          const resource = get().resources.find(r => r.id === id)
          if (resource) {
            const resources = await dbHelpers.getProjectResources(resource.projectId)
            set({ resources, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteResource: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const resource = get().resources.find(r => r.id === id)
          if (!resource) {
            set({ isLoading: false })
            return
          }

          await dbHelpers.deleteResource(id)

          const resources = await dbHelpers.getProjectResources(resource.projectId)
          set({ resources, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearResources: () => {
        set({ resources: [], error: null })
      },
    }),
    { name: 'ResourceStore' }
  )
)

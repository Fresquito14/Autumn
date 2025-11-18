import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Resource } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface ResourceState {
  resources: Resource[]
  isLoading: boolean
  error: string | null

  // Actions
  loadAllResources: () => Promise<void> // Global resources - no projectId needed
  loadProjectResources: (projectId: string) => Promise<Resource[]> // Get resources assigned to a specific project
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

      loadAllResources: async () => {
        set({ isLoading: true, error: null })
        try {
          const resources = await dbHelpers.getAllResources()
          set({ resources, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      loadProjectResources: async (projectId: string) => {
        try {
          return await dbHelpers.getProjectResources(projectId)
        } catch (error) {
          console.error('Failed to load project resources:', error)
          return []
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
            tags: resourceData.tags || [],
            maxHoursPerWeek: resourceData.maxHoursPerWeek || 40,
            calendar: resourceData.calendar || { vacations: [] },
          }

          await dbHelpers.createResource(resource)

          // Reload all global resources
          const resources = await dbHelpers.getAllResources()
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

          // Reload all global resources
          const resources = await dbHelpers.getAllResources()
          set({ resources, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteResource: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.deleteResource(id)

          // Reload all global resources
          const resources = await dbHelpers.getAllResources()
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

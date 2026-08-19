import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Resource } from '@/types'
import { db, dbHelpers } from '@/lib/storage/db'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import { supabase } from '@/lib/supabase/client'


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
  deleteResources: (ids: string[]) => Promise<void>
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
          const localResources = await dbHelpers.getAllResources()
          set({ resources: localResources, isLoading: false })

          try {
            await supabaseSyncService.fetchResourcesFromCloud()
            const updatedResources = await dbHelpers.getAllResources()
            set({ resources: updatedResources })
          } catch (cloudErr) {
            console.warn('Could not sync resources from Supabase:', cloudErr)
          }
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

          // Sync resources to Supabase cloud
          try {
            await supabaseSyncService.syncResourcesToCloud(resources)
          } catch (cloudErr) {
            console.warn('Cloud sync of resources skipped:', cloudErr)
          }

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

          // Sync resources to Supabase cloud
          try {
            await supabaseSyncService.syncResourcesToCloud(resources)
          } catch (cloudErr) {
            console.warn('Cloud sync of resources skipped:', cloudErr)
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },


      deleteResource: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.deleteResource(id)

          try {
            await supabase.from('resources').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete resource skipped:', cloudErr)
          }

          // Reload all global resources
          const resources = await dbHelpers.getAllResources()
          set({ resources, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteResources: async (ids) => {
        set({ isLoading: true, error: null })
        try {
          await db.transaction('rw', [db.resources, db.taskResourceAssignments], async () => {
            // Delete all assignments for these resources
            await db.taskResourceAssignments.where('resourceId').anyOf(ids).delete()
            // Delete the resources
            await db.resources.where('id').anyOf(ids).delete()
          })

          try {
            await supabase.from('resources').delete().in('id', ids)
          } catch (cloudErr) {
            console.warn('Cloud delete resources skipped:', cloudErr)
          }

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

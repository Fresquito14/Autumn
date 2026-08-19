import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Project } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import { supabase } from '@/lib/supabase/client'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useMilestones } from './useMilestones'

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  isLoading: boolean
  error: string | null

  // Actions
  loadProjects: () => Promise<void>
  loadProject: (id: string) => Promise<void>
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateProject: (id: string, changes: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  transferProjectOwnership: (projectId: string, newOwnerId: string) => Promise<void>
  setCurrentProject: (project: Project | null) => void
}

export const useProject = create<ProjectState>()(
  devtools(
    (set, get) => ({
      currentProject: null,
      projects: [],
      isLoading: false,
      error: null,

      loadProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          // 1. Load local projects first for fast UI rendering
          const localProjects = await dbHelpers.getAllProjects()
          set({ projects: localProjects, isLoading: false })

          // 2. Sync project list from Supabase cloud in background
          try {
            await supabaseSyncService.fetchAllProjectsFromCloud()
            const updatedProjects = await dbHelpers.getAllProjects()
            set({ projects: updatedProjects })
          } catch (cloudErr) {
            // Silently ignore if offline or unauthenticated
            console.warn('Could not sync project list from Supabase:', cloudErr)
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      loadProject: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          const project = await dbHelpers.getProject(id)
          set({ currentProject: project || null, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      createProject: async (projectData) => {
        set({ isLoading: true, error: null })
        try {
          const now = new Date()
          const project: Project = {
            ...projectData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }

          await dbHelpers.createProject(project)

          const projects = await dbHelpers.getAllProjects()
          set({ projects, currentProject: project, isLoading: false })

          return project.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateProject: async (id, changes) => {
        set({ error: null })
        try {
          await dbHelpers.updateProject(id, changes)

          const projects = await dbHelpers.getAllProjects()
          const currentProject = get().currentProject

          if (currentProject?.id === id) {
            const updated = await dbHelpers.getProject(id)
            set({ projects, currentProject: updated || null })
          } else {
            set({ projects })
          }
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      deleteProject: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.deleteProject(id)

          try {
            await supabase.from('projects').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete project skipped:', cloudErr)
          }

          const projects = await dbHelpers.getAllProjects()
          const currentProject = get().currentProject
          const isCurrentProject = currentProject?.id === id

          if (isCurrentProject) {
            useTasks.getState().clearTasks()
            useDependencies.getState().clearDependencies()
            useMilestones.getState().clearMilestones()
          }

          set({
            projects,
            currentProject: isCurrentProject ? null : currentProject,
            isLoading: false,
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      transferProjectOwnership: async (projectId: string, newOwnerId: string) => {
        set({ isLoading: true, error: null })
        try {
          // 1. Call RPC in Supabase
          const { error: rpcErr } = await supabase.rpc('transfer_project_ownership', {
            p_project_id: projectId,
            p_new_owner_id: newOwnerId,
          })

          if (rpcErr) throw rpcErr

          // 2. Update local Dexie project
          await dbHelpers.updateProject(projectId, { userId: newOwnerId })

          // 3. Reload projects and update state
          const projects = await dbHelpers.getAllProjects()
          const current = get().currentProject
          if (current?.id === projectId) {
            set({
              projects,
              currentProject: { ...current, userId: newOwnerId },
              isLoading: false,
            })
          } else {
            set({ projects, isLoading: false })
          }
        } catch (error) {
          console.error('Error transferring project:', error)
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      setCurrentProject: (project) => {
        set({ currentProject: project })
      },
    }),
    { name: 'ProjectStore' }
  )
)

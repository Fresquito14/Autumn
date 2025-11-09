import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Project } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

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
          const projects = await dbHelpers.getAllProjects()
          set({ projects, isLoading: false })
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
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateProject(id, changes)

          const projects = await dbHelpers.getAllProjects()
          const currentProject = get().currentProject

          if (currentProject?.id === id) {
            const updated = await dbHelpers.getProject(id)
            set({ projects, currentProject: updated || null, isLoading: false })
          } else {
            set({ projects, isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteProject: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.deleteProject(id)

          const projects = await dbHelpers.getAllProjects()
          const currentProject = get().currentProject

          set({
            projects,
            currentProject: currentProject?.id === id ? null : currentProject,
            isLoading: false,
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      setCurrentProject: (project) => {
        set({ currentProject: project })
      },
    }),
    { name: 'ProjectStore' }
  )
)

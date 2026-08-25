import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Project } from '@/types'
import { db, dbHelpers } from '@/lib/storage/db'
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
          const { data: authData } = await supabase.auth.getUser()
          const currentUser = authData?.user

          if (currentUser) {
            // Logged in user: Supabase cloud is the single source of truth
            const { data: cloudProjects, error: pErr } = await supabase
              .from('projects')
              .select('*')
              .order('updated_at', { ascending: false })

            if (!pErr && cloudProjects) {
              const mappedProjects: Project[] = cloudProjects.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || undefined,
                startDate: new Date(p.start_date),
                endDate: p.end_date ? new Date(p.end_date) : undefined,
                createdAt: new Date(p.created_at),
                updatedAt: new Date(p.updated_at),
                baselineId: p.baseline_id || undefined,
                version: p.version,
                userId: p.user_id || undefined,
                organizationId: p.organization_id || undefined,
                config: {
                  workingDays: p.working_days || [1, 2, 3, 4, 5],
                  hoursPerDay: Number(p.hours_per_day || 8),
                  useGlobalHolidays: p.use_global_holidays ?? true,
                  excludedGlobalHolidayIds: [],
                  projectSpecificHolidays: [],
                  skipHolidaysInScheduling: p.skip_holidays_in_scheduling ?? true,
                  defaultDuration: Number(p.default_duration || 5),
                },
              }))

              // Cache exclusively these cloud projects into local IndexedDB
              await db.transaction('rw', [db.projects], async () => {
                for (const cp of mappedProjects) {
                  await db.projects.put(cp)
                }
              })

              set({ projects: mappedProjects, isLoading: false })
              return
            }
          }

          // Guest / Free local mode: Load from local IndexedDB
          const localProjects = await dbHelpers.getAllProjects()
          set({ projects: localProjects, isLoading: false })
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
          const { data: authData } = await supabase.auth.getUser()
          const currentUser = authData?.user

          const now = new Date()
          const projectId = crypto.randomUUID()
          const project: Project = {
            ...projectData,
            id: projectId,
            userId: currentUser?.id,
            createdAt: now,
            updatedAt: now,
          }

          // 1. Save locally in Dexie
          await dbHelpers.createProject(project)

          // 2. If authenticated, insert into Supabase
          if (currentUser) {
            try {
              await supabase.from('projects').insert({
                id: projectId,
                user_id: currentUser.id,
                name: project.name,
                description: project.description || null,
                start_date: project.startDate.toISOString(),
                end_date: project.endDate ? project.endDate.toISOString() : null,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                version: 1,
                working_days: project.config.workingDays,
                hours_per_day: project.config.hoursPerDay,
                use_global_holidays: project.config.useGlobalHolidays,
                skip_holidays_in_scheduling: project.config.skipHolidaysInScheduling,
                default_duration: project.config.defaultDuration,
              })
            } catch (cloudErr) {
              console.warn('Failed to insert project into Supabase:', cloudErr)
            }
          }

          const currentProjects = get().projects
          set({
            projects: [project, ...currentProjects],
            currentProject: project,
            isLoading: false,
          })

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

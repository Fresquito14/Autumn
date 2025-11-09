import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTasks: (projectId: string) => Promise<void>
  getTask: (id: string) => Task | undefined
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateTask: (id: string, changes: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  clearTasks: () => void
}

export const useTasks = create<TaskState>()(
  devtools(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,

      loadTasks: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          const tasks = await dbHelpers.getProjectTasks(projectId)
          // Sort by WBS code for hierarchical display
          tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getTask: (id: string) => {
        return get().tasks.find(task => task.id === id)
      },

      createTask: async (taskData) => {
        set({ isLoading: true, error: null })
        try {
          const now = new Date()
          const task: Task = {
            ...taskData,
            id: crypto.randomUUID(),
            checklist: taskData.checklist || [],
            assignedTo: taskData.assignedTo || [],
            createdAt: now,
            updatedAt: now,
          }

          await dbHelpers.createTask(task)

          const tasks = await dbHelpers.getProjectTasks(task.projectId)
          tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks, isLoading: false })

          return task.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateTask: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateTask(id, changes)

          const task = get().tasks.find(t => t.id === id)
          if (task) {
            const tasks = await dbHelpers.getProjectTasks(task.projectId)
            tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
            set({ tasks, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteTask: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const task = get().tasks.find(t => t.id === id)
          if (!task) {
            set({ isLoading: false })
            return
          }

          await dbHelpers.deleteTask(id)

          const tasks = await dbHelpers.getProjectTasks(task.projectId)
          tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearTasks: () => {
        set({ tasks: [], error: null })
      },
    }),
    { name: 'TaskStore' }
  )
)

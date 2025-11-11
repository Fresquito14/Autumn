import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, Dependency } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { recalculateTaskDates, calculateBusinessDays } from '@/lib/calculations/dates'

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTasks: (projectId: string) => Promise<void>
  getTask: (id: string) => Task | undefined
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>
  updateTask: (id: string, changes: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  clearTasks: () => void
  recalculateDatesFromDependencies: (dependencies: Dependency[], workingDays: number[]) => Promise<void>
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

          return task
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateTask: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          // First, update the task itself
          await dbHelpers.updateTask(id, changes)

          const task = get().tasks.find(t => t.id === id)
          if (!task) {
            set({ isLoading: false })
            return
          }

          // If this task has a parent, immediately update the parent's dates
          // to encompass all children BEFORE auto-recalculate triggers
          if (task.parentId) {
            // Get all current tasks from DB to have the latest data
            let allTasks = await dbHelpers.getProjectTasks(task.projectId)

            // Get working days from project config (default Monday-Friday)
            // TODO: Get actual working days from project config
            const workingDays = [1, 2, 3, 4, 5]

            // Recursively update parent hierarchy (bottom-up)
            let currentParentId: string | null = task.parentId
            while (currentParentId) {
              // Find all children of the current parent
              const children = allTasks.filter(t => t.parentId === currentParentId)

              if (children.length > 0) {
                // Calculate parent's new dates based on all its children
                const childStartDates = children.map(t => new Date(t.startDate))
                const childEndDates = children.map(t => new Date(t.endDate))

                const minStartDate = new Date(Math.min(...childStartDates.map(d => d.getTime())))
                const maxEndDate = new Date(Math.max(...childEndDates.map(d => d.getTime())))
                const newDuration = calculateBusinessDays(minStartDate, maxEndDate, workingDays)

                // Update parent task
                await dbHelpers.updateTask(currentParentId, {
                  startDate: minStartDate,
                  endDate: maxEndDate,
                  duration: newDuration
                })

                console.log(`📦 Parent task ${currentParentId} updated: ${minStartDate.toLocaleDateString()} - ${maxEndDate.toLocaleDateString()} (${newDuration} days)`)

                // Update the task in our local array for next iteration
                const parentIndex = allTasks.findIndex(t => t.id === currentParentId)
                if (parentIndex !== -1) {
                  allTasks[parentIndex] = {
                    ...allTasks[parentIndex],
                    startDate: minStartDate,
                    endDate: maxEndDate,
                    duration: newDuration
                  }

                  // Move up to the next level (parent's parent)
                  currentParentId = allTasks[parentIndex].parentId
                } else {
                  break
                }
              } else {
                break
              }
            }
          }

          // Reload all tasks with updated data
          const tasks = await dbHelpers.getProjectTasks(task.projectId)
          tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks, isLoading: false })
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

      recalculateDatesFromDependencies: async (dependencies, workingDays) => {
        const tasks = get().tasks
        if (tasks.length === 0) return

        console.log('🔄 Recalculando fechas desde store de tareas...')

        // Recalculate task dates
        const updatedTasks = recalculateTaskDates(tasks, dependencies, workingDays)

        // Update tasks in database that have changed dates
        const updates: Promise<void>[] = []

        updatedTasks.forEach(updatedTask => {
          const originalTask = tasks.find(t => t.id === updatedTask.id)
          if (!originalTask) return

          const startChanged = originalTask.startDate.getTime() !== updatedTask.startDate.getTime()
          const endChanged = originalTask.endDate.getTime() !== updatedTask.endDate.getTime()
          const durationChanged = originalTask.duration !== updatedTask.duration

          // Check if this task has children (is a parent task)
          const hasChildren = tasks.some(t => t.parentId === updatedTask.id)

          if (startChanged || endChanged || (durationChanged && hasChildren)) {
            // Only update duration if task is a parent
            // Leaf tasks keep their user-defined duration
            const updateData: { startDate: Date; endDate: Date; duration?: number } = {
              startDate: updatedTask.startDate,
              endDate: updatedTask.endDate,
            }

            if (hasChildren) {
              updateData.duration = updatedTask.duration
            }

            updates.push(dbHelpers.updateTask(updatedTask.id, updateData))
          }
        })

        if (updates.length > 0) {
          console.log(`📅 Actualizando ${updates.length} tareas en DB...`)
          await Promise.all(updates)

          // Update local state with new tasks
          updatedTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks: updatedTasks })

          console.log('✅ Fechas recalculadas y guardadas')
        } else {
          console.log('ℹ️  No hay cambios de fechas')
        }
      },
    }),
    { name: 'TaskStore' }
  )
)

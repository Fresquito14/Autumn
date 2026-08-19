import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, Dependency } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { recalculateTaskDates, calculateBusinessDays } from '@/lib/calculations/dates'
import { recalculateLinkedMilestones } from '@/lib/calculations/milestones'
import { supabase } from '@/lib/supabase/client'

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
        set({ error: null })
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
          set({ tasks })

          return task
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      updateTask: async (id, changes) => {
        set({ error: null })
        try {
          // 1. Update the task in IndexedDB
          await dbHelpers.updateTask(id, changes)

          const currentTasks = get().tasks
          const targetTask = currentTasks.find(t => t.id === id)
          if (!targetTask) return

          const projectId = targetTask.projectId
          let allTasks = await dbHelpers.getProjectTasks(projectId)
          const workingDays = [1, 2, 3, 4, 5]

          // 2. If dates or duration changed, recalculate downstream dependencies immediately
          const isDateOrDurationChange =
            changes.startDate !== undefined ||
            changes.endDate !== undefined ||
            changes.duration !== undefined

          if (isDateOrDurationChange) {
            const projectDeps = await dbHelpers.getProjectDependencies(projectId)
            if (projectDeps.length > 0) {
              const recalculated = recalculateTaskDates(allTasks, projectDeps, workingDays)
              
              // Persist any shifted downstream tasks to IndexedDB
              const downstreamUpdates: Promise<unknown>[] = []
              recalculated.forEach(recTask => {
                const orig = allTasks.find(t => t.id === recTask.id)
                if (!orig) return

                const startShift = orig.startDate.getTime() !== recTask.startDate.getTime()
                const endShift = orig.endDate.getTime() !== recTask.endDate.getTime()

                if (startShift || endShift) {
                  downstreamUpdates.push(
                    dbHelpers.updateTask(recTask.id, {
                      startDate: recTask.startDate,
                      endDate: recTask.endDate,
                    })
                  )
                }
              })

              if (downstreamUpdates.length > 0) {
                await Promise.all(downstreamUpdates)
              }
              allTasks = recalculated
            }
          }

          // 3. If task has a parent, recursively update parent dates bottom-up
          if (targetTask.parentId) {
            let currentParentId: string | null = targetTask.parentId
            while (currentParentId) {
              const children = allTasks.filter(t => t.parentId === currentParentId)

              if (children.length > 0) {
                const childStartDates = children.map(t => new Date(t.startDate))
                const childEndDates = children.map(t => new Date(t.endDate))

                const minStartDate = new Date(Math.min(...childStartDates.map(d => d.getTime())))
                const maxEndDate = new Date(Math.max(...childEndDates.map(d => d.getTime())))
                const newDuration = calculateBusinessDays(minStartDate, maxEndDate, workingDays)

                // Actual dates rollup from children
                const childrenWithActual = children.filter(t => t.actualStartDate && t.actualEndDate)
                let parentActualStart: Date | undefined = undefined
                let parentActualEnd: Date | undefined = undefined
                let parentActualDuration: number | undefined = undefined

                if (childrenWithActual.length > 0) {
                  const childActualStarts = childrenWithActual.map(t => new Date(t.actualStartDate!))
                  const childActualEnds = childrenWithActual.map(t => new Date(t.actualEndDate!))
                  parentActualStart = new Date(Math.min(...childActualStarts.map(d => d.getTime())))
                  parentActualEnd = new Date(Math.max(...childActualEnds.map(d => d.getTime())))
                  parentActualDuration = calculateBusinessDays(parentActualStart, parentActualEnd, workingDays)
                }

                await dbHelpers.updateTask(currentParentId, {
                  startDate: minStartDate,
                  endDate: maxEndDate,
                  duration: newDuration,
                  actualStartDate: parentActualStart,
                  actualEndDate: parentActualEnd,
                  actualDuration: parentActualDuration,
                })

                const parentIndex = allTasks.findIndex(t => t.id === currentParentId)
                if (parentIndex !== -1) {
                  allTasks[parentIndex] = {
                    ...allTasks[parentIndex],
                    startDate: minStartDate,
                    endDate: maxEndDate,
                    duration: newDuration,
                    actualStartDate: parentActualStart,
                    actualEndDate: parentActualEnd,
                    actualDuration: parentActualDuration,
                  }
                  currentParentId = allTasks[parentIndex].parentId || null
                } else {
                  break
                }
              } else {
                break
              }
            }
          }

          // 4. Update Zustand state atomically in one single pass
          allTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks: allTasks })

          // 5. Automatically recalculate linked milestones
          if (isDateOrDurationChange) {
            await recalculateLinkedMilestones(projectId, allTasks, workingDays)
          }
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      deleteTask: async (id) => {
        set({ error: null })
        try {
          const task = get().tasks.find(t => t.id === id)
          if (!task) return

          await dbHelpers.deleteTask(id)

          try {
            await supabase.from('tasks').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete task skipped:', cloudErr)
          }

          const tasks = await dbHelpers.getProjectTasks(task.projectId)
          tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks })

          await recalculateLinkedMilestones(task.projectId, tasks)
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      clearTasks: () => {
        set({ tasks: [], error: null })
      },

      recalculateDatesFromDependencies: async (dependencies, workingDays) => {
        const tasks = get().tasks
        if (tasks.length === 0) return

        // Recalculate task dates using Kahn's topological sort
        const updatedTasks = recalculateTaskDates(tasks, dependencies, workingDays)

        const updates: Promise<unknown>[] = []

        updatedTasks.forEach(updatedTask => {
          const originalTask = tasks.find(t => t.id === updatedTask.id)
          if (!originalTask) return

          const startChanged = originalTask.startDate.getTime() !== updatedTask.startDate.getTime()
          const endChanged = originalTask.endDate.getTime() !== updatedTask.endDate.getTime()
          const durationChanged = originalTask.duration !== updatedTask.duration
          const hasChildren = tasks.some(t => t.parentId === updatedTask.id)

          if (startChanged || endChanged || (durationChanged && hasChildren)) {
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
          await Promise.all(updates)

          updatedTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
          set({ tasks: updatedTasks })

          await recalculateLinkedMilestones(tasks[0].projectId, updatedTasks, workingDays)
        }
      },
    }),
    { name: 'TaskStore' }
  )
)

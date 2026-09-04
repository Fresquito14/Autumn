import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, Dependency } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { recalculateTaskDates, calculateBusinessDays } from '@/lib/calculations/dates'
import { recalculateLinkedMilestones } from '@/lib/calculations/milestones'
import { supabase } from '@/lib/supabase/client'
import { supabaseSyncService } from '@/infrastructure/supabase/db_service'
import {
  compareWbsCodes,
  calculateMoveSiblingUpdates,
  calculateReorderTaskUpdates,
  calculateInsertBelowUpdates,
  reindexSiblingsAndDescendants,
  getWbsLevel,
} from '@/domain/calculations/wbs'
import { useDependencies } from './useDependencies'

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTasks: (projectId: string) => Promise<void>
  getTask: (id: string) => Task | undefined
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, options?: { insertAfterTaskId?: string }) => Promise<Task>
  updateTask: (id: string, changes: Partial<Task>, recalculateDependentDates?: boolean) => Promise<void>
  deleteTask: (id: string, recalculateDependentDates?: boolean) => Promise<void>
  moveTaskSibling: (taskId: string, direction: 'up' | 'down') => Promise<void>
  reorderTask: (sourceTaskId: string, targetTaskId: string, position: 'before' | 'after') => Promise<void>
  reorderTasks: (tasks: Task[]) => Promise<void>
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
          let tasks = await dbHelpers.getProjectTasks(projectId)

          // If local tasks are empty, attempt to hydrate from Supabase for this specific project
          if (tasks.length === 0) {
            const { data: authData } = await supabase.auth.getUser()
            if (authData?.user) {
              const { data: cloudData } = await supabaseSyncService.loadProjectFromCloud(projectId)
              if (cloudData && cloudData.tasks?.length > 0) {
                await supabaseSyncService.applyCloudDataToLocal(cloudData)
                tasks = await dbHelpers.getProjectTasks(projectId)
              }
            }
          }

          tasks.sort((a, b) => (a.wbsCode || '').localeCompare(b.wbsCode || '', undefined, { numeric: true }))
          set({ tasks, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getTask: (id: string) => {
        return get().tasks.find(task => task.id === id)
      },

      createTask: async (taskData, options) => {
        set({ error: null })
        try {
          const now = new Date()
          let finalWbsCode = taskData.wbsCode
          let finalParentId = taskData.parentId
          let finalLevel = taskData.level

          if (options?.insertAfterTaskId) {
            const currentTasks = get().tasks
            const { newWbsCode, parentId, updates } = calculateInsertBelowUpdates(currentTasks, options.insertAfterTaskId)
            finalWbsCode = newWbsCode
            finalParentId = parentId
            finalLevel = getWbsLevel(finalWbsCode)

            if (updates.length > 0) {
              await dbHelpers.updateTasksBatch(
                updates.map(u => ({ id: u.taskId, changes: { wbsCode: u.newWbsCode } }))
              )
              const updatedTasksMap = new Map(updates.map(u => [u.taskId, u.newWbsCode]))
              const shiftedTasks = currentTasks.map(t =>
                updatedTasksMap.has(t.id) ? { ...t, wbsCode: updatedTasksMap.get(t.id)! } : t
              )
              set({ tasks: shiftedTasks })
            }
          }

          const task: Task = {
            ...taskData,
            wbsCode: finalWbsCode,
            parentId: finalParentId,
            level: finalLevel,
            id: crypto.randomUUID(),
            checklist: taskData.checklist || [],
            assignedTo: taskData.assignedTo || [],
            createdAt: now,
            updatedAt: now,
          }

          await dbHelpers.createTask(task)

          const tasks = await dbHelpers.getProjectTasks(task.projectId)
          tasks.sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))
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
          const targetTask = currentTasks.find(t => t.id === id) || (await dbHelpers.getTask(id))
          if (!targetTask) return

          const projectId = targetTask.projectId
          let allTasks = await dbHelpers.getProjectTasks(projectId)
          const workingDays = [1, 2, 3, 4, 5]

          // 2. If dates or duration changed, recalculate downstream dependencies immediately
          const isDateOrDurationChange =
            changes.startDate !== undefined ||
            changes.endDate !== undefined ||
            changes.duration !== undefined ||
            changes.actualStartDate !== undefined ||
            changes.actualEndDate !== undefined ||
            changes.actualDuration !== undefined

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

                // Actual dates rollup from children using effective actual dates
                const childActualStarts = children.map(t => new Date(t.actualStartDate || t.startDate))
                const childActualEnds = children.map(t => new Date(t.actualEndDate || t.endDate))
                const parentActualStart = new Date(Math.min(...childActualStarts.map(d => d.getTime())))
                const parentActualEnd = new Date(Math.max(...childActualEnds.map(d => d.getTime())))
                const parentActualDuration = calculateBusinessDays(parentActualStart, parentActualEnd, workingDays)

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

          let tasks = await dbHelpers.getProjectTasks(task.projectId)

          // Re-index remaining siblings to eliminate numbering gaps
          const remainingSiblings = tasks
            .filter(t => t.parentId === task.parentId)
            .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

          if (remainingSiblings.length > 0) {
            const parentTask = task.parentId ? tasks.find(t => t.id === task.parentId) : undefined
            const siblingUpdates = reindexSiblingsAndDescendants(tasks, remainingSiblings, parentTask?.wbsCode)
            if (siblingUpdates.length > 0) {
              await dbHelpers.updateTasksBatch(
                siblingUpdates.map(u => ({ id: u.taskId, changes: { wbsCode: u.newWbsCode } }))
              )
              const updateMap = new Map(siblingUpdates.map(u => [u.taskId, u.newWbsCode]))
              tasks = tasks.map(t => (updateMap.has(t.id) ? { ...t, wbsCode: updateMap.get(t.id)! } : t))
            }
          }

          tasks.sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))
          set({ tasks })

          // Synchronize useDependencies store so deleted task dependencies are purged from memory
          await useDependencies.getState().loadDependencies(task.projectId)

          await recalculateLinkedMilestones(task.projectId, tasks)
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      moveTaskSibling: async (taskId: string, direction: 'up' | 'down') => {
        set({ error: null })
        try {
          const currentTasks = get().tasks
          const updates = calculateMoveSiblingUpdates(currentTasks, taskId, direction)
          if (updates.length === 0) return

          await dbHelpers.updateTasksBatch(
            updates.map(u => ({ id: u.taskId, changes: { wbsCode: u.newWbsCode } }))
          )

          const updateMap = new Map(updates.map(u => [u.taskId, u.newWbsCode]))
          const updatedTasks = currentTasks
            .map(t => (updateMap.has(t.id) ? { ...t, wbsCode: updateMap.get(t.id)! } : t))
            .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

          set({ tasks: updatedTasks })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      reorderTask: async (sourceTaskId: string, targetTaskId: string, position: 'before' | 'after') => {
        set({ error: null })
        try {
          const currentTasks = get().tasks
          const updates = calculateReorderTaskUpdates(currentTasks, sourceTaskId, targetTaskId, position)
          if (updates.length === 0) return

          const targetTask = currentTasks.find(t => t.id === targetTaskId)
          const sourceTask = currentTasks.find(t => t.id === sourceTaskId)

          const dbBatchUpdates = updates.map(u => {
            const isSource = u.taskId === sourceTaskId
            const changes: Partial<Task> = { wbsCode: u.newWbsCode }
            if (isSource && targetTask && sourceTask && sourceTask.parentId !== targetTask.parentId) {
              changes.parentId = targetTask.parentId
              changes.level = getWbsLevel(u.newWbsCode)
            }
            return { id: u.taskId, changes }
          })

          await dbHelpers.updateTasksBatch(dbBatchUpdates)

          const batchMap = new Map(dbBatchUpdates.map(u => [u.id, u.changes]))
          const updatedTasks = currentTasks
            .map(t => {
              const changes = batchMap.get(t.id)
              return changes ? { ...t, ...changes } : t
            })
            .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

          set({ tasks: updatedTasks })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      reorderTasks: async (newTasks: Task[]) => {
        set({ error: null })
        try {
          const updates = newTasks.map((t, idx) => ({
            id: t.id,
            changes: { wbsCode: String(idx + 1) }
          }))
          await dbHelpers.updateTasksBatch(updates)
          const updated = newTasks.map((t, idx) => ({ ...t, wbsCode: String(idx + 1) }))
          set({ tasks: updated })
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

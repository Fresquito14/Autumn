import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TaskResourceAssignment, Resource, Holiday } from '@/types'
import { dbHelpers, db } from '@/lib/storage/db'
import { supabaseSyncService } from '@/lib/supabase/db_service'
import { supabase } from '@/lib/supabase/client'

import { calculateWeeklyAllocation, recalculateWeeklyAllocation } from '@/lib/calculations/resources'

interface ResourceAssignmentState {
  assignments: TaskResourceAssignment[]
  isLoading: boolean
  error: string | null

  // Actions
  loadAllAssignments: () => Promise<void>
  loadTaskAssignments: (taskId: string) => Promise<void>
  loadResourceAssignments: (resourceId: string) => Promise<void>
  getTaskAssignments: (taskId: string) => TaskResourceAssignment[]
  getResourceAssignments: (resourceId: string) => TaskResourceAssignment[]
  createAssignment: (
    assignment: Omit<TaskResourceAssignment, 'id' | 'weeklyDistribution' | 'isManualDistribution'>,
    taskStart: Date,
    taskEnd: Date,
    workingDaysPerWeek: number[],
    resource?: Resource,
    holidays?: Holiday[]
  ) => Promise<string>
  updateAssignment: (id: string, changes: Partial<TaskResourceAssignment>) => Promise<void>
  recalculateAssignment: (
    id: string,
    newTaskStart: Date,
    newTaskEnd: Date,
    workingDaysPerWeek: number[],
    resource?: Resource,
    holidays?: Holiday[]
  ) => Promise<void>
  deleteAssignment: (id: string) => Promise<void>
  clearAssignments: () => void
}

export const useResourceAssignments = create<ResourceAssignmentState>()(
  devtools(
    (set, get) => ({
      assignments: [],
      isLoading: false,
      error: null,

      loadAllAssignments: async () => {
        set({ isLoading: true, error: null })
        try {
          const localAssignments = await dbHelpers.getAllAssignments()
          set({ assignments: localAssignments, isLoading: false })

          try {
            await supabaseSyncService.fetchAssignmentsFromCloud()
            const updatedAssignments = await dbHelpers.getAllAssignments()
            set({ assignments: updatedAssignments })
          } catch (cloudErr) {
            console.warn('Could not sync assignments from Supabase:', cloudErr)
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },


      loadTaskAssignments: async (taskId: string) => {
        set({ isLoading: true, error: null })
        try {
          const assignments = await dbHelpers.getTaskAssignments(taskId)
          set({ assignments, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      loadResourceAssignments: async (resourceId: string) => {
        set({ isLoading: true, error: null })
        try {
          const assignments = await dbHelpers.getResourceAssignments(resourceId)
          set({ assignments, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getTaskAssignments: (taskId: string) => {
        return get().assignments.filter(a => a.taskId === taskId)
      },

      getResourceAssignments: (resourceId: string) => {
        return get().assignments.filter(a => a.resourceId === resourceId)
      },

      createAssignment: async (assignmentData, taskStart, taskEnd, workingDaysPerWeek, resource, holidays) => {
        set({ isLoading: true, error: null })
        try {
          // Calculate initial weekly distribution
          const weeklyDistribution = calculateWeeklyAllocation(
            taskStart,
            taskEnd,
            assignmentData.plannedHours,
            workingDaysPerWeek,
            resource,
            holidays
          )

          const assignment: TaskResourceAssignment = {
            ...assignmentData,
            id: crypto.randomUUID(),
            weeklyDistribution,
            isManualDistribution: false,
          }

          await dbHelpers.createTaskAssignment(assignment)

          // Update task.assignedTo in IndexedDB
          const task = await db.tasks.get(assignment.taskId)
          if (task) {
            const currentAssigned = task.assignedTo || []
            const updatedAssigned = Array.from(new Set([...currentAssigned, assignment.resourceId]))
            await db.tasks.update(task.id, { assignedTo: updatedAssigned })
          }

          // Sync assignment to Supabase
          try {
            await supabase.from('task_resource_assignments').upsert({
              id: assignment.id,
              task_id: assignment.taskId,
              resource_id: assignment.resourceId,
              planned_hours: assignment.plannedHours,
              actual_hours: assignment.actualHours || null,
            })
          } catch (cloudErr) {
            console.warn('Cloud assignment sync skipped:', cloudErr)
          }


          // Reload all assignments
          const assignments = await dbHelpers.getAllAssignments()
          set({ assignments, isLoading: false })

          return assignment.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      updateAssignment: async (id, changes) => {
        set({ isLoading: true, error: null })
        try {
          await dbHelpers.updateTaskAssignment(id, changes)

          const assignments = await dbHelpers.getAllAssignments()
          set({ assignments, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      recalculateAssignment: async (id, newTaskStart, newTaskEnd, workingDaysPerWeek, resource, holidays) => {
        set({ isLoading: true, error: null })
        try {
          const assignment = get().assignments.find(a => a.id === id)
          if (!assignment) {
            set({ isLoading: false })
            return
          }

          // Recalculate weekly distribution
          const newWeeklyDistribution = recalculateWeeklyAllocation(
            assignment.weeklyDistribution,
            newTaskStart,
            newTaskEnd,
            assignment.plannedHours,
            workingDaysPerWeek,
            assignment.isManualDistribution,
            resource,
            holidays
          )

          await dbHelpers.updateTaskAssignment(id, {
            weeklyDistribution: newWeeklyDistribution
          })

          // Reload all assignments
          const assignments = await dbHelpers.getAllAssignments()
          set({ assignments, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteAssignment: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const assignment = get().assignments.find(a => a.id === id)
          if (!assignment) {
            set({ isLoading: false })
            return
          }

          await dbHelpers.deleteTaskAssignment(id)

          // Update task.assignedTo in IndexedDB
          const remainingForTask = await db.taskResourceAssignments.where('taskId').equals(assignment.taskId).toArray()
          const remainingResourceIds = Array.from(new Set(remainingForTask.map(a => a.resourceId)))

          await db.tasks.update(assignment.taskId, { assignedTo: remainingResourceIds })

          try {
            await supabase.from('task_resource_assignments').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete assignment skipped:', cloudErr)
          }


          // Reload all assignments
          const assignments = await dbHelpers.getAllAssignments()
          set({ assignments, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },


      clearAssignments: () => {
        set({ assignments: [], error: null })
      },
    }),
    { name: 'ResourceAssignmentStore' }
  )
)

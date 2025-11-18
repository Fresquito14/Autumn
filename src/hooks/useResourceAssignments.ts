import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TaskResourceAssignment } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
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
    workingDaysPerWeek: number[]
  ) => Promise<string>
  updateAssignment: (id: string, changes: Partial<TaskResourceAssignment>) => Promise<void>
  recalculateAssignment: (
    id: string,
    newTaskStart: Date,
    newTaskEnd: Date,
    workingDaysPerWeek: number[]
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
          const assignments = await dbHelpers.getAllAssignments()
          set({ assignments, isLoading: false })
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

      createAssignment: async (assignmentData, taskStart, taskEnd, workingDaysPerWeek) => {
        set({ isLoading: true, error: null })
        try {
          // Calculate initial weekly distribution
          const weeklyDistribution = calculateWeeklyAllocation(
            taskStart,
            taskEnd,
            assignmentData.plannedHours,
            workingDaysPerWeek
          )

          const assignment: TaskResourceAssignment = {
            ...assignmentData,
            id: crypto.randomUUID(),
            weeklyDistribution,
            isManualDistribution: false,
          }

          await dbHelpers.createTaskAssignment(assignment)

          // Reload assignments for the task
          const assignments = await dbHelpers.getTaskAssignments(assignment.taskId)
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

          const assignment = get().assignments.find(a => a.id === id)
          if (assignment) {
            const assignments = await dbHelpers.getTaskAssignments(assignment.taskId)
            set({ assignments, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      recalculateAssignment: async (id, newTaskStart, newTaskEnd, workingDaysPerWeek) => {
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
            assignment.isManualDistribution
          )

          await dbHelpers.updateTaskAssignment(id, {
            weeklyDistribution: newWeeklyDistribution
          })

          // Reload assignments
          const assignments = await dbHelpers.getTaskAssignments(assignment.taskId)
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

          // Reload assignments for the task
          const assignments = await dbHelpers.getTaskAssignments(assignment.taskId)
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

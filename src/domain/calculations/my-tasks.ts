import type { Task, TaskResourceAssignment } from '@/types'
import { isBefore, isAfter, startOfDay, endOfDay, isValid } from 'date-fns'

export type TaskTemporalStatus = 'active' | 'upcoming' | 'overdue' | 'completed'

export type TaskStatusFilter = 'all' | 'active' | 'upcoming' | 'completed'

/**
 * Safely parse date or return current date
 */
function safeDate(d: unknown, defaultDate: Date = new Date()): Date {
  if (!d) return defaultDate
  const parsed = d instanceof Date ? d : new Date(d as string | number)
  return isValid(parsed) ? parsed : defaultDate
}

/**
 * Determine the temporal and progress status of a task
 */
export function getTaskTemporalStatus(task: Task, referenceDate: Date = new Date()): TaskTemporalStatus {
  if (task.percentComplete === 100 || (task.actualDuration !== undefined && task.actualDuration !== null)) {
    return 'completed'
  }

  const today = startOfDay(referenceDate)
  const taskStart = startOfDay(safeDate(task.startDate))
  const taskEnd = endOfDay(safeDate(task.endDate, task.startDate ? safeDate(task.startDate) : today))

  // If task has passed end date and is not complete -> overdue (classified under active as it requires action)
  if (isAfter(today, taskEnd)) {
    return 'overdue'
  }

  // If today is on or after start date -> active
  if (!isBefore(today, taskStart)) {
    return 'active'
  }

  // If today is before start date -> upcoming
  return 'upcoming'
}

export interface FilterMyTasksParams {
  tasks: Task[]
  resourceId: string // 'all' or specific resource ID
  statusFilter: TaskStatusFilter
  projectId?: string
  searchQuery?: string
  assignments?: TaskResourceAssignment[]
  referenceDate?: Date
}

/**
 * Filter and sort tasks assigned to a specific resource (or all tasks)
 * Ordered chronologically by start date (ascending)
 */
export function filterAndSortMyTasks({
  tasks,
  resourceId,
  statusFilter,
  projectId,
  searchQuery = '',
  assignments = [],
  referenceDate = new Date(),
}: FilterMyTasksParams): Task[] {
  return tasks
    .filter((task) => {
      // 1. Check if resource is assigned to this task (if resourceId is not 'all')
      if (resourceId && resourceId !== 'all') {
        const isDirectlyAssigned = Array.isArray(task.assignedTo) && task.assignedTo.includes(resourceId)
        const isAssignmentRecorded = assignments.some(
          (a) => a.taskId === task.id && a.resourceId === resourceId
        )
        if (!isDirectlyAssigned && !isAssignmentRecorded) {
          return false
        }
      }

      // 2. Filter by project if specified
      if (projectId && projectId !== 'all' && task.projectId !== projectId) {
        return false
      }

      // 3. Filter by search query if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = task.name?.toLowerCase().includes(query)
        const matchesWbs = task.wbsCode?.toLowerCase().includes(query)
        const matchesDescription = task.description?.toLowerCase().includes(query)
        if (!matchesName && !matchesWbs && !matchesDescription) {
          return false
        }
      }

      // 4. Filter by status
      const status = getTaskTemporalStatus(task, referenceDate)

      if (statusFilter === 'all') return true
      if (statusFilter === 'completed') return status === 'completed'
      if (statusFilter === 'upcoming') return status === 'upcoming'
      if (statusFilter === 'active') return status === 'active' || status === 'overdue'

      return true
    })
    .sort((a, b) => {
      // Primary sort: Start date ascending
      const dateA = safeDate(a.startDate).getTime()
      const dateB = safeDate(b.startDate).getTime()
      if (dateA !== dateB) {
        return dateA - dateB
      }

      // Secondary sort: WBS code ascending
      return (a.wbsCode || '').localeCompare(b.wbsCode || '', undefined, { numeric: true })
    })
}

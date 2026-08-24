import type { Task } from '@/types'
import { isBefore, isAfter, startOfDay, endOfDay } from 'date-fns'

export type TaskTemporalStatus = 'active' | 'upcoming' | 'overdue' | 'completed'

export type TaskStatusFilter = 'all' | 'active' | 'upcoming' | 'completed'

/**
 * Determine the temporal and progress status of a task
 */
export function getTaskTemporalStatus(task: Task, referenceDate: Date = new Date()): TaskTemporalStatus {
  if (task.percentComplete === 100 || (task.actualDuration !== undefined && task.actualDuration !== null)) {
    return 'completed'
  }

  const today = startOfDay(referenceDate)
  const taskStart = startOfDay(new Date(task.startDate))
  const taskEnd = endOfDay(new Date(task.endDate))

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
  resourceId: string
  statusFilter: TaskStatusFilter
  projectId?: string
  searchQuery?: string
  referenceDate?: Date
}

/**
 * Filter and sort tasks assigned to a specific resource
 * Ordered chronologically by start date (ascending)
 */
export function filterAndSortMyTasks({
  tasks,
  resourceId,
  statusFilter,
  projectId,
  searchQuery = '',
  referenceDate = new Date(),
}: FilterMyTasksParams): Task[] {
  return tasks
    .filter((task) => {
      // 1. Check if resource is assigned to this task
      const isAssigned = Array.isArray(task.assignedTo) && task.assignedTo.includes(resourceId)
      if (!isAssigned) return false

      // 2. Filter by project if specified
      if (projectId && projectId !== 'all' && task.projectId !== projectId) {
        return false
      }

      // 3. Filter by search query if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = task.name.toLowerCase().includes(query)
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
      const dateA = new Date(a.startDate).getTime()
      const dateB = new Date(b.startDate).getTime()
      if (dateA !== dateB) {
        return dateA - dateB
      }

      // Secondary sort: WBS code ascending
      return (a.wbsCode || '').localeCompare(b.wbsCode || '', undefined, { numeric: true })
    })
}

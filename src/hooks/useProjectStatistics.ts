import { useMemo } from 'react'
import { useTasks } from './useTasks'
import { useProject } from './useProject'
import { calculateBusinessDays } from '@/lib/calculations/dates'

export interface ProjectStatistics {
  plannedDuration: number
  actualDuration: number
  difference: number
  status: 'ahead' | 'on-track' | 'behind' | 'no-data'
  plannedStartDate: Date | null
  plannedEndDate: Date | null
  actualStartDate: Date | null
  actualEndDate: Date | null
}

export function useProjectStatistics(): ProjectStatistics {
  const { tasks } = useTasks()
  const { currentProject } = useProject()

  return useMemo(() => {
    const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]

    // Only consider root-level tasks (no parent) for project-level dates
    const rootTasks = tasks.filter(task => !task.parentId)

    if (rootTasks.length === 0) {
      return {
        plannedDuration: 0,
        actualDuration: 0,
        difference: 0,
        status: 'no-data',
        plannedStartDate: null,
        plannedEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
      }
    }

    // Calculate planned dates
    const plannedStartDates = rootTasks.map(t => t.startDate)
    const plannedEndDates = rootTasks.map(t => t.endDate)

    const plannedStartDate = new Date(Math.min(...plannedStartDates.map(d => d.getTime())))
    const plannedEndDate = new Date(Math.max(...plannedEndDates.map(d => d.getTime())))

    const plannedDuration = calculateBusinessDays(plannedStartDate, plannedEndDate, workingDays)

    // Calculate actual dates (only if we have actual data)
    const tasksWithActualDates = rootTasks.filter(
      task => task.actualStartDate && task.actualEndDate
    )

    let actualDuration = 0
    let actualStartDate: Date | null = null
    let actualEndDate: Date | null = null
    let status: 'ahead' | 'on-track' | 'behind' | 'no-data' = 'no-data'

    if (tasksWithActualDates.length > 0) {
      const actualStartDates = tasksWithActualDates.map(t => t.actualStartDate!)
      const actualEndDates = tasksWithActualDates.map(t => t.actualEndDate!)

      actualStartDate = new Date(Math.min(...actualStartDates.map(d => d.getTime())))
      actualEndDate = new Date(Math.max(...actualEndDates.map(d => d.getTime())))

      actualDuration = calculateBusinessDays(actualStartDate, actualEndDate, workingDays)

      // Calculate difference (negative = ahead, positive = behind)
      const difference = actualDuration - plannedDuration

      // Determine status
      if (difference < -1) {
        status = 'ahead'
      } else if (difference > 1) {
        status = 'behind'
      } else {
        status = 'on-track'
      }

      return {
        plannedDuration,
        actualDuration,
        difference,
        status,
        plannedStartDate,
        plannedEndDate,
        actualStartDate,
        actualEndDate,
      }
    }

    return {
      plannedDuration,
      actualDuration: 0,
      difference: 0,
      status: 'no-data',
      plannedStartDate,
      plannedEndDate,
      actualStartDate: null,
      actualEndDate: null,
    }
  }, [tasks, currentProject])
}

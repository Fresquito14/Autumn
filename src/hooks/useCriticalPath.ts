import { useMemo } from 'react'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useViewMode } from './useViewMode'
import type { Task } from '@/types'
import {
  calculateCriticalPath,
  getCriticalTasks,
  getCriticalPathSequence,
  getProjectDuration,
  type TaskWithCPM,
} from '@/lib/algorithms/critical-path'

export function useCriticalPath() {
  const { tasks } = useTasks()
  const { dependencies } = useDependencies()
  const { viewMode } = useViewMode()

  // Prepare tasks with actual duration when in actual mode
  const adjustedTasks = useMemo(() => {
    if (viewMode === 'actual') {
      return tasks.map(task => {
        // Use actualDuration if available, otherwise fall back to planned duration
        if (task.actualDuration !== undefined && task.actualDuration !== null) {
          return {
            ...task,
            duration: task.actualDuration
          } as Task
        }
        return task
      })
    }

    // In plan mode, remove actualDuration to prevent tasks from being marked as completed
    return tasks.map(task => ({
      ...task,
      actualDuration: undefined,
      actualStartDate: undefined,
      actualEndDate: undefined
    }))
  }, [tasks, viewMode])

  // Prepare dependencies with actual lag when in actual mode
  const adjustedDependencies = useMemo(() => {
    if (viewMode === 'actual') {
      return dependencies.map(dep => ({
        ...dep,
        lag: (dep.actualLag !== undefined && dep.actualLag !== null) ? dep.actualLag : (dep.lag || 0)
      }))
    }
    return dependencies
  }, [dependencies, viewMode])

  // Calculate CPM whenever tasks, dependencies, or view mode change
  const tasksWithCPM = useMemo(() => {
    return calculateCriticalPath(adjustedTasks, adjustedDependencies)
  }, [adjustedTasks, adjustedDependencies])

  // Get critical tasks
  const criticalTasks = useMemo(() => {
    return getCriticalTasks(tasksWithCPM)
  }, [tasksWithCPM])

  // Get critical path sequence
  const criticalPathSequence = useMemo(() => {
    return getCriticalPathSequence(tasksWithCPM, adjustedDependencies)
  }, [tasksWithCPM, adjustedDependencies])

  // Get project duration
  const projectDuration = useMemo(() => {
    return getProjectDuration(tasksWithCPM)
  }, [tasksWithCPM])

  // Check if a task is critical
  const isTaskCritical = (taskId: string): boolean => {
    const task = tasksWithCPM.find(t => t.id === taskId)
    return task?.isCritical || false
  }

  // Get CPM data for a specific task
  const getTaskCPM = (taskId: string): TaskWithCPM | undefined => {
    return tasksWithCPM.find(t => t.id === taskId)
  }

  return {
    tasksWithCPM,
    criticalTasks,
    criticalPathSequence,
    projectDuration,
    isTaskCritical,
    getTaskCPM,
    hasCriticalPath: criticalTasks.length > 0,
  }
}

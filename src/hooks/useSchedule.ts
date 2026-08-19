import { useCallback } from 'react'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useProject } from './useProject'

/**
 * Hook to trigger atomic schedule recalculation based on dependencies
 */
export function useSchedule() {
  const { recalculateDatesFromDependencies } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()

  const recalculateSchedule = useCallback(async () => {
    if (!currentProject) return
    const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]
    await recalculateDatesFromDependencies(dependencies, workingDays)
  }, [dependencies, currentProject, recalculateDatesFromDependencies])

  return { recalculateSchedule }
}

import { useEffect, useRef } from 'react'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useProject } from './useProject'
import { calculateActualDates } from '@/lib/calculations/dates'
import { dbHelpers } from '@/lib/storage/db'

/**
 * Hook that automatically recalculates task schedules when dependencies change
 * Debounces calculations to avoid excessive updates and renders
 */
export function useAutoRecalculate() {
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()
  const { recalculateDatesFromDependencies } = useTasks()

  const recalculationTimeoutRef = useRef<number | null>(null)
  const isCalculatingRef = useRef(false)

  useEffect(() => {
    if (!currentProject) return

    if (recalculationTimeoutRef.current) {
      clearTimeout(recalculationTimeoutRef.current)
    }

    recalculationTimeoutRef.current = window.setTimeout(async () => {
      if (isCalculatingRef.current) return
      try {
        isCalculatingRef.current = true
        const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]

        // 1. Atomically recalculate planned dates
        await recalculateDatesFromDependencies(dependencies, workingDays)

        // 2. Atomically calculate actual dates
        const currentTasks = useTasks.getState().tasks
        if (currentTasks.length > 0) {
          const updatedWithActual = calculateActualDates(currentTasks, dependencies, workingDays)
          const actualUpdates: Promise<unknown>[] = []

          updatedWithActual.forEach(updated => {
            const original = currentTasks.find(t => t.id === updated.id)
            if (!original) return

            const startChanged = updated.actualStartDate?.getTime() !== original.actualStartDate?.getTime()
            const endChanged = updated.actualEndDate?.getTime() !== original.actualEndDate?.getTime()

            if (startChanged || endChanged) {
              actualUpdates.push(
                dbHelpers.updateTask(updated.id, {
                  actualStartDate: updated.actualStartDate,
                  actualEndDate: updated.actualEndDate,
                })
              )
            }
          })

          if (actualUpdates.length > 0) {
            await Promise.all(actualUpdates)
            useTasks.setState({ tasks: updatedWithActual })
          }
        }
      } catch (error) {
        console.error('Error in useAutoRecalculate:', error)
      } finally {
        isCalculatingRef.current = false
      }
    }, 150)

    return () => {
      if (recalculationTimeoutRef.current) {
        clearTimeout(recalculationTimeoutRef.current)
      }
    }
  }, [dependencies, currentProject, recalculateDatesFromDependencies])

  return null
}

import { useEffect, useRef } from 'react'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useProject } from './useProject'
import { useViewMode } from './useViewMode'
import { calculateActualDates } from '@/lib/calculations/dates'
import { useSchedule } from './useSchedule'

/**
 * Hook that automatically recalculates task schedules when relevant data changes
 * Listens to changes in tasks, dependencies, and view mode
 * Debounces calculations to avoid excessive updates
 */
export function useAutoRecalculate() {
  const { tasks, updateTask } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()
  const { viewMode } = useViewMode()
  const { recalculateSchedule } = useSchedule()

  const isInitialMount = useRef(true)
  const recalculationTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip on initial mount to avoid unnecessary calculations
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Skip if no project or no tasks
    if (!currentProject || tasks.length === 0) {
      return
    }

    // Clear any pending recalculation
    if (recalculationTimeoutRef.current) {
      clearTimeout(recalculationTimeoutRef.current)
    }

    // Debounce the recalculation (300ms)
    recalculationTimeoutRef.current = window.setTimeout(async () => {
      console.log('🔄 Auto-recalculate triggered')
      console.log('   - View mode:', viewMode)
      console.log('   - Tasks:', tasks.length)
      console.log('   - Dependencies:', dependencies.length)

      try {
        // Always recalculate planned dates
        await recalculateSchedule()

        // Also calculate actual dates
        const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]
        const updatedTasksWithActualDates = calculateActualDates(
          tasks,
          dependencies,
          workingDays
        )

        // Update tasks that have changes in actual dates
        const tasksToUpdate: Array<{ id: string; actualStartDate?: Date; actualEndDate?: Date }> = []

        updatedTasksWithActualDates.forEach(updatedTask => {
          const originalTask = tasks.find(t => t.id === updatedTask.id)
          if (!originalTask) return

          const actualStartChanged =
            updatedTask.actualStartDate?.getTime() !== originalTask.actualStartDate?.getTime()
          const actualEndChanged =
            updatedTask.actualEndDate?.getTime() !== originalTask.actualEndDate?.getTime()

          if (actualStartChanged || actualEndChanged) {
            tasksToUpdate.push({
              id: updatedTask.id,
              actualStartDate: updatedTask.actualStartDate,
              actualEndDate: updatedTask.actualEndDate,
            })
          }
        })

        // Update actual dates in batch if needed
        if (tasksToUpdate.length > 0) {
          console.log('📅 Actualizando fechas reales de', tasksToUpdate.length, 'tareas')

          await Promise.all(
            tasksToUpdate.map(task =>
              updateTask(task.id, {
                actualStartDate: task.actualStartDate,
                actualEndDate: task.actualEndDate,
              })
            )
          )

          console.log('✅ Fechas reales actualizadas')
        } else {
          console.log('ℹ️ No hay cambios de fechas reales necesarios')
        }
      } catch (error) {
        console.error('❌ Error en auto-recalculate:', error)
      }
    }, 300) // 300ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (recalculationTimeoutRef.current) {
        clearTimeout(recalculationTimeoutRef.current)
      }
    }
  }, [tasks, dependencies, viewMode, currentProject, recalculateSchedule, updateTask])

  // Return nothing - this is a side-effect only hook
  return null
}

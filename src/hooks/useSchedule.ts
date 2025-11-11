import { useCallback } from 'react'
import { useTasks } from './useTasks'
import { useDependencies } from './useDependencies'
import { useProject } from './useProject'
import { recalculateTaskDates } from '@/lib/calculations/dates'

/**
 * Hook to manually recalculate task schedules based on dependencies
 * Returns a function to trigger the recalculation
 */
export function useSchedule() {
  const { tasks, updateTask } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()

  const recalculateSchedule = useCallback(async () => {
    if (!currentProject || tasks.length === 0) return

    console.log('🔄 Recalculando schedule...')

    // Get working days from project config
    const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]

    // Recalculate task dates based on dependencies
    const updatedTasks = recalculateTaskDates(
      tasks,
      dependencies,
      workingDays
    )

    // Check if any tasks need updating
    const tasksToUpdate: Array<{ id: string; startDate: Date; endDate: Date }> = []

    updatedTasks.forEach(updatedTask => {
      const originalTask = tasks.find(t => t.id === updatedTask.id)
      if (!originalTask) return

      const startChanged = originalTask.startDate.getTime() !== updatedTask.startDate.getTime()
      const endChanged = originalTask.endDate.getTime() !== updatedTask.endDate.getTime()

      if (startChanged || endChanged) {
        tasksToUpdate.push({
          id: updatedTask.id,
          startDate: updatedTask.startDate,
          endDate: updatedTask.endDate,
        })
      }
    })

    // Update tasks in batch if needed
    if (tasksToUpdate.length > 0) {
      console.log('📅 Actualizando fechas de', tasksToUpdate.length, 'tareas')

      // Update all tasks
      await Promise.all(
        tasksToUpdate.map(task =>
          updateTask(task.id, {
            startDate: task.startDate,
            endDate: task.endDate,
          })
        )
      )

      console.log('✅ Schedule recalculado')
    } else {
      console.log('ℹ️ No hay cambios de fechas necesarios')
    }
  }, [tasks, dependencies, currentProject, updateTask])

  return { recalculateSchedule }
}

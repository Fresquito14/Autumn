import { db, dbHelpers } from '@/lib/storage/db'
import { recalculateTaskDates, addBusinessDays, calculateBusinessDays, isWorkingDay } from './dates'
import { recalculateLinkedMilestones } from './milestones'
import { useProject } from '@/hooks/useProject'
import { useTasks } from '@/hooks/useTasks'

/**
 * Updates the project's start date and cascades the new start date to all
 * initial unconstrained tasks (tasks without predecessors), recalculating
 * all downstream dependencies and parent summary tasks.
 */
export async function updateProjectStartDateAndCascade(
  projectId: string,
  newStartDate: Date
): Promise<void> {
  const currentProject = useProject.getState().currentProject
  const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]

  // 1. Move newStartDate to next working day if it falls on a non-working day
  let adjustedStartDate = new Date(newStartDate)
  let safetyCounter = 0
  while (!isWorkingDay(adjustedStartDate, workingDays) && safetyCounter < 7) {
    adjustedStartDate = new Date(adjustedStartDate.getTime() + 86400000)
    safetyCounter++
  }

  // 2. Update the project start date in IndexedDB and Zustand
  await useProject.getState().updateProject(projectId, { startDate: adjustedStartDate })

  // 3. Load all project tasks and dependencies
  const allTasks = await dbHelpers.getProjectTasks(projectId)
  const projectDeps = await dbHelpers.getProjectDependencies(projectId)

  if (allTasks.length === 0) return

  // 4. Identify all tasks that have NO predecessors
  const successorTaskIds = new Set(projectDeps.map(d => d.successorId))

  // For each task without predecessors:
  allTasks.forEach(task => {
    // Only update leaf tasks (or tasks without children) that have no predecessor
    const isParent = allTasks.some(child => child.parentId === task.id)
    if (!isParent && !successorTaskIds.has(task.id)) {
      const newEndDate = addBusinessDays(adjustedStartDate, task.duration - 1, workingDays)
      task.startDate = adjustedStartDate
      task.endDate = newEndDate
    }
  })

  // 5. Run Kahn's topological sort recalculation across all tasks
  const recalculated = recalculateTaskDates(allTasks, projectDeps, workingDays)

  // 6. Recursively recalculate parent tasks bottom-up
  const parentTasks = recalculated.filter(t => recalculated.some(child => child.parentId === t.id))
  parentTasks.sort((a, b) => (b.level || 0) - (a.level || 0))

  parentTasks.forEach(parent => {
    const children = recalculated.filter(t => t.parentId === parent.id)
    if (children.length > 0) {
      const childStarts = children.map(t => new Date(t.startDate).getTime())
      const childEnds = children.map(t => new Date(t.endDate).getTime())
      const minStart = new Date(Math.min(...childStarts))
      const maxEnd = new Date(Math.max(...childEnds))
      const duration = calculateBusinessDays(minStart, maxEnd, workingDays)

      parent.startDate = minStart
      parent.endDate = maxEnd
      parent.duration = duration
    }
  })

  // 7. Persist updated tasks to Dexie
  await db.transaction('rw', [db.tasks], async () => {
    await db.tasks.bulkPut(recalculated)
  })

  // 8. Update Zustand store atomically
  recalculated.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
  useTasks.setState({ tasks: recalculated })

  // 9. Recalculate linked milestone dates
  await recalculateLinkedMilestones(projectId, recalculated, workingDays)
}

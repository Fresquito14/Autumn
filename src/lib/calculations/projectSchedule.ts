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

/**
 * Updates a project's core properties (name, description, startDate, workingDays)
 * and if dates or working days changed, triggers a full schedule recalculation
 * across all tasks and milestones.
 */
export async function updateProjectAndRecalculateSchedule(
  projectId: string,
  updates: {
    name?: string
    description?: string
    startDate?: Date
    workingDays?: number[]
    organizationId?: string | null
  }
): Promise<void> {
  const project = await db.projects.get(projectId)
  if (!project) return

  const oldWorkingDays = project.config?.workingDays || [1, 2, 3, 4, 5]
  const newWorkingDays = updates.workingDays || oldWorkingDays

  const workingDaysChanged =
    JSON.stringify([...oldWorkingDays].sort()) !== JSON.stringify([...newWorkingDays].sort())

  const oldStart = new Date(project.startDate).toISOString().split('T')[0]
  const newStart = updates.startDate
    ? new Date(updates.startDate).toISOString().split('T')[0]
    : oldStart
  const startDateChanged = oldStart !== newStart

  // 1. Prepare project config updates
  const projectUpdates: Partial<typeof project> = {}
  if (updates.name !== undefined) projectUpdates.name = updates.name
  if (updates.description !== undefined) projectUpdates.description = updates.description
  if (updates.organizationId !== undefined) {
    projectUpdates.organizationId = updates.organizationId
  }
  if (updates.workingDays !== undefined) {
    projectUpdates.config = {
      ...project.config,
      workingDays: newWorkingDays,
    }
  }

  // Adjust start date to working day if needed
  let finalStartDate = updates.startDate ? new Date(updates.startDate) : new Date(project.startDate)
  let safetyCounter = 0
  while (!isWorkingDay(finalStartDate, newWorkingDays) && safetyCounter < 7) {
    finalStartDate = new Date(finalStartDate.getTime() + 86400000)
    safetyCounter++
  }
  projectUpdates.startDate = finalStartDate

  // 2. Persist project changes in storage & Zustand
  await useProject.getState().updateProject(projectId, projectUpdates)

  // If neither working days nor start date changed, no task recalculation needed
  if (!workingDaysChanged && !startDateChanged) {
    return
  }

  // 3. Load all tasks and dependencies for this project
  const allTasks = await dbHelpers.getProjectTasks(projectId)
  const projectDeps = await dbHelpers.getProjectDependencies(projectId)

  if (allTasks.length === 0) return

  const successorTaskIds = new Set(projectDeps.map((d) => d.successorId))

  // 4. Adjust leaf tasks
  allTasks.forEach((task) => {
    const isParent = allTasks.some((child) => child.parentId === task.id)
    if (!isParent) {
      // If task has no predecessor and start date changed, update start
      if (!successorTaskIds.has(task.id) && startDateChanged) {
        task.startDate = finalStartDate
      } else {
        // Adjust start date to working day if falling on non-working day
        let taskStart = new Date(task.startDate)
        let sCount = 0
        while (!isWorkingDay(taskStart, newWorkingDays) && sCount < 7) {
          taskStart = new Date(taskStart.getTime() + 86400000)
          sCount++
        }
        task.startDate = taskStart
      }
      // Recalculate end date based on duration and new working days
      task.endDate = addBusinessDays(task.startDate, task.duration - 1, newWorkingDays)
    }
  })

  // 5. Run Kahn topological recalculation
  const recalculated = recalculateTaskDates(allTasks, projectDeps, newWorkingDays)

  // 6. Recursively recalculate parent summary tasks
  const parentTasks = recalculated.filter((t) =>
    recalculated.some((child) => child.parentId === t.id)
  )
  parentTasks.sort((a, b) => (b.level || 0) - (a.level || 0))

  parentTasks.forEach((parent) => {
    const children = recalculated.filter((t) => t.parentId === parent.id)
    if (children.length > 0) {
      const childStarts = children.map((t) => new Date(t.startDate).getTime())
      const childEnds = children.map((t) => new Date(t.endDate).getTime())
      const minStart = new Date(Math.min(...childStarts))
      const maxEnd = new Date(Math.max(...childEnds))
      const duration = calculateBusinessDays(minStart, maxEnd, newWorkingDays)

      parent.startDate = minStart
      parent.endDate = maxEnd
      parent.duration = duration
    }
  })

  // 7. Persist recalculated tasks to Dexie
  await db.transaction('rw', [db.tasks], async () => {
    await db.tasks.bulkPut(recalculated)
  })

  // 8. Update Zustand store if this is the currently viewed project
  const currentProjId = useProject.getState().currentProject?.id
  if (currentProjId === projectId) {
    recalculated.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))
    useTasks.setState({ tasks: recalculated })
  }

  // 9. Recalculate linked milestones
  await recalculateLinkedMilestones(projectId, recalculated, newWorkingDays)
}

import { differenceInDays } from 'date-fns'
import type { Task } from '@/types'

export interface TaskConflictInfo {
  taskId: string
  hasConflict: boolean
  conflictingTasks: Array<{
    id: string
    name: string
    projectId: string
    startDate: Date
    endDate: Date
  }>
  totalOverlapDays: number
}

/**
 * Normalizes a date to midnight (00:00:00.000)
 */
function normalizeDate(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Checks if two date intervals overlap
 */
export function doIntervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  const sA = normalizeDate(startA).getTime()
  const eA = normalizeDate(endA).getTime()
  const sB = normalizeDate(startB).getTime()
  const eB = normalizeDate(endB).getTime()

  return sA <= eB && sB <= eA
}

/**
 * Calculates number of overlapping days between two intervals (inclusive)
 */
export function calculateOverlapDays(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const sA = normalizeDate(startA)
  const eA = normalizeDate(endA)
  const sB = normalizeDate(startB)
  const eB = normalizeDate(endB)

  const overlapStart = sA.getTime() > sB.getTime() ? sA : sB
  const overlapEnd = eA.getTime() < eB.getTime() ? eA : eB

  if (overlapStart.getTime() > overlapEnd.getTime()) {
    return 0
  }

  return differenceInDays(overlapEnd, overlapStart) + 1
}

/**
 * Detects scheduling conflicts (overlapping dates) across a list of tasks assigned to a resource
 * Ignores 100% completed tasks as they no longer cause active conflicts.
 */
export function detectTaskConflicts(tasks: Task[]): Map<string, TaskConflictInfo> {
  const conflictMap = new Map<string, TaskConflictInfo>()

  // Initialize map for all tasks
  tasks.forEach((t) => {
    conflictMap.set(t.id, {
      taskId: t.id,
      hasConflict: false,
      conflictingTasks: [],
      totalOverlapDays: 0,
    })
  })

  // Filter tasks that can cause conflicts (non-completed tasks with valid dates)
  const activeTasks = tasks.filter((t) => {
    const isCompleted =
      t.percentComplete === 100 ||
      (t.actualDuration !== undefined && t.actualDuration !== null && !t.actualEndDate) === false &&
      t.percentComplete === 100
    return !isCompleted && t.startDate && t.endDate
  })

  for (let i = 0; i < activeTasks.length; i++) {
    const taskA = activeTasks[i]
    const infoA = conflictMap.get(taskA.id)!

    for (let j = i + 1; j < activeTasks.length; j++) {
      const taskB = activeTasks[j]
      const infoB = conflictMap.get(taskB.id)!

      if (doIntervalsOverlap(taskA.startDate, taskA.endDate, taskB.startDate, taskB.endDate)) {
        const overlapDays = calculateOverlapDays(
          taskA.startDate,
          taskA.endDate,
          taskB.startDate,
          taskB.endDate
        )

        if (overlapDays > 0) {
          infoA.hasConflict = true
          infoA.conflictingTasks.push({
            id: taskB.id,
            name: taskB.name,
            projectId: taskB.projectId,
            startDate: new Date(taskB.startDate),
            endDate: new Date(taskB.endDate),
          })
          infoA.totalOverlapDays += overlapDays

          infoB.hasConflict = true
          infoB.conflictingTasks.push({
            id: taskA.id,
            name: taskA.name,
            projectId: taskA.projectId,
            startDate: new Date(taskA.startDate),
            endDate: new Date(taskA.endDate),
          })
          infoB.totalOverlapDays += overlapDays
        }
      }
    }
  }

  return conflictMap
}

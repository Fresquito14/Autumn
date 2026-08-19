import { db, dbHelpers } from '@/lib/storage/db'
import { addBusinessDays } from './dates'
import { useMilestones } from '@/hooks/useMilestones'
import type { Task, Milestone } from '@/types'

/**
 * Recalculates the dates of all milestones linked to tasks within a project.
 * If a milestone is linked to a task (milestone.linkedTaskId), its date is
 * updated to task.endDate + (milestone.offsetDays || 0) working days.
 */
export async function recalculateLinkedMilestones(
  projectId: string,
  updatedTasks?: Task[],
  workingDays: number[] = [1, 2, 3, 4, 5]
): Promise<Milestone[]> {
  const tasks = updatedTasks || (await dbHelpers.getProjectTasks(projectId))
  const milestones = await dbHelpers.getProjectMilestones(projectId)

  if (milestones.length === 0 || tasks.length === 0) return milestones

  const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]))
  const updatedMilestones: Milestone[] = []
  let hasChanges = false

  for (const ms of milestones) {
    if (ms.linkedTaskId && taskMap.has(ms.linkedTaskId)) {
      const linkedTask = taskMap.get(ms.linkedTaskId)!
      const offset = ms.offsetDays || 0
      const newDate = addBusinessDays(new Date(linkedTask.endDate), offset, workingDays)

      if (new Date(ms.date).getTime() !== newDate.getTime()) {
        ms.date = newDate
        updatedMilestones.push(ms)
        hasChanges = true
      }
    }
  }

  if (hasChanges && updatedMilestones.length > 0) {
    await db.transaction('rw', [db.milestones], async () => {
      await db.milestones.bulkPut(updatedMilestones)
    })

    // Update Zustand store so UI reflects new milestone positions immediately
    const activeMilestones = await dbHelpers.getProjectMilestones(projectId)
    activeMilestones.sort((a, b) => a.date.getTime() - b.date.getTime())
    useMilestones.setState({ milestones: activeMilestones })
  }

  return milestones
}

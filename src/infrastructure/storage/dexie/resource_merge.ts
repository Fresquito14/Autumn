import { db, dbHelpers } from './db'
import { supabase } from '@/infrastructure/supabase/client'

export interface ResourceMergeResult {
  migratedTasksCount: number
  updatedAssignmentsCount: number
}

/**
 * Unifies or reassigns all tasks from a source resource to a target resource.
 */
export async function mergeOrReassignResource(
  sourceResourceId: string,
  targetResourceId: string,
  deleteSource: boolean = true
): Promise<ResourceMergeResult> {
  if (!sourceResourceId || !targetResourceId) {
    throw new Error('Debes seleccionar el recurso origen y el recurso destino.')
  }

  if (sourceResourceId === targetResourceId) {
    throw new Error('El recurso origen y el recurso destino deben ser diferentes.')
  }

  const allAssignments = await db.taskResourceAssignments.toArray()
  const allTasks = await db.tasks.toArray()

  const sourceAssignments = allAssignments.filter(a => a.resourceId === sourceResourceId)
  const targetAssignments = allAssignments.filter(a => a.resourceId === targetResourceId)

  let migratedTasksCount = 0
  let updatedAssignmentsCount = 0
  const cloudSyncQueue: (() => Promise<void>)[] = []

  await db.transaction('rw', [db.taskResourceAssignments, db.tasks, db.resources], async () => {
    for (const sAssign of sourceAssignments) {
      const existingTargetAssign = targetAssignments.find(t => t.taskId === sAssign.taskId)

      if (existingTargetAssign) {
        const combinedPlanned = Number(existingTargetAssign.plannedHours || 0) + Number(sAssign.plannedHours || 0)
        const combinedActual = (existingTargetAssign.actualHours !== undefined || sAssign.actualHours !== undefined)
          ? Number(existingTargetAssign.actualHours || 0) + Number(sAssign.actualHours || 0)
          : undefined

        const targetDistMap = new Map<string, { weekStart: Date; workingDaysInWeek: number; plannedHours: number; actualHours?: number }>()

        for (const w of (existingTargetAssign.weeklyDistribution || [])) {
          const key = new Date(w.weekStart).toISOString().split('T')[0]
          targetDistMap.set(key, {
            weekStart: new Date(w.weekStart),
            workingDaysInWeek: w.workingDaysInWeek || 5,
            plannedHours: Number(w.plannedHours || 0),
            actualHours: w.actualHours ? Number(w.actualHours) : undefined,
          })
        }

        for (const w of (sAssign.weeklyDistribution || [])) {
          const key = new Date(w.weekStart).toISOString().split('T')[0]
          const existing = targetDistMap.get(key)
          if (existing) {
            existing.plannedHours = Math.round((existing.plannedHours + Number(w.plannedHours || 0)) * 100) / 100
            if (w.actualHours !== undefined || existing.actualHours !== undefined) {
              existing.actualHours = Math.round(((existing.actualHours || 0) + Number(w.actualHours || 0)) * 100) / 100
            }
          } else {
            targetDistMap.set(key, {
              weekStart: new Date(w.weekStart),
              workingDaysInWeek: w.workingDaysInWeek || 5,
              plannedHours: Number(w.plannedHours || 0),
              actualHours: w.actualHours ? Number(w.actualHours) : undefined,
            })
          }
        }

        const mergedWeeklyDistribution = Array.from(targetDistMap.values())

        await db.taskResourceAssignments.update(existingTargetAssign.id, {
          plannedHours: Math.round(combinedPlanned * 100) / 100,
          actualHours: combinedActual !== undefined ? Math.round(combinedActual * 100) / 100 : undefined,
          weeklyDistribution: mergedWeeklyDistribution
        })

        await db.taskResourceAssignments.delete(sAssign.id)

        const targetId = existingTargetAssign.id
        const tId = existingTargetAssign.taskId
        const sId = sAssign.id
        cloudSyncQueue.push(async () => {
          await supabase.from('task_resource_assignments').upsert({
            id: targetId,
            task_id: tId,
            resource_id: targetResourceId,
            planned_hours: Math.round(combinedPlanned * 100) / 100,
            actual_hours: combinedActual !== undefined ? Math.round(combinedActual * 100) / 100 : undefined,
            weekly_distribution: mergedWeeklyDistribution,
          })
          await supabase.from('task_resource_assignments').delete().eq('id', sId)
        })
      } else {
        await db.taskResourceAssignments.update(sAssign.id, {
          resourceId: targetResourceId
        })

        const sId = sAssign.id
        cloudSyncQueue.push(async () => {
          await supabase.from('task_resource_assignments').update({
            resource_id: targetResourceId
          }).eq('id', sId)
        })
      }
      updatedAssignmentsCount++
    }

    const affectedTasks = allTasks.filter(t => t.assignedTo && t.assignedTo.includes(sourceResourceId))
    migratedTasksCount = affectedTasks.length

    for (const task of affectedTasks) {
      const newAssignedTo = task.assignedTo.map(id => id === sourceResourceId ? targetResourceId : id)
      const deduplicatedAssignedTo = Array.from(new Set(newAssignedTo))

      await db.tasks.update(task.id, {
        assignedTo: deduplicatedAssignedTo
      })

      const taskId = task.id
      cloudSyncQueue.push(async () => {
        await supabase.from('tasks').update({
          assigned_to: deduplicatedAssignedTo
        }).eq('id', taskId)
      })
    }

    if (deleteSource) {
      await dbHelpers.deleteResource(sourceResourceId)
      cloudSyncQueue.push(async () => {
        await supabase.from('resources').delete().eq('id', sourceResourceId)
      })
    }
  })

  for (const syncFn of cloudSyncQueue) {
    try {
      await syncFn()
    } catch (e) {
      console.warn('Cloud sync post-transaction error:', e)
    }
  }

  return { migratedTasksCount, updatedAssignmentsCount }
}

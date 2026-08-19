import portfolioData from '@/portfolio-completo.json'
import { db, dbHelpers } from './db'
import { supabase } from '@/infrastructure/supabase/client'

export async function seedInitialPortfolioIfEmpty(): Promise<boolean> {
  try {
    const projectCount = await db.projects.count()
    const taskCount = await db.tasks.count()

    if (projectCount > 0 && taskCount > 0) {
      return false
    }

    return await forceSeedPortfolioDataset()
  } catch (err) {
    console.error('Error seeding portfolio dataset:', err)
    return false
  }
}

export function getPortfolioDatasetStats() {
  const items = (portfolioData as any[]) || []
  const projectCount = items.filter(i => i.project).length
  const taskCount = items.reduce((sum, i) => sum + (i.tasks?.length || 0), 0)
  const projectNames = items.map(i => i.project?.name).filter(Boolean) as string[]

  return { projectCount, taskCount, projectNames }
}

export async function forceSeedPortfolioDataset(): Promise<boolean> {
  try {
    console.log('Force re-seeding portfolio dataset from portfolio-completo.json...')

    const existingProjects = await db.projects.toArray()
    const portfolioProjectIds = (portfolioData as any[]).map(item => item.project?.id).filter(Boolean)
    const portfolioProjectNames = (portfolioData as any[]).map(item => item.project?.name?.toLowerCase().trim()).filter(Boolean)

    for (const existing of existingProjects) {
      if (portfolioProjectIds.includes(existing.id) || portfolioProjectNames.includes(existing.name.toLowerCase().trim())) {
        await dbHelpers.deleteProject(existing.id)
      }
    }

    await db.transaction('rw', [
      db.projects,
      db.tasks,
      db.dependencies,
      db.resources,
      db.milestones,
      db.taskResourceAssignments,
    ], async () => {
      for (const item of portfolioData as any[]) {
        if (item.project) {
          const p = item.project
          await db.projects.put({
            ...p,
            startDate: new Date(p.startDate),
            endDate: p.endDate ? new Date(p.endDate) : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            config: {
              workingDays: p.config?.workingDays || [1, 2, 3, 4, 5],
              hoursPerDay: p.config?.hoursPerDay || 8,
              useGlobalHolidays: true,
              excludedGlobalHolidayIds: [],
              projectSpecificHolidays: [],
              skipHolidaysInScheduling: true,
              defaultDuration: 5,
            },
          })
        }

        if (item.resources && item.resources.length > 0) {
          for (const r of item.resources) {
            const vacations = (r.calendar?.vacations || []).map((v: any) => ({
              id: crypto.randomUUID(),
              start: new Date(v.start || v.startDate),
              end: new Date(v.end || v.endDate),
              startDate: new Date(v.start || v.startDate),
              endDate: new Date(v.end || v.endDate),
            }))
            await db.resources.put({
              ...r,
              calendar: {
                workingDays: r.calendar?.workingDays || [1, 2, 3, 4, 5],
                vacations,
              },
            })
          }
        }

        if (item.tasks && item.tasks.length > 0) {
          for (const t of item.tasks) {
            const wbsCode = t.wbsCode || '1'
            const level = t.level !== undefined && t.level !== null ? Number(t.level) : (wbsCode.split('.').length - 1)
            await db.tasks.put({
              ...t,
              duration: Number(t.duration || 1),
              startDate: new Date(t.startDate),
              endDate: new Date(t.endDate),
              level,
              percentComplete: t.percentComplete ?? t.progress ?? 0,
              checklist: t.checklist || [],
              assignedTo: t.assignedTo || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
        }

        if (item.dependencies && item.dependencies.length > 0) {
          for (const d of item.dependencies) {
            await db.dependencies.put({
              ...d,
              type: d.type || 'FS',
              lag: Number(d.lag || 0),
            })
          }
        }

        if (item.milestones && item.milestones.length > 0) {
          for (const m of item.milestones) {
            await db.milestones.put({
              ...m,
              date: new Date(m.date),
            })
          }
        }

        const assignmentsList = item.assignments || item.taskResourceAssignments || []
        if (assignmentsList.length > 0) {
          for (const a of assignmentsList) {
            await db.taskResourceAssignments.put({
              id: a.id || crypto.randomUUID(),
              taskId: a.taskId || a.task_id,
              resourceId: a.resourceId || a.resource_id,
              plannedHours: Number(a.plannedHours || a.planned_hours || 8),
              actualHours: a.actualHours ? Number(a.actualHours) : undefined,
              weeklyDistribution: a.weeklyDistribution || [],
              isManualDistribution: Boolean(a.isManualDistribution),
            })
          }
        }
      }
    })

    console.log('Portfolio dataset seeded successfully into IndexedDB.')

    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000000'

      for (const item of portfolioData as any[]) {
        if (item.project) {
          const p = item.project
          await supabase.from('projects').upsert({
            id: p.id,
            user_id: userId,
            name: p.name,
            description: p.description || null,
            start_date: new Date(p.startDate).toISOString(),
            end_date: p.endDate ? new Date(p.endDate).toISOString() : null,
            working_days: p.config?.workingDays || [1, 2, 3, 4, 5],
            hours_per_day: p.config?.hoursPerDay || 8,
            use_global_holidays: true,
            skip_holidays_in_scheduling: true,
            default_duration: 5,
            version: 1
          })
        }

        if (item.resources && item.resources.length > 0) {
          const formattedRes = item.resources.map((r: any) => ({
            id: r.id,
            user_id: userId,
            name: r.name,
            email: r.email || null,
            tags: r.tags || [],
            max_hours_per_week: Number(r.maxHoursPerWeek || 40),
            cost_per_hour: r.costPerHour ? Number(r.costPerHour) : null,
            custom_working_days: r.calendar?.workingDays || [1, 2, 3, 4, 5]
          }))
          await supabase.from('resources').upsert(formattedRes)
        }

        if (item.tasks && item.tasks.length > 0) {
          const formattedTasks = item.tasks.map((t: any) => ({
            id: t.id,
            project_id: t.projectId,
            user_id: userId,
            name: t.name,
            description: t.description || null,
            wbs_code: t.wbsCode,
            parent_id: t.parentId || null,
            level: t.level !== undefined ? Number(t.level) : 0,
            duration: Number(t.duration || 1),
            start_date: new Date(t.startDate).toISOString(),
            end_date: new Date(t.endDate).toISOString(),
            constraint_type: t.constraintType || 'ASAP',
            constraint_date: t.constraintDate ? new Date(t.constraintDate).toISOString() : null,
            assigned_to: t.assignedTo || [],
            percent_complete: t.percentComplete ?? t.progress ?? 0,
            version: 1
          }))
          await supabase.from('tasks').upsert(formattedTasks)
        }

        if (item.dependencies && item.dependencies.length > 0) {
          const formattedDeps = item.dependencies.map((d: any) => ({
            id: d.id,
            project_id: d.projectId,
            user_id: userId,
            predecessor_id: d.predecessorId,
            successor_id: d.successorId,
            type: d.type || 'FS',
            lag: Number(d.lag || 0),
            version: 1
          }))
          await supabase.from('dependencies').upsert(formattedDeps)
        }

        if (item.milestones && item.milestones.length > 0) {
          const formattedMiles = item.milestones.map((m: any) => ({
            id: m.id,
            project_id: m.projectId,
            user_id: userId,
            name: m.name,
            date: new Date(m.date).toISOString(),
            linked_task_id: m.linkedTaskId || null,
            offset_days: m.offsetDays || null,
            description: m.description || null,
            version: 1
          }))
          await supabase.from('milestones').upsert(formattedMiles)
        }

        const assignmentsList = item.assignments || item.taskResourceAssignments || []
        if (assignmentsList.length > 0) {
          const formattedAsgs = assignmentsList.map((a: any) => ({
            id: a.id || crypto.randomUUID(),
            task_id: a.taskId || a.task_id,
            resource_id: a.resourceId || a.resource_id,
            planned_hours: Number(a.plannedHours || a.planned_hours || 8),
            actual_hours: a.actualHours ? Number(a.actualHours) : null,
            weekly_distribution: a.weeklyDistribution || [],
            is_manual_distribution: Boolean(a.isManualDistribution)
          }))
          await supabase.from('task_resource_assignments').upsert(formattedAsgs)
        }
      }
      console.log('Portfolio dataset successfully synced to Supabase cloud.')
    } catch (cloudErr) {
      console.warn('Cloud sync of portfolio dataset skipped:', cloudErr)
    }

    return true
  } catch (err) {
    console.error('Error seeding portfolio dataset:', err)
    return false
  }
}

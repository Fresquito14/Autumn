import portfolioData from '@/portfolio-completo.json'
import { db, dbHelpers } from './db'

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
    return true
  } catch (err) {
    console.error('Error seeding portfolio dataset:', err)
    return false
  }
}

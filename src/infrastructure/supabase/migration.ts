import { db } from '@/infrastructure/storage/dexie/db'
import { supabase } from './client'

export interface MigrationProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  message: string
  percent: number
}

/**
 * Migration script to transfer offline IndexedDB data (Dexie.js)
 * to relational PostgreSQL tables in Supabase.
 */
export async function migrateLocalDataToSupabase(
  userId: string,
  onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
  const reportProgress = (percent: number, message: string) => {
    if (onProgress) {
      onProgress({ status: 'running', message, percent })
    }
    console.log(`[Migration ${percent}%]: ${message}`)
  }

  try {
    reportProgress(0, 'Iniciando migración. Leyendo datos locales...')

    // 1. Read all local data from Dexie in parallel
    const [
      localProjects,
      localTasks,
      localDependencies,
      localResources,
      localAssignments,
      localTimeEntries,
      localMilestones,
      localBaselines,
      localGlobalHolidays,
    ] = await Promise.all([
      db.projects.toArray(),
      db.tasks.toArray(),
      db.dependencies.toArray(),
      db.resources.toArray(),
      db.taskResourceAssignments.toArray(),
      db.timeEntries.toArray(),
      db.milestones.toArray(),
      db.baselines.toArray(),
      db.globalHolidays.toArray(),
    ])

    reportProgress(10, 'Datos locales obtenidos. Limpiando datos en Supabase...')

    const projectIds = localProjects.map((p) => p.id)
    if (projectIds.length > 0) {
      await supabase.from('projects').delete().in('id', projectIds).eq('user_id', userId)
    }

    const resourceIds = localResources.map((r) => r.id)
    if (resourceIds.length > 0) {
      await supabase.from('resources').delete().in('id', resourceIds).eq('user_id', userId)
    }

    const holidayIds = localGlobalHolidays.map((h) => h.id)
    if (holidayIds.length > 0) {
      await supabase.from('global_holidays').delete().in('id', holidayIds).eq('user_id', userId)
    }

    // 2. Insert allowed email (Self-whitelist bypass check)
    reportProgress(15, 'Sincronizando información de lista blanca...')
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.email) {
      await supabase
        .from('allowed_users')
        .upsert({ email: userData.user.email })
    }

    // 3. Insert Global Holidays
    if (localGlobalHolidays.length > 0) {
      reportProgress(20, `Insertando ${localGlobalHolidays.length} feriados globales...`)
      const formattedGlobalHolidays = localGlobalHolidays.map((h) => ({
        id: h.id,
        user_id: userId,
        name: h.name,
        date: new Date(h.date).toISOString().split('T')[0],
        description: h.description || null,
        applies_to: h.appliesTo || [],
        is_recurring: h.isRecurring || false,
        version: 1,
      }))
      const { error } = await supabase.from('global_holidays').insert(formattedGlobalHolidays)
      if (error) throw new Error(`Global Holidays Migration failed: ${error.message}`)
    }

    // 4. Insert Resources & nested Resource vacations
    if (localResources.length > 0) {
      reportProgress(30, `Insertando ${localResources.length} recursos y sus vacaciones...`)
      const formattedResources = localResources.map((r) => ({
        id: r.id,
        user_id: userId,
        name: r.name,
        email: r.email || null,
        tags: r.tags || [],
        max_hours_per_week: r.maxHoursPerWeek ?? 40,
        cost_per_hour: r.costPerHour || null,
        custom_working_days: r.calendar?.customWorkingDays || null,
        version: 1,
      }))

      const { error: resError } = await supabase.from('resources').insert(formattedResources)
      if (resError) throw new Error(`Resources Migration failed: ${resError.message}`)

      const vacations: any[] = []
      localResources.forEach((r) => {
        if (r.calendar?.vacations && Array.isArray(r.calendar.vacations)) {
          r.calendar.vacations.forEach((vac: any) => {
            const startVal = vac.start || vac.startDate
            const endVal = vac.end || vac.endDate
            vacations.push({
              id: crypto.randomUUID(),
              resource_id: r.id,
              user_id: userId,
              start_date: new Date(startVal).toISOString().split('T')[0],
              end_date: new Date(endVal).toISOString().split('T')[0],
              version: 1,
            })
          })
        }
      })

      if (vacations.length > 0) {
        const { error: vacError } = await supabase.from('resource_vacations').insert(vacations)
        if (vacError) throw new Error(`Resource Vacations Migration failed: ${vacError.message}`)
      }
    }

    // 5. Insert Projects
    if (localProjects.length > 0) {
      reportProgress(45, `Insertando ${localProjects.length} proyectos...`)
      const formattedProjects = localProjects.map((p) => ({
        id: p.id,
        user_id: userId,
        name: p.name,
        description: p.description || null,
        start_date: new Date(p.startDate).toISOString().split('T')[0],
        end_date: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : null,
        working_days: p.config?.workingDays || [1, 2, 3, 4, 5],
        hours_per_day: p.config?.hoursPerDay ?? 8,
        use_global_holidays: p.config?.useGlobalHolidays ?? true,
        skip_holidays_in_scheduling: p.config?.skipHolidaysInScheduling ?? true,
        default_duration: p.config?.defaultDuration ?? 1,
        baseline_id: null,
        version: 1,
      }))

      const { error: projError } = await supabase.from('projects').insert(formattedProjects)
      if (projError) throw new Error(`Projects Migration failed: ${projError.message}`)

      const projectHolidays: any[] = []
      const excludedGlobalHolidays: any[] = []

      localProjects.forEach((p) => {
        if (p.config?.projectSpecificHolidays && Array.isArray(p.config.projectSpecificHolidays)) {
          p.config.projectSpecificHolidays.forEach((h) => {
            projectHolidays.push({
              id: h.id || crypto.randomUUID(),
              project_id: p.id,
              user_id: userId,
              date: new Date(h.date).toISOString().split('T')[0],
              name: h.name,
              description: h.description || null,
              applies_to: h.appliesTo || [],
              version: 1,
            })
          })
        }

        if (p.config?.excludedGlobalHolidayIds && Array.isArray(p.config.excludedGlobalHolidayIds)) {
          p.config.excludedGlobalHolidayIds.forEach((hId) => {
            excludedGlobalHolidays.push({
              project_id: p.id,
              global_holiday_id: hId,
            })
          })
        }
      })

      if (projectHolidays.length > 0) {
        const { error: projHolError } = await supabase.from('project_holidays').insert(projectHolidays)
        if (projHolError) throw new Error(`Project Holidays Migration failed: ${projHolError.message}`)
      }

      if (excludedGlobalHolidays.length > 0) {
        const { error: exclError } = await supabase.from('project_excluded_global_holidays').insert(excludedGlobalHolidays)
        if (exclError) throw new Error(`Project Excluded Holidays Migration failed: ${exclError.message}`)
      }
    }

    // 6. Insert Tasks & nested checklist items
    if (localTasks.length > 0) {
      reportProgress(60, `Insertando ${localTasks.length} tareas...`)
      const formattedTasks = localTasks.map((t) => ({
        id: t.id,
        project_id: t.projectId,
        user_id: userId,
        name: t.name,
        description: t.description || null,
        wbs_code: t.wbsCode,
        parent_id: t.parentId || null,
        level: t.level || 0,
        duration: t.duration || 1,
        start_date: new Date(t.startDate).toISOString(),
        end_date: new Date(t.endDate).toISOString(),
        constraint_type: t.constraintType || 'ASAP',
        constraint_date: t.constraintDate ? new Date(t.constraintDate).toISOString() : null,
        percent_complete: t.percentComplete ?? 0,
        actual_start_date: t.actualStartDate ? new Date(t.actualStartDate).toISOString() : null,
        actual_end_date: t.actualEndDate ? new Date(t.actualEndDate).toISOString() : null,
        actual_duration: t.actualDuration || null,
        notes: t.notes || null,
        tags: t.tags || [],
        version: 1,
      }))

      const { error: taskError } = await supabase.from('tasks').insert(formattedTasks)
      if (taskError) throw new Error(`Tasks Migration failed: ${taskError.message}`)

      const checklistItems: any[] = []
      localTasks.forEach((t) => {
        if (t.checklist && Array.isArray(t.checklist)) {
          t.checklist.forEach((item, index) => {
            checklistItems.push({
              id: item.id || crypto.randomUUID(),
              task_id: t.id,
              user_id: userId,
              text: item.text,
              completed: item.completed,
              position: index,
              version: 1,
            })
          })
        }
      })

      if (checklistItems.length > 0) {
        const { error: chkError } = await supabase.from('task_checklist_items').insert(checklistItems)
        if (chkError) throw new Error(`Checklist Items Migration failed: ${chkError.message}`)
      }
    }

    // 7. Insert Dependencies
    if (localDependencies.length > 0) {
      reportProgress(75, `Insertando ${localDependencies.length} dependencias de tareas...`)
      const formattedDeps = localDependencies.map((d) => ({
        id: d.id,
        project_id: d.projectId,
        user_id: userId,
        predecessor_id: d.predecessorId,
        successor_id: d.successorId,
        type: d.type || 'FS',
        lag: d.lag || 0,
        actual_lag: d.actualLag !== undefined && d.actualLag !== null ? d.actualLag : null,
        version: 1,
      }))

      const { error: depError } = await supabase.from('dependencies').insert(formattedDeps)
      if (depError) throw new Error(`Dependencies Migration failed: ${depError.message}`)
    }

    // 8. Insert Task Resource Assignments & weekly allocations
    if (localAssignments.length > 0) {
      reportProgress(80, `Insertando ${localAssignments.length} asignaciones de recursos...`)
      const formattedAssignments = localAssignments.map((a) => ({
        id: a.id,
        task_id: a.taskId,
        resource_id: a.resourceId,
        user_id: userId,
        planned_hours: a.plannedHours || 0,
        actual_hours: a.actualHours || null,
        is_manual_distribution: a.isManualDistribution || false,
        version: 1,
      }))

      const { error: assignError } = await supabase.from('task_resource_assignments').insert(formattedAssignments)
      if (assignError) throw new Error(`Assignments Migration failed: ${assignError.message}`)

      const weeklyAllocations: any[] = []
      localAssignments.forEach((a) => {
        if (a.weeklyDistribution && Array.isArray(a.weeklyDistribution)) {
          a.weeklyDistribution.forEach((wd) => {
            weeklyAllocations.push({
              id: crypto.randomUUID(),
              assignment_id: a.id,
              user_id: userId,
              week_start: new Date(wd.weekStart).toISOString().split('T')[0],
              working_days_in_week: wd.workingDaysInWeek,
              planned_hours: wd.plannedHours,
              actual_hours: wd.actualHours || null,
              version: 1,
            })
          })
        }
      })

      if (weeklyAllocations.length > 0) {
        const { error: wkError } = await supabase.from('weekly_allocations').insert(weeklyAllocations)
        if (wkError) throw new Error(`Weekly Allocations Migration failed: ${wkError.message}`)
      }
    }

    // 9. Insert Time Entries, Milestones, and Baselines
    if (localTimeEntries.length > 0) {
      reportProgress(85, `Insertando ${localTimeEntries.length} registros de tiempos...`)
      const formattedTime = localTimeEntries.map((te) => ({
        id: te.id,
        task_id: te.taskId,
        resource_id: te.resourceId,
        user_id: userId,
        date: new Date(te.date).toISOString().split('T')[0],
        hours: te.hours,
        notes: te.notes || null,
        version: 1,
      }))

      const { error: teError } = await supabase.from('time_entries').insert(formattedTime)
      if (teError) throw new Error(`Time Entries Migration failed: ${teError.message}`)
    }

    if (localMilestones.length > 0) {
      reportProgress(90, `Insertando ${localMilestones.length} hitos de proyecto...`)
      const formattedMilestones = localMilestones.map((m) => ({
        id: m.id,
        project_id: m.projectId,
        user_id: userId,
        name: m.name,
        date: new Date(m.date).toISOString(),
        linked_task_id: m.linkedTaskId || null,
        offset_days: m.offsetDays || 0,
        description: m.description || null,
        version: 1,
      }))

      const { error: mError } = await supabase.from('milestones').insert(formattedMilestones)
      if (mError) throw new Error(`Milestones Migration failed: ${mError.message}`)
    }

    if (localBaselines.length > 0) {
      reportProgress(95, `Insertando ${localBaselines.length} líneas base...`)
      const formattedBaselines = localBaselines.map((b) => ({
        id: b.id,
        project_id: b.projectId,
        user_id: userId,
        name: b.name,
        snapshot: b.snapshot,
        version: 1,
      }))

      const { error: bError } = await supabase.from('baselines').insert(formattedBaselines)
      if (bError) throw new Error(`Baselines Migration failed: ${bError.message}`)

      for (const p of localProjects) {
        if (p.baselineId) {
          await supabase
            .from('projects')
            .update({ baseline_id: p.baselineId, version: 2 })
            .eq('id', p.id)
            .eq('version', 1)
        }
      }
    }

    reportProgress(100, 'Migración completada con éxito.')
    if (onProgress) {
      onProgress({ status: 'completed', message: 'Migración exitosa.', percent: 100 })
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error(`Error de migración: ${errorMsg}`)
    if (onProgress) {
      onProgress({ status: 'failed', message: `Migración fallida: ${errorMsg}`, percent: 0 })
    }
    throw error
  }
}

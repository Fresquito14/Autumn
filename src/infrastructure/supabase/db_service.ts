import { supabase } from './client'
import { db } from '@/infrastructure/storage/dexie/db'
import type { Project, Task, Dependency, Milestone, Resource, TaskResourceAssignment, GlobalHoliday } from '@/domain/models'
import { getWbsLevel } from '@/domain/calculations/wbs'

export interface ProjectSyncData {
  project: Project
  tasks: Task[]
  dependencies: Dependency[]
  milestones: Milestone[]
}

export const supabaseSyncService = {
  /**
   * Fetches the complete project data from Supabase.
   */
  async loadProjectFromCloud(projectId: string): Promise<{ data: ProjectSyncData; version: number }> {
    const { data: projectRow, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle()

    if (projErr) throw projErr
    if (!projectRow) {
      return { data: null as any, version: 0 }
    }

    const [tasksRes, depsRes, milesRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId),
      supabase.from('dependencies').select('*').eq('project_id', projectId),
      supabase.from('milestones').select('*').eq('project_id', projectId),
    ])

    if (tasksRes.error) throw tasksRes.error
    if (depsRes.error) throw depsRes.error
    if (milesRes.error) throw milesRes.error

    const taskIds = tasksRes.data.map((t: any) => t.id)
    let checklistItems: any[] = []
    if (taskIds.length > 0) {
      const chkRes = await supabase.from('task_checklist_items').select('*').in('task_id', taskIds)
      if (chkRes.error) throw chkRes.error
      checklistItems = chkRes.data
    }

    const project: Project = {
      id: projectRow.id,
      name: projectRow.name,
      description: projectRow.description || undefined,
      startDate: new Date(projectRow.start_date),
      endDate: projectRow.end_date ? new Date(projectRow.end_date) : undefined,
      createdAt: new Date(projectRow.created_at),
      updatedAt: new Date(projectRow.updated_at),
      baselineId: projectRow.baseline_id || undefined,
      userId: projectRow.user_id || undefined,
      organizationId: projectRow.organization_id || undefined,
      config: {
        workingDays: projectRow.working_days,
        hoursPerDay: Number(projectRow.hours_per_day),
        useGlobalHolidays: projectRow.use_global_holidays,
        excludedGlobalHolidayIds: [],
        projectSpecificHolidays: [],
        skipHolidaysInScheduling: projectRow.skip_holidays_in_scheduling,
        defaultDuration: Number(projectRow.default_duration),
      },
    }

    const tasks: Task[] = tasksRes.data.map((t: any) => {
      const taskChecklist = checklistItems
        .filter((c: any) => c.task_id === t.id)
        .sort((a, b) => a.position - b.position)
        .map((c: any) => ({
          id: c.id,
          text: c.text,
          completed: c.completed,
        }))

      return {
        id: t.id,
        projectId: t.project_id,
        name: t.name,
        description: t.description || undefined,
        wbsCode: t.wbs_code,
        parentId: t.parent_id || undefined,
        level: (t.level !== undefined && t.level !== null) ? Number(t.level) : (t.wbs_code ? getWbsLevel(t.wbs_code) : 0),
        duration: Number(t.duration),
        startDate: new Date(t.start_date),
        endDate: new Date(t.end_date),
        constraintType: t.constraint_type || undefined,
        constraintDate: t.constraint_date ? new Date(t.constraint_date) : undefined,
        assignedTo: t.assigned_to || [],
        percentComplete: Number(t.percent_complete),
        actualStartDate: t.actual_start_date ? new Date(t.actual_start_date) : undefined,
        actualEndDate: t.actual_end_date ? new Date(t.actual_end_date) : undefined,
        actualDuration: t.actual_duration ? Number(t.actual_duration) : undefined,
        notes: t.notes || undefined,
        checklist: taskChecklist,
        tags: t.tags || [],
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      }
    })

    const dependencies: Dependency[] = depsRes.data.map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      predecessorId: d.predecessor_id,
      successorId: d.successor_id,
      type: d.type,
      lag: Number(d.lag),
      actualLag: d.actual_lag !== undefined && d.actual_lag !== null ? Number(d.actual_lag) : undefined,
    }))

    const milestones: Milestone[] = milesRes.data.map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      name: m.name,
      date: new Date(m.date),
      linkedTaskId: m.linked_task_id || undefined,
      offsetDays: m.offset_days || undefined,
      description: m.description || undefined,
    }))

    return {
      data: { project, tasks, dependencies, milestones },
      version: projectRow.version,
    }
  },

  /**
   * Saves the project data to Supabase using differential sync and optimistic concurrency.
   */
  async saveProjectToCloud(
    projectId: string,
    data: ProjectSyncData,
    version: number
  ): Promise<{ success: boolean; version: number }> {
    const { project, tasks, dependencies, milestones } = data
    const nextVersion = version + 1

    const { data: projUpdate, error: projErr } = await supabase
      .from('projects')
      .update({
        name: project.name,
        description: project.description || null,
        start_date: new Date(project.startDate).toISOString().split('T')[0],
        end_date: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : null,
        working_days: project.config.workingDays,
        hours_per_day: project.config.hoursPerDay,
        use_global_holidays: project.config.useGlobalHolidays,
        skip_holidays_in_scheduling: project.config.skipHolidaysInScheduling,
        default_duration: project.config.defaultDuration,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('version', version)
      .select('version')

    if (projErr) {
      throw projErr
    }

    if (!projUpdate || projUpdate.length === 0) {
      const { data: currentProj } = await supabase
        .from('projects')
        .select('version')
        .eq('id', projectId)
        .maybeSingle()

      if (currentProj && Number(currentProj.version) >= nextVersion) {
        return { success: true, version: Number(currentProj.version) }
      }

      if (!currentProj) {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) throw new Error('User not authenticated')

        const { error: insertErr } = await supabase
          .from('projects')
          .insert({
            id: project.id,
            user_id: userId,
            organization_id: project.organizationId || null,
            name: project.name,
            description: project.description || null,
            start_date: new Date(project.startDate).toISOString().split('T')[0],
            end_date: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : null,
            working_days: project.config.workingDays,
            hours_per_day: project.config.hoursPerDay,
            use_global_holidays: project.config.useGlobalHolidays,
            skip_holidays_in_scheduling: project.config.skipHolidaysInScheduling,
            default_duration: project.config.defaultDuration,
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (insertErr) throw insertErr
      } else {
        const err: any = new Error('Optimistic concurrency collision')
        err.code = 'CONCURRENCY_ERROR'
        throw err
      }
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { data: serverTasks, error: sTasksErr } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
    if (sTasksErr) throw sTasksErr

    const serverTaskIds = serverTasks.map((t: any) => t.id)
    const localTaskIds = tasks.map((t) => t.id)
    const tasksToDelete = serverTaskIds.filter((id) => !localTaskIds.includes(id))

    if (tasksToDelete.length > 0) {
      const { error: delErr } = await supabase.from('tasks').delete().in('id', tasksToDelete)
      if (delErr) throw delErr
    }

    if (tasks.length > 0) {
      const formattedTasks = tasks.map((t) => ({
        id: t.id,
        project_id: projectId,
        user_id: userId,
        name: t.name,
        description: t.description || null,
        wbs_code: t.wbsCode,
        parent_id: t.parentId || null,
        level: t.level,
        duration: t.duration,
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
        version: nextVersion,
      }))

      const { error: upsertErr } = await supabase.from('tasks').upsert(formattedTasks)
      if (upsertErr) throw upsertErr

      const checklistItemsToUpsert: any[] = []
      tasks.forEach((t) => {
        if (t.checklist) {
          t.checklist.forEach((item, index) => {
            checklistItemsToUpsert.push({
              id: item.id || crypto.randomUUID(),
              task_id: t.id,
              user_id: userId,
              text: item.text,
              completed: item.completed,
              position: index,
              version: nextVersion,
            })
          })
        }
      })

      if (checklistItemsToUpsert.length > 0) {
        const { error: chkErr } = await supabase.from('task_checklist_items').upsert(checklistItemsToUpsert)
        if (chkErr) throw chkErr
      }
    }

    const { data: serverDeps, error: sDepsErr } = await supabase
      .from('dependencies')
      .select('id')
      .eq('project_id', projectId)
    if (sDepsErr) throw sDepsErr

    const serverDepIds = serverDeps.map((d: any) => d.id)
    const localDepIds = dependencies.map((d) => d.id)
    const depsToDelete = serverDepIds.filter((id) => !localDepIds.includes(id))

    if (depsToDelete.length > 0) {
      const { error: delDepErr } = await supabase.from('dependencies').delete().in('id', depsToDelete)
      if (delDepErr) throw delDepErr
    }

    if (dependencies.length > 0) {
      const formattedDeps = dependencies.map((d) => ({
        id: d.id,
        project_id: projectId,
        user_id: userId,
        predecessor_id: d.predecessorId,
        successor_id: d.successorId,
        type: d.type || 'FS',
        lag: d.lag || 0,
        actual_lag: d.actualLag !== undefined && d.actualLag !== null ? d.actualLag : null,
        version: nextVersion,
      }))
      const { error: depUpsertErr } = await supabase.from('dependencies').upsert(formattedDeps)
      if (depUpsertErr) throw depUpsertErr
    }

    const { data: serverMilestones, error: sMilesErr } = await supabase
      .from('milestones')
      .select('id')
      .eq('project_id', projectId)
    if (sMilesErr) throw sMilesErr

    const serverMileIds = serverMilestones.map((m: any) => m.id)
    const localMileIds = milestones.map((m) => m.id)
    const milesToDelete = serverMileIds.filter((id) => !localMileIds.includes(id))

    if (milesToDelete.length > 0) {
      const { error: delMileErr } = await supabase.from('milestones').delete().in('id', milesToDelete)
      if (delMileErr) throw delMileErr
    }

    if (milestones.length > 0) {
      const formattedMilestones = milestones.map((m) => ({
        id: m.id,
        project_id: projectId,
        user_id: userId,
        name: m.name,
        date: new Date(m.date).toISOString(),
        linked_task_id: m.linkedTaskId || null,
        offset_days: m.offsetDays || 0,
        description: m.description || null,
        version: nextVersion,
      }))
      const { error: mileUpsertErr } = await supabase.from('milestones').upsert(formattedMilestones)
      if (mileUpsertErr) throw mileUpsertErr
    }

    return { success: true, version: nextVersion }
  },

  /**
   * Applies cloud-downloaded project changes into the local IndexedDB database (Dexie).
   */
  async applyCloudDataToLocal(data: ProjectSyncData): Promise<void> {
    const { project, tasks, dependencies, milestones } = data
    const projectId = project.id

    await db.transaction('rw', [db.projects, db.tasks, db.dependencies, db.milestones], async () => {
      await db.projects.put(project)

      await db.tasks.where('projectId').equals(projectId).delete()
      if (tasks.length > 0) {
        await db.tasks.bulkAdd(tasks)
      }

      await db.dependencies.where('projectId').equals(projectId).delete()
      if (dependencies.length > 0) {
        await db.dependencies.bulkAdd(dependencies)
      }

      await db.milestones.where('projectId').equals(projectId).delete()
      if (milestones.length > 0) {
        await db.milestones.bulkAdd(milestones)
      }
    })
  },

  /**
   * Fetches all projects, tasks, dependencies, and milestones from Supabase
   * and syncs them into local IndexedDB (Dexie).
   */
  async fetchAllProjectsFromCloud(): Promise<Project[]> {
    const { data: projectRows, error: pErr } = await supabase
      .from('projects')
      .select('*')

    if (pErr) throw pErr
    if (!projectRows || projectRows.length === 0) return []

    const [tasksRes, depsRes, milesRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('dependencies').select('*'),
      supabase.from('milestones').select('*'),
    ])

    if (tasksRes.error) throw tasksRes.error
    if (depsRes.error) throw depsRes.error
    if (milesRes.error) throw milesRes.error

    const taskIds = (tasksRes.data || []).map((t: any) => t.id)
    let checklistItems: any[] = []
    if (taskIds.length > 0) {
      const chkRes = await supabase.from('task_checklist_items').select('*').in('task_id', taskIds)
      if (!chkRes.error && chkRes.data) {
        checklistItems = chkRes.data
      }
    }

    const projects: Project[] = projectRows.map((projectRow: any) => ({
      id: projectRow.id,
      name: projectRow.name,
      description: projectRow.description || undefined,
      startDate: new Date(projectRow.start_date),
      endDate: projectRow.end_date ? new Date(projectRow.end_date) : undefined,
      createdAt: new Date(projectRow.created_at),
      updatedAt: new Date(projectRow.updated_at),
      baselineId: projectRow.baseline_id || undefined,
      version: projectRow.version,
      userId: projectRow.user_id || undefined,
      organizationId: projectRow.organization_id || undefined,
      config: {
        workingDays: projectRow.working_days || [1, 2, 3, 4, 5],
        hoursPerDay: Number(projectRow.hours_per_day || 8),
        useGlobalHolidays: projectRow.use_global_holidays ?? true,
        excludedGlobalHolidayIds: [],
        projectSpecificHolidays: [],
        skipHolidaysInScheduling: projectRow.skip_holidays_in_scheduling ?? true,
        defaultDuration: Number(projectRow.default_duration || 5),
      },
    }))

    const tasks: Task[] = (tasksRes.data || []).map((t: any) => {
      const taskChecklist = checklistItems
        .filter((c: any) => c.task_id === t.id)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((c: any) => ({
          id: c.id,
          text: c.text,
          completed: c.completed,
        }))

      return {
        id: t.id,
        projectId: t.project_id,
        name: t.name,
        description: t.description || undefined,
        wbsCode: t.wbs_code,
        parentId: t.parent_id || undefined,
        level: (t.level !== undefined && t.level !== null) ? Number(t.level) : (t.wbs_code ? getWbsLevel(t.wbs_code) : 0),
        duration: Number(t.duration),
        startDate: new Date(t.start_date),
        endDate: new Date(t.end_date),
        constraintType: t.constraint_type || undefined,
        constraintDate: t.constraint_date ? new Date(t.constraint_date) : undefined,
        assignedTo: t.assigned_to || [],
        percentComplete: Number(t.percent_complete || 0),
        actualStartDate: t.actual_start_date ? new Date(t.actual_start_date) : undefined,
        actualEndDate: t.actual_end_date ? new Date(t.actual_end_date) : undefined,
        actualDuration: t.actual_duration ? Number(t.actual_duration) : undefined,
        notes: t.notes || undefined,
        checklist: taskChecklist,
        tags: t.tags || [],
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      }
    })

    const dependencies: Dependency[] = (depsRes.data || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      predecessorId: d.predecessor_id,
      successorId: d.successor_id,
      type: d.type || 'FS',
      lag: Number(d.lag || 0),
    }))

    const milestones: Milestone[] = (milesRes.data || []).map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      name: m.name,
      date: new Date(m.date),
      linkedTaskId: m.linked_task_id || undefined,
      offsetDays: m.offset_days || undefined,
      description: m.description || undefined,
    }))

    await db.transaction('rw', [db.projects, db.tasks, db.dependencies, db.milestones], async () => {
      for (const proj of projects) {
        await db.projects.put(proj)
      }
      for (const task of tasks) {
        await db.tasks.put(task)
      }
      for (const dep of dependencies) {
        await db.dependencies.put(dep)
      }
      for (const mile of milestones) {
        await db.milestones.put(mile)
      }
    })

    return projects
  },

  /**
   * Fetches all resources and vacations from Supabase and syncs to IndexedDB.
   */
  async fetchResourcesFromCloud(): Promise<Resource[]> {
    const [resRes, vacRes] = await Promise.all([
      supabase.from('resources').select('*'),
      supabase.from('resource_vacations').select('*'),
    ])

    if (resRes.error) throw resRes.error
    if (!resRes.data || resRes.data.length === 0) return []

    const vacations = vacRes.data || []

    const resources: Resource[] = resRes.data.map((r: any) => {
      const resVacations = vacations
        .filter((v: any) => v.resource_id === r.id)
        .map((v: any) => {
          const s = new Date(v.start_date || v.startDate || v.start)
          const e = new Date(v.end_date || v.endDate || v.end)
          return {
            id: v.id,
            start: s,
            end: e,
            startDate: s,
            endDate: e,
          }
        })

      return {
        id: r.id,
        name: r.name,
        email: r.email || undefined,
        tags: r.tags || [],
        maxHoursPerWeek: Number(r.max_hours_per_week || 40),
        costPerHour: r.cost_per_hour ? Number(r.cost_per_hour) : undefined,
        calendar: {
          customWorkingDays: r.custom_working_days || [1, 2, 3, 4, 5],
          vacations: resVacations,
        },
      }
    })

    await db.transaction('rw', [db.resources], async () => {
      for (const res of resources) {
        await db.resources.put(res)
      }
    })

    return resources
  },

  /**
   * Syncs resources to Supabase cloud table.
   */
  async syncResourcesToCloud(resources: Resource[]): Promise<void> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) return

      const formattedResources = resources.map(r => ({
        id: r.id,
        user_id: userId,
        name: r.name,
        email: r.email || null,
        tags: r.tags || [],
        max_hours_per_week: Number(r.maxHoursPerWeek || 40),
        cost_per_hour: r.costPerHour ? Number(r.costPerHour) : null,
        custom_working_days: r.calendar?.customWorkingDays || [1, 2, 3, 4, 5]
      }))

      const { error } = await supabase.from('resources').upsert(formattedResources)
      if (error) {
        console.warn('Cloud sync of resources skipped:', error)
      }
    } catch (err) {
      console.warn('Error syncing resources to cloud:', err)
    }
  },

  /**
   * Fetches task resource assignments from Supabase and syncs to IndexedDB.
   */
  async fetchAssignmentsFromCloud(): Promise<TaskResourceAssignment[]> {
    const { data, error } = await supabase.from('task_resource_assignments').select('*')
    if (error) throw error
    if (!data || data.length === 0) return []

    const assignments: TaskResourceAssignment[] = data.map((a: any) => ({
      id: a.id,
      taskId: a.task_id,
      resourceId: a.resource_id,
      plannedHours: Number(a.planned_hours || 0),
      actualHours: a.actual_hours ? Number(a.actual_hours) : undefined,
      weeklyDistribution: a.weekly_distribution || [],
      isManualDistribution: Boolean(a.is_manual_distribution),
    }))

    await db.transaction('rw', [db.taskResourceAssignments, db.tasks], async () => {
      for (const assign of assignments) {
        await db.taskResourceAssignments.put(assign)
      }

      const taskResourceMap = new Map<string, Set<string>>()
      for (const assign of assignments) {
        if (!taskResourceMap.has(assign.taskId)) {
          taskResourceMap.set(assign.taskId, new Set())
        }
        taskResourceMap.get(assign.taskId)!.add(assign.resourceId)
      }

      for (const [tId, resSet] of taskResourceMap.entries()) {
        const existingTask = await db.tasks.get(tId)
        if (existingTask) {
          await db.tasks.update(tId, {
            assignedTo: Array.from(resSet)
          })
        }
      }
    })

    return assignments
  },

  /**
   * Fetches global holidays from Supabase and syncs to IndexedDB.
   */
  async fetchGlobalHolidaysFromCloud(): Promise<GlobalHoliday[]> {
    const { data, error } = await supabase.from('global_holidays').select('*')
    if (error) throw error
    if (!data || data.length === 0) return []

    const holidays: GlobalHoliday[] = data.map((h: any) => ({
      id: h.id,
      name: h.name,
      date: new Date(h.date),
      description: h.description || undefined,
      appliesTo: h.applies_to || [],
      isRecurring: Boolean(h.is_recurring),
      createdAt: new Date(h.created_at || Date.now()),
      updatedAt: new Date(h.updated_at || Date.now()),
    }))

    await db.transaction('rw', [db.globalHolidays], async () => {
      for (const hol of holidays) {
        await db.globalHolidays.put(hol)
      }
    })

    return holidays
  },

  /**
   * Performs full database sync from cloud into local IndexedDB.
   */
  async syncFullDatabaseFromCloud(): Promise<void> {
    await Promise.all([
      supabaseSyncService.fetchAllProjectsFromCloud().catch(() => []),
      supabaseSyncService.fetchResourcesFromCloud().catch(() => []),
      supabaseSyncService.fetchAssignmentsFromCloud().catch(() => []),
      supabaseSyncService.fetchGlobalHolidaysFromCloud().catch(() => []),
    ])
  },
}

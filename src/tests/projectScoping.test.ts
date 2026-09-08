import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbHelpers } from '@/lib/storage/db'
import type { Task, Project } from '@/types'

describe('Project Scoping & Task Invariant Assurance', () => {
  const projectId1 = 'project-alpha-123'
  const projectId2 = 'project-beta-456'

  beforeEach(async () => {
    await db.projects.clear()
    await db.tasks.clear()

    const proj1: Project = {
      id: projectId1,
      name: 'Project Alpha',
      startDate: new Date('2026-08-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        workingDays: [1, 2, 3, 4, 5],
        hoursPerDay: 8,
        useGlobalHolidays: true,
        excludedGlobalHolidayIds: [],
        projectSpecificHolidays: [],
        skipHolidaysInScheduling: true,
        defaultDuration: 5,
      },
    }

    const proj2: Project = {
      id: projectId2,
      name: 'Project Beta',
      startDate: new Date('2026-08-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        workingDays: [1, 2, 3, 4, 5],
        hoursPerDay: 8,
        useGlobalHolidays: true,
        excludedGlobalHolidayIds: [],
        projectSpecificHolidays: [],
        skipHolidaysInScheduling: true,
        defaultDuration: 5,
      },
    }

    await db.projects.bulkAdd([proj1, proj2])
  })

  it('should strictly preserve task projectId when updateTask is called with attempted projectId change', async () => {
    const task: Task = {
      id: 'task-100',
      projectId: projectId1,
      name: 'Original Task in Alpha',
      wbsCode: '1',
      level: 0,
      duration: 3,
      startDate: new Date('2026-08-03'),
      endDate: new Date('2026-08-06'),
      assignedTo: [],
      checklist: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await dbHelpers.createTask(task)

    // Attempt to illegally overwrite projectId to projectId2
    await dbHelpers.updateTask(task.id, {
      name: 'Renamed Task',
      projectId: projectId2 as any,
    })

    const storedTask = await dbHelpers.getTask(task.id)
    expect(storedTask).toBeDefined()
    expect(storedTask?.name).toBe('Renamed Task')
    // 🛡️ projectId MUST remain unchanged
    expect(storedTask?.projectId).toBe(projectId1)
  })

  it('should isolate tasks strictly by projectId query', async () => {
    const taskA: Task = {
      id: 'task-A',
      projectId: projectId1,
      name: 'Alpha Task',
      wbsCode: '1',
      level: 0,
      duration: 2,
      startDate: new Date('2026-08-03'),
      endDate: new Date('2026-08-05'),
      assignedTo: [],
      checklist: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const taskB: Task = {
      id: 'task-B',
      projectId: projectId2,
      name: 'Beta Task',
      wbsCode: '1',
      level: 0,
      duration: 4,
      startDate: new Date('2026-08-03'),
      endDate: new Date('2026-08-07'),
      assignedTo: [],
      checklist: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.tasks.bulkAdd([taskA, taskB])

    const alphaTasks = await dbHelpers.getProjectTasks(projectId1)
    const betaTasks = await dbHelpers.getProjectTasks(projectId2)

    expect(alphaTasks.map((t) => t.id)).toEqual(['task-A'])
    expect(betaTasks.map((t) => t.id)).toEqual(['task-B'])
  })

  it('should successfully update and unassign project organizationId via dbHelpers', async () => {
    const orgId = 'org-corporate-999'

    // 1. Assign project to organization
    await dbHelpers.updateProject(projectId1, { organizationId: orgId })
    let project = await dbHelpers.getProject(projectId1)
    expect(project?.organizationId).toBe(orgId)

    // 2. Change to another organization
    const orgId2 = 'org-corporate-888'
    await dbHelpers.updateProject(projectId1, { organizationId: orgId2 })
    project = await dbHelpers.getProject(projectId1)
    expect(project?.organizationId).toBe(orgId2)

    // 3. Unassign organization (set to null)
    await dbHelpers.updateProject(projectId1, { organizationId: null })
    project = await dbHelpers.getProject(projectId1)
    expect(project?.organizationId).toBeUndefined()
  })
})

import { describe, it, expect } from 'vitest'
import {
  getTaskTemporalStatus,
  filterAndSortMyTasks,
} from '@/domain/calculations/my-tasks'
import type { Task } from '@/types'

describe('MyTasks Domain Calculations', () => {
  const refDate = new Date('2026-06-15T12:00:00')

  const createTask = (overrides: Partial<Task>): Task => ({
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    name: 'Task sample',
    wbsCode: '1.1',
    level: 1,
    duration: 5,
    startDate: new Date('2026-06-10'),
    endDate: new Date('2026-06-16'),
    assignedTo: ['res-1'],
    checklist: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  describe('getTaskTemporalStatus', () => {
    it('should identify completed task by percentComplete or actualDuration', () => {
      const task1 = createTask({ percentComplete: 100 })
      const task2 = createTask({ actualDuration: 5 })
      expect(getTaskTemporalStatus(task1, refDate)).toBe('completed')
      expect(getTaskTemporalStatus(task2, refDate)).toBe('completed')
    })

    it('should identify active task when reference date is within task date range', () => {
      const task = createTask({
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-20'),
      })
      expect(getTaskTemporalStatus(task, refDate)).toBe('active')
    })

    it('should identify overdue task when end date has passed without completion', () => {
      const task = createTask({
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-10'),
      })
      expect(getTaskTemporalStatus(task, refDate)).toBe('overdue')
    })

    it('should identify upcoming task when start date is in the future', () => {
      const task = createTask({
        startDate: new Date('2026-06-20'),
        endDate: new Date('2026-06-25'),
      })
      expect(getTaskTemporalStatus(task, refDate)).toBe('upcoming')
    })
  })

  describe('filterAndSortMyTasks', () => {
    const tasks: Task[] = [
      createTask({
        id: 't1',
        name: 'Active Task 1',
        wbsCode: '1.1',
        startDate: new Date('2026-06-12'),
        endDate: new Date('2026-06-18'),
        assignedTo: ['res-1'],
        projectId: 'proj-1',
      }),
      createTask({
        id: 't2',
        name: 'Upcoming Task 2',
        wbsCode: '1.2',
        startDate: new Date('2026-06-22'),
        endDate: new Date('2026-06-28'),
        assignedTo: ['res-1'],
        projectId: 'proj-1',
      }),
      createTask({
        id: 't3',
        name: 'Completed Task 3',
        wbsCode: '2.1',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-08'),
        assignedTo: ['res-1'],
        percentComplete: 100,
        projectId: 'proj-2',
      }),
      createTask({
        id: 't4',
        name: 'Other Resource Task',
        wbsCode: '1.3',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-15'),
        assignedTo: ['res-2'],
        projectId: 'proj-1',
      }),
    ]

    it('should only return tasks assigned to the given resource', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'all',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t3', 't1', 't2'])
      expect(result.some((t) => t.id === 't4')).toBe(false)
    })

    it('should filter by active status (including overdue)', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'active',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t1'])
    })

    it('should filter by upcoming status', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'upcoming',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t2'])
    })

    it('should filter by completed status', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'completed',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t3'])
    })

    it('should filter by project', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'all',
        projectId: 'proj-1',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('should filter by search query', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'res-1',
        statusFilter: 'all',
        searchQuery: 'Upcoming',
        referenceDate: refDate,
      })

      expect(result.map((t) => t.id)).toEqual(['t2'])
    })

    it('should return all tasks when resourceId is all', () => {
      const result = filterAndSortMyTasks({
        tasks,
        resourceId: 'all',
        statusFilter: 'all',
        referenceDate: refDate,
      })

      expect(result.length).toBe(4)
    })

    it('should match task by assignments array if assignedTo is empty', () => {
      const unassignedTask = createTask({
        id: 't5',
        name: 'Assignment only task',
        assignedTo: [],
      })
      const result = filterAndSortMyTasks({
        tasks: [unassignedTask],
        resourceId: 'res-1',
        statusFilter: 'all',
        assignments: [
          {
            id: 'a1',
            taskId: 't5',
            resourceId: 'res-1',
            plannedHours: 10,
            weeklyDistribution: [],
            isManualDistribution: false,
          },
        ],
        referenceDate: refDate,
      })

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('t5')
    })
  })
})

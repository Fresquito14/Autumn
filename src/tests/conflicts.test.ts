import { describe, it, expect } from 'vitest'
import {
  doIntervalsOverlap,
  calculateOverlapDays,
  detectTaskConflicts,
} from '@/domain/calculations/conflicts'
import type { Task } from '@/types'

describe('Task Scheduling Conflict Detection', () => {
  describe('doIntervalsOverlap', () => {
    it('returns true when intervals overlap partially', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-10T00:00:00')
      const startB = new Date('2026-10-05T00:00:00')
      const endB = new Date('2026-10-15T00:00:00')

      expect(doIntervalsOverlap(startA, endA, startB, endB)).toBe(true)
      expect(doIntervalsOverlap(startB, endB, startA, endA)).toBe(true)
    })

    it('returns true when one interval is completely inside another', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-30T00:00:00')
      const startB = new Date('2026-10-10T00:00:00')
      const endB = new Date('2026-10-15T00:00:00')

      expect(doIntervalsOverlap(startA, endA, startB, endB)).toBe(true)
    })

    it('returns true when intervals touch on the same day (boundary)', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-05T00:00:00')
      const startB = new Date('2026-10-05T00:00:00')
      const endB = new Date('2026-10-10T00:00:00')

      expect(doIntervalsOverlap(startA, endA, startB, endB)).toBe(true)
    })

    it('returns false when intervals do not overlap', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-05T00:00:00')
      const startB = new Date('2026-10-06T00:00:00')
      const endB = new Date('2026-10-10T00:00:00')

      expect(doIntervalsOverlap(startA, endA, startB, endB)).toBe(false)
    })
  })

  describe('calculateOverlapDays', () => {
    it('calculates exact overlap days count inclusive', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-07T00:00:00')
      const startB = new Date('2026-10-05T00:00:00')
      const endB = new Date('2026-10-10T00:00:00')

      // Overlap: 5, 6, 7 (3 days)
      expect(calculateOverlapDays(startA, endA, startB, endB)).toBe(3)
    })

    it('returns 1 day for boundary touch on single date', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-05T00:00:00')
      const startB = new Date('2026-10-05T00:00:00')
      const endB = new Date('2026-10-10T00:00:00')

      expect(calculateOverlapDays(startA, endA, startB, endB)).toBe(1)
    })

    it('returns 0 for non-overlapping dates', () => {
      const startA = new Date('2026-10-01T00:00:00')
      const endA = new Date('2026-10-05T00:00:00')
      const startB = new Date('2026-10-10T00:00:00')
      const endB = new Date('2026-10-15T00:00:00')

      expect(calculateOverlapDays(startA, endA, startB, endB)).toBe(0)
    })
  })

  describe('detectTaskConflicts', () => {
    it('identifies concurrent tasks assigned to the same resource across different projects', () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          projectId: 'proj-alpha',
          name: 'Diseño UX',
          startDate: new Date('2026-10-05T00:00:00'),
          endDate: new Date('2026-10-15T00:00:00'),
          duration: 9,
          level: 0,
          wbsCode: '1',
          assignedTo: ['res-1'],
          checklist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          projectId: 'proj-beta',
          name: 'Desarrollo API',
          startDate: new Date('2026-10-10T00:00:00'),
          endDate: new Date('2026-10-20T00:00:00'),
          duration: 9,
          level: 0,
          wbsCode: '1',
          assignedTo: ['res-1'],
          checklist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          projectId: 'proj-gamma',
          name: 'Revisión Final',
          startDate: new Date('2026-10-25T00:00:00'),
          endDate: new Date('2026-10-30T00:00:00'),
          duration: 5,
          level: 0,
          wbsCode: '1',
          assignedTo: ['res-1'],
          checklist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const conflicts = detectTaskConflicts(mockTasks)

      // task-1 and task-2 overlap from Oct 10 to Oct 15 (6 days)
      const c1 = conflicts.get('task-1')
      expect(c1?.hasConflict).toBe(true)
      expect(c1?.conflictingTasks).toHaveLength(1)
      expect(c1?.conflictingTasks[0].id).toBe('task-2')
      expect(c1?.totalOverlapDays).toBe(6)

      const c2 = conflicts.get('task-2')
      expect(c2?.hasConflict).toBe(true)
      expect(c2?.conflictingTasks[0].id).toBe('task-1')

      // task-3 has no conflict
      const c3 = conflicts.get('task-3')
      expect(c3?.hasConflict).toBe(false)
      expect(c3?.conflictingTasks).toHaveLength(0)
    })

    it('ignores tasks marked as 100% completed', () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          projectId: 'p1',
          name: 'Tarea En Curso',
          startDate: new Date('2026-10-05T00:00:00'),
          endDate: new Date('2026-10-15T00:00:00'),
          duration: 9,
          level: 0,
          wbsCode: '1',
          percentComplete: 30,
          assignedTo: ['res-1'],
          checklist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          projectId: 'p2',
          name: 'Tarea Ya Finalizada',
          startDate: new Date('2026-10-05T00:00:00'),
          endDate: new Date('2026-10-15T00:00:00'),
          duration: 9,
          level: 0,
          wbsCode: '2',
          percentComplete: 100, // Completed
          assignedTo: ['res-1'],
          checklist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const conflicts = detectTaskConflicts(mockTasks)
      expect(conflicts.get('task-1')?.hasConflict).toBe(false)
      expect(conflicts.get('task-2')?.hasConflict).toBe(false)
    })
  })
})

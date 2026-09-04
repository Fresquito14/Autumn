import { describe, it, expect } from 'vitest'
import {
  getTimelineBounds,
  calculateTaskBarPosition,
  calculateTimelineDimensions,
  generateTimelineScale,
  rollupParentActualDates,
} from '@/domain/calculations/dates'
import { addDays } from 'date-fns'

describe('Gantt Alignment and Timeline Bounds', () => {
  describe('getTimelineBounds with delays and actual dates', () => {
    it('should expand timelineEnd when actualEndDate exceeds planned endDate', () => {
      const plannedStart = new Date('2026-10-05T00:00:00') // Monday
      const plannedEnd = new Date('2026-10-16T00:00:00') // Friday (2 weeks)
      const delayedActualEnd = new Date('2026-11-20T00:00:00') // Delayed by over a month

      const tasks = [
        {
          startDate: plannedStart,
          endDate: plannedEnd,
          actualStartDate: plannedStart,
          actualEndDate: delayedActualEnd,
        },
      ]

      const bounds = getTimelineBounds(tasks)

      // Bounds must encompass the delayed actual end date
      expect(bounds.end.getTime()).toBeGreaterThanOrEqual(delayedActualEnd.getTime())
    })

    it('should expand timelineStart when actualStartDate is earlier than planned startDate', () => {
      const plannedStart = new Date('2026-10-15T00:00:00')
      const plannedEnd = new Date('2026-10-30T00:00:00')
      const earlyActualStart = new Date('2026-09-15T00:00:00') // 1 month earlier

      const tasks = [
        {
          startDate: plannedStart,
          endDate: plannedEnd,
          actualStartDate: earlyActualStart,
          actualEndDate: plannedEnd,
        },
      ]

      const bounds = getTimelineBounds(tasks)

      // Bounds must encompass the early actual start date
      expect(bounds.start.getTime()).toBeLessThanOrEqual(earlyActualStart.getTime())
    })

    it('should include milestones in timeline bounds calculation', () => {
      const taskStart = new Date('2026-10-01T00:00:00')
      const taskEnd = new Date('2026-10-10T00:00:00')
      const futureMilestone = new Date('2026-12-15T00:00:00')

      const tasks = [{ startDate: taskStart, endDate: taskEnd }]
      const milestones = [{ date: futureMilestone }]

      const bounds = getTimelineBounds(tasks, milestones)

      expect(bounds.end.getTime()).toBeGreaterThanOrEqual(futureMilestone.getTime())
    })
  })

  describe('Parent-Child Coordinate Alignment (calculateTaskBarPosition)', () => {
    it('should calculate identical left coordinates for parent and child starting on the same date', () => {
      const timelineStart = new Date('2026-10-01T00:00:00')
      const timelineEnd = new Date('2026-12-31T00:00:00')
      const containerWidth = 1200

      const sameStartDate = new Date('2026-10-12T00:00:00')

      // Parent task lasting 30 days
      const parentEndDate = addDays(sameStartDate, 29)
      const parentPos = calculateTaskBarPosition(
        sameStartDate,
        parentEndDate,
        timelineStart,
        timelineEnd,
        containerWidth
      )

      // Child task lasting 2 days
      const childEndDate = addDays(sameStartDate, 1)
      const childPos = calculateTaskBarPosition(
        sameStartDate,
        childEndDate,
        timelineStart,
        timelineEnd,
        containerWidth
      )

      // CRITICAL INVARIANT: The left edge MUST align to the exact same pixel!
      expect(parentPos.left).toBe(childPos.left)
    })
  })

  describe('Timeline Scale Item Consistency (generateTimelineScale)', () => {
    it('sum of daysCount across weeks must equal totalDays in timeline', () => {
      const timelineStart = new Date('2026-10-05T00:00:00')
      const timelineEnd = new Date('2026-11-22T00:00:00')
      const containerWidth = 1000

      const { totalDays } = calculateTimelineDimensions(timelineStart, timelineEnd, containerWidth)
      const weekScale = generateTimelineScale(timelineStart, timelineEnd, 'week')

      const sumDays = weekScale.reduce((acc, item) => acc + item.daysCount, 0)
      expect(sumDays).toBe(totalDays)
    })

    it('sum of daysCount across months must equal totalDays in timeline', () => {
      const timelineStart = new Date('2026-09-15T00:00:00')
      const timelineEnd = new Date('2026-12-10T00:00:00')
      const containerWidth = 1200

      const { totalDays } = calculateTimelineDimensions(timelineStart, timelineEnd, containerWidth)
      const monthScale = generateTimelineScale(timelineStart, timelineEnd, 'month')

      const sumDays = monthScale.reduce((acc, item) => acc + item.daysCount, 0)
      expect(sumDays).toBe(totalDays)
    })
  })

  describe('Parent Actual Dates Rollup (rollupParentActualDates)', () => {
    it('parent actualEndDate should encompass delayed children even when some children have no explicit actual dates', () => {
      const workingDays = [1, 2, 3, 4, 5]

      const tasks = [
        {
          id: 'parent',
          startDate: new Date('2026-10-05T00:00:00'),
          endDate: new Date('2026-10-23T00:00:00'),
          duration: 15,
          level: 0,
        },
        {
          id: 'child1',
          parentId: 'parent',
          startDate: new Date('2026-10-05T00:00:00'),
          endDate: new Date('2026-10-09T00:00:00'),
          duration: 5,
          level: 1,
          actualStartDate: new Date('2026-10-05T00:00:00'),
          actualEndDate: new Date('2026-10-16T00:00:00'), // Delayed by 1 week
          actualDuration: 10,
        },
        {
          id: 'child2',
          parentId: 'parent',
          startDate: new Date('2026-10-12T00:00:00'),
          endDate: new Date('2026-10-23T00:00:00'),
          duration: 10,
          level: 1,
          // child2 does not have actual dates yet (future task)
        },
      ]

      const rolledUp = rollupParentActualDates(tasks, workingDays)
      const parent = rolledUp.find(t => t.id === 'parent')

      expect(parent).toBeDefined()
      // Parent's actual start must be the minimum (2026-10-05)
      expect(parent?.actualStartDate?.getTime()).toBe(new Date('2026-10-05T00:00:00').getTime())
      // Parent's actual end must be at least child2's planned end (2026-10-23)
      expect(parent?.actualEndDate?.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-23T00:00:00').getTime())
    })
  })
})

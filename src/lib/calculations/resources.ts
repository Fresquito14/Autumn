import { startOfWeek, endOfWeek, eachWeekOfInterval, differenceInDays, addDays, getWeek, getYear } from 'date-fns'
import type { WeeklyAllocation, Resource } from '@/types'

/**
 * Calculate weekly allocation for a task resource assignment
 * Distributes hours proportionally based on working days in each week
 *
 * @param taskStart - Task start date
 * @param taskEnd - Task end date
 * @param totalPlannedHours - Total hours to distribute
 * @param workingDaysPerWeek - Array of working days (0=Sunday, 6=Saturday)
 * @param resource - Resource being assigned (for calendar awareness)
 * @returns Array of weekly allocations
 */
export function calculateWeeklyAllocation(
  taskStart: Date,
  taskEnd: Date,
  totalPlannedHours: number,
  workingDaysPerWeek: number[], // e.g., [1,2,3,4,5] for Mon-Fri
  resource?: Resource
): WeeklyAllocation[] {
  // Get all weeks that overlap with the task duration
  const weeks = eachWeekOfInterval(
    { start: taskStart, end: taskEnd },
    { weekStartsOn: 1 } // Monday
  )

  // Calculate working days for each week
  const weeklyWorkingDays: Array<{ weekStart: Date; workingDays: number }> = []

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    // Determine the actual overlap between task and week
    const overlapStart = taskStart > weekStart ? taskStart : weekStart
    const overlapEnd = taskEnd < weekEnd ? taskEnd : weekEnd

    // Count working days in this overlap
    let workingDaysCount = 0
    const daysInOverlap = differenceInDays(overlapEnd, overlapStart) + 1

    for (let i = 0; i < daysInOverlap; i++) {
      const day = addDays(overlapStart, i)
      const dayOfWeek = day.getDay()

      // Check if this day is a working day
      if (workingDaysPerWeek.includes(dayOfWeek)) {
        // TODO: Check resource calendar for vacations/custom working days
        workingDaysCount++
      }
    }

    weeklyWorkingDays.push({
      weekStart,
      workingDays: workingDaysCount
    })
  }

  // Calculate total working days across all weeks
  const totalWorkingDays = weeklyWorkingDays.reduce((sum, week) => sum + week.workingDays, 0)

  // If no working days, return empty allocation (edge case)
  if (totalWorkingDays === 0) {
    return weeklyWorkingDays.map(week => ({
      weekStart: week.weekStart,
      workingDaysInWeek: 0,
      plannedHours: 0
    }))
  }

  // Distribute hours proportionally to working days
  const weeklyAllocations: WeeklyAllocation[] = weeklyWorkingDays.map(week => {
    const proportion = week.workingDays / totalWorkingDays
    const plannedHours = Math.round(totalPlannedHours * proportion * 100) / 100 // Round to 2 decimals

    return {
      weekStart: week.weekStart,
      workingDaysInWeek: week.workingDays,
      plannedHours
    }
  })

  // Adjust last week to account for rounding errors
  const allocatedTotal = weeklyAllocations.reduce((sum, w) => sum + w.plannedHours, 0)
  const roundingDiff = Math.round((totalPlannedHours - allocatedTotal) * 100) / 100

  if (roundingDiff !== 0 && weeklyAllocations.length > 0) {
    weeklyAllocations[weeklyAllocations.length - 1].plannedHours += roundingDiff
    weeklyAllocations[weeklyAllocations.length - 1].plannedHours =
      Math.round(weeklyAllocations[weeklyAllocations.length - 1].plannedHours * 100) / 100
  }

  return weeklyAllocations
}

/**
 * Recalculate weekly distribution when task dates change
 * Preserves manual overrides if specified
 *
 * @param oldDistribution - Current weekly distribution
 * @param newTaskStart - New task start date
 * @param newTaskEnd - New task end date
 * @param totalPlannedHours - Total planned hours
 * @param workingDaysPerWeek - Array of working days
 * @param isManualDistribution - Whether to preserve manual overrides
 * @returns Updated weekly allocation
 */
export function recalculateWeeklyAllocation(
  oldDistribution: WeeklyAllocation[],
  newTaskStart: Date,
  newTaskEnd: Date,
  totalPlannedHours: number,
  workingDaysPerWeek: number[],
  isManualDistribution: boolean
): WeeklyAllocation[] {
  // If manual distribution, don't auto-recalculate (user must manually update)
  if (isManualDistribution) {
    return oldDistribution
  }

  // Otherwise, recalculate from scratch
  return calculateWeeklyAllocation(
    newTaskStart,
    newTaskEnd,
    totalPlannedHours,
    workingDaysPerWeek
  )
}

/**
 * Calculate total capacity for a resource in a given date range
 *
 * @param resource - Resource to calculate capacity for
 * @param rangeStart - Start of date range
 * @param rangeEnd - End of date range
 * @param workingDaysPerWeek - Array of working days
 * @returns Total available hours
 */
export function calculateResourceCapacity(
  resource: Resource,
  rangeStart: Date,
  rangeEnd: Date,
  workingDaysPerWeek: number[]
): number {
  const weeks = eachWeekOfInterval(
    { start: rangeStart, end: rangeEnd },
    { weekStartsOn: 1 }
  )

  let totalHours = 0

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    // Determine actual overlap
    const overlapStart = rangeStart > weekStart ? rangeStart : weekStart
    const overlapEnd = rangeEnd < weekEnd ? rangeEnd : weekEnd

    // Count working days in this week
    let workingDaysCount = 0
    const daysInOverlap = differenceInDays(overlapEnd, overlapStart) + 1

    for (let i = 0; i < daysInOverlap; i++) {
      const day = addDays(overlapStart, i)
      const dayOfWeek = day.getDay()

      if (workingDaysPerWeek.includes(dayOfWeek)) {
        // TODO: Check resource.calendar for vacations
        workingDaysCount++
      }
    }

    // Hours per week divided by 5 (assuming standard week) * working days
    const hoursPerDay = resource.maxHoursPerWeek / 5
    totalHours += hoursPerDay * workingDaysCount
  }

  return Math.round(totalHours * 100) / 100
}

/**
 * Get week key for grouping allocations (ISO week format)
 *
 * @param date - Date to get week key for
 * @returns Week key string (YYYY-Www)
 */
export function getWeekKey(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })

  // Use date-fns getWeek and getYear for correct ISO week numbering
  const weekNumber = getWeek(weekStart, { weekStartsOn: 1, firstWeekContainsDate: 4 })
  const year = getYear(weekStart)

  return `${year}-W${weekNumber.toString().padStart(2, '0')}`
}

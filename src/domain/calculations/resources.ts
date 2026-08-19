import { startOfWeek, endOfWeek, eachWeekOfInterval, differenceInDays, addDays, getWeek, getYear, isWithinInterval, isSameDay } from 'date-fns'
import type { WeeklyAllocation, Resource, Holiday, DateRange } from '@/domain/models'

/**
 * Check if a date is a vacation day for a resource
 */
function isVacationDay(date: Date, vacations: DateRange[]): boolean {
  if (!vacations || !Array.isArray(vacations)) return false
  return vacations.some(vacation => {
    if (!vacation) return false
    const vStart = vacation.start || (vacation as any).startDate || (vacation as any).start_date
    const vEnd = vacation.end || (vacation as any).endDate || (vacation as any).end_date
    if (!vStart || !vEnd) return false
    const start = vStart instanceof Date ? vStart : new Date(vStart)
    const end = vEnd instanceof Date ? vEnd : new Date(vEnd)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
    return isWithinInterval(date, { start, end })
  })
}

/**
 * Check if a date is a holiday
 */
function isHoliday(date: Date, holidays: Holiday[], resourceTags: string[]): boolean {
  if (!holidays || !Array.isArray(holidays)) return false
  return holidays.some(holiday => {
    if (!holiday || !holiday.date) return false
    const hDate = holiday.date instanceof Date ? holiday.date : new Date(holiday.date)
    if (isNaN(hDate.getTime())) return false

    // Check if holiday date matches
    if (!isSameDay(date, hDate)) return false

    // If holiday applies to all (no specific tags), return true
    if (!holiday.appliesTo || holiday.appliesTo.length === 0) return true

    // Check if resource has any of the holiday tags
    return holiday.appliesTo.some(tag => resourceTags && resourceTags.includes(tag))
  })
}

/**
 * Calculate weekly allocation for a task resource assignment
 */
export function calculateWeeklyAllocation(
  taskStart: Date,
  taskEnd: Date,
  totalPlannedHours: number,
  workingDaysPerWeek: number[],
  resource?: Resource,
  holidays?: Holiday[]
): WeeklyAllocation[] {
  const weeks = eachWeekOfInterval(
    { start: taskStart, end: taskEnd },
    { weekStartsOn: 1 }
  )

  const weeklyWorkingDays: Array<{ weekStart: Date; workingDays: number }> = []

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    const overlapStart = taskStart > weekStart ? taskStart : weekStart
    const overlapEnd = taskEnd < weekEnd ? taskEnd : weekEnd

    let workingDaysCount = 0
    const daysInOverlap = differenceInDays(overlapEnd, overlapStart) + 1

    const vacations = resource?.calendar?.vacations || []
    const resourceTags = resource?.tags || []

    for (let i = 0; i < daysInOverlap; i++) {
      const day = addDays(overlapStart, i)
      const dayOfWeek = day.getDay()

      if (workingDaysPerWeek.includes(dayOfWeek)) {
        if (isVacationDay(day, vacations)) continue
        if (holidays && isHoliday(day, holidays, resourceTags)) continue
        workingDaysCount++
      }
    }

    weeklyWorkingDays.push({
      weekStart,
      workingDays: workingDaysCount
    })
  }

  const totalWorkingDays = weeklyWorkingDays.reduce((sum, week) => sum + week.workingDays, 0)

  if (totalWorkingDays === 0) {
    return weeklyWorkingDays.map(week => ({
      weekStart: week.weekStart,
      workingDaysInWeek: 0,
      plannedHours: 0
    }))
  }

  const weeklyAllocations: WeeklyAllocation[] = weeklyWorkingDays.map(week => {
    const proportion = week.workingDays / totalWorkingDays
    const plannedHours = Math.round(totalPlannedHours * proportion * 100) / 100

    return {
      weekStart: week.weekStart,
      workingDaysInWeek: week.workingDays,
      plannedHours
    }
  })

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
 */
export function recalculateWeeklyAllocation(
  oldDistribution: WeeklyAllocation[],
  newTaskStart: Date,
  newTaskEnd: Date,
  totalPlannedHours: number,
  workingDaysPerWeek: number[],
  isManualDistribution: boolean,
  resource?: Resource,
  holidays?: Holiday[]
): WeeklyAllocation[] {
  if (isManualDistribution) {
    return oldDistribution
  }

  return calculateWeeklyAllocation(
    newTaskStart,
    newTaskEnd,
    totalPlannedHours,
    workingDaysPerWeek,
    resource,
    holidays
  )
}

/**
 * Calculate total capacity for a resource in a given date range
 */
export function calculateResourceCapacity(
  resource: Resource,
  rangeStart: Date,
  rangeEnd: Date,
  workingDaysPerWeek: number[],
  holidays?: Holiday[]
): number {
  const weeks = eachWeekOfInterval(
    { start: rangeStart, end: rangeEnd },
    { weekStartsOn: 1 }
  )

  let totalHours = 0
  const vacations = resource.calendar?.vacations || []
  const resourceTags = resource.tags || []

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    const overlapStart = rangeStart > weekStart ? rangeStart : weekStart
    const overlapEnd = rangeEnd < weekEnd ? rangeEnd : weekEnd

    let workingDaysCount = 0
    const daysInOverlap = differenceInDays(overlapEnd, overlapStart) + 1

    for (let i = 0; i < daysInOverlap; i++) {
      const day = addDays(overlapStart, i)
      const dayOfWeek = day.getDay()

      if (workingDaysPerWeek.includes(dayOfWeek)) {
        if (isVacationDay(day, vacations)) continue
        if (holidays && isHoliday(day, holidays, resourceTags)) continue
        workingDaysCount++
      }
    }

    const hoursPerDay = resource.maxHoursPerWeek / 5
    totalHours += hoursPerDay * workingDaysCount
  }

  return Math.round(totalHours * 100) / 100
}

/**
 * Get week key for grouping allocations (ISO week format)
 */
export function getWeekKey(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekNumber = getWeek(weekStart, { weekStartsOn: 1, firstWeekContainsDate: 4 })
  const year = getYear(weekStart)

  return `${year}-W${weekNumber.toString().padStart(2, '0')}`
}

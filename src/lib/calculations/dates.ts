import {
  addDays,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  startOfMonth,
  endOfMonth,
  isSameMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Calculate business days between two dates
 * considering working days configuration
 */
export function calculateBusinessDays(
  startDate: Date,
  endDate: Date,
  workingDays: number[] = [1, 2, 3, 4, 5]
): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  return days.filter((day) => workingDays.includes(day.getDay())).length
}

/**
 * Add business days to a date
 */
export function addBusinessDays(
  date: Date,
  days: number,
  workingDays: number[] = [1, 2, 3, 4, 5]
): Date {
  let currentDate = new Date(date)
  let remainingDays = days

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1)
    if (workingDays.includes(currentDate.getDay())) {
      remainingDays--
    }
  }

  return currentDate
}

/**
 * Get timeline bounds for a set of tasks
 */
export function getTimelineBounds(tasks: { startDate: Date; endDate: Date }[]): {
  start: Date
  end: Date
} {
  if (tasks.length === 0) {
    const today = new Date()
    return {
      start: today,
      end: addDays(today, 30),
    }
  }

  const startDates = tasks.map((t) => new Date(t.startDate))
  const endDates = tasks.map((t) => new Date(t.endDate))

  const minStart = new Date(Math.min(...startDates.map((d) => d.getTime())))
  const maxEnd = new Date(Math.max(...endDates.map((d) => d.getTime())))

  // Add some padding
  return {
    start: startOfWeek(minStart, { locale: es }),
    end: endOfWeek(addDays(maxEnd, 7), { locale: es }),
  }
}

/**
 * Calculate position and width for a task bar in the Gantt chart
 */
export function calculateTaskBarPosition(
  taskStart: Date,
  taskEnd: Date,
  timelineStart: Date,
  timelineEnd: Date,
  containerWidth: number
): {
  left: number
  width: number
} {
  const totalDays = differenceInDays(timelineEnd, timelineStart)
  const dayWidth = containerWidth / totalDays

  const daysFromStart = differenceInDays(taskStart, timelineStart)
  const taskDuration = differenceInDays(taskEnd, taskStart) + 1

  return {
    left: daysFromStart * dayWidth,
    width: taskDuration * dayWidth,
  }
}

/**
 * Generate timeline scale (weeks/months)
 */
export function generateTimelineScale(
  start: Date,
  end: Date,
  granularity: 'day' | 'week' | 'month' = 'week'
): Array<{ date: Date; label: string; width: number }> {
  const totalDays = differenceInDays(end, start)
  const days = eachDayOfInterval({ start, end })

  if (granularity === 'month') {
    const months: Array<{ date: Date; label: string; width: number }> = []
    let currentMonth = startOfMonth(start)

    while (currentMonth <= end) {
      const monthEnd = endOfMonth(currentMonth)
      const monthDays = days.filter((day) => isSameMonth(day, currentMonth)).length

      months.push({
        date: currentMonth,
        label: format(currentMonth, 'MMM yyyy', { locale: es }),
        width: (monthDays / totalDays) * 100,
      })

      currentMonth = addDays(monthEnd, 1)
    }

    return months
  }

  if (granularity === 'week') {
    const weeks: Array<{ date: Date; label: string; width: number }> = []
    let currentWeek = startOfWeek(start, { locale: es })

    while (currentWeek <= end) {
      const weekEnd = endOfWeek(currentWeek, { locale: es })
      const weekDays = days.filter(
        (day) => day >= currentWeek && day <= weekEnd
      ).length

      weeks.push({
        date: currentWeek,
        label: `S${format(currentWeek, 'w', { locale: es })}`,
        width: (weekDays / totalDays) * 100,
      })

      currentWeek = addDays(weekEnd, 1)
    }

    return weeks
  }

  // Day granularity
  return days.map((day) => ({
    date: day,
    label: format(day, 'd', { locale: es }),
    width: (1 / totalDays) * 100,
  }))
}

/**
 * Check if a date is a working day
 */
export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay())
}

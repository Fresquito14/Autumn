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
  // Validate and normalize workingDays
  if (!workingDays || workingDays.length === 0) {
    console.error('[calculateBusinessDays] ERROR: workingDays is empty! Using default [1,2,3,4,5]')
    workingDays = [1, 2, 3, 4, 5]
  }

  // Ensure all workingDays values are valid (0-6) and are numbers
  const validWorkingDays = workingDays
    .map(day => typeof day === 'string' ? parseInt(day, 10) : day)
    .filter(day => typeof day === 'number' && day >= 0 && day <= 6)

  if (validWorkingDays.length === 0) {
    console.error('[calculateBusinessDays] ERROR: No valid working days! Using default [1,2,3,4,5]')
    workingDays = [1, 2, 3, 4, 5]
  } else {
    workingDays = validWorkingDays
  }

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
  if (days === 0) return new Date(date)

  // Validate workingDays - must not be empty and must contain valid day numbers (0-6)
  if (!workingDays || workingDays.length === 0) {
    console.error('[addBusinessDays] ERROR: workingDays is empty! Using default [1,2,3,4,5]')
    workingDays = [1, 2, 3, 4, 5]
  }

  // Ensure all workingDays values are valid (0-6) and are numbers
  const validWorkingDays = workingDays
    .map(day => typeof day === 'string' ? parseInt(day, 10) : day)
    .filter(day => typeof day === 'number' && day >= 0 && day <= 6)

  if (validWorkingDays.length === 0) {
    console.error('[addBusinessDays] ERROR: No valid working days after filtering! Using default [1,2,3,4,5]')
    workingDays = [1, 2, 3, 4, 5]
  } else {
    workingDays = validWorkingDays
  }

  let currentDate = new Date(date)
  let remainingDays = days

  let iterations = 0
  const maxIterations = Math.max(days * 3, 1000) // Safety limit with minimum

  while (remainingDays > 0 && iterations < maxIterations) {
    currentDate = addDays(currentDate, 1)
    iterations++
    const dayOfWeek = currentDate.getDay()
    const isWorking = workingDays.includes(dayOfWeek)

    if (isWorking) {
      remainingDays--
    }
  }

  if (iterations >= maxIterations) {
    console.error(`[addBusinessDays] ERROR: Se alcanzó el límite de iteraciones`)
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
  // Use default week start (Sunday) to match JavaScript's getDay() behavior
  return {
    start: startOfWeek(minStart),
    end: endOfWeek(addDays(maxEnd, 7)),
  }
}

/**
 * Normalize a date to midnight (00:00:00.000) to avoid timezone issues
 */
function normalizeDateToMidnight(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

/**
 * Calculate timeline dimensions (totalDays and dayWidth) in a consistent way
 * This is the single source of truth for all Gantt calculations
 */
export function calculateTimelineDimensions(
  timelineStart: Date,
  timelineEnd: Date,
  containerWidth: number
): {
  totalDays: number
  dayWidth: number
  normalizedStart: Date
  normalizedEnd: Date
} {
  // Normalize dates to midnight to avoid timezone and DST issues
  const normalizedStart = normalizeDateToMidnight(timelineStart)
  const normalizedEnd = normalizeDateToMidnight(timelineEnd)

  // Use differenceInDays from date-fns for consistency
  const totalDays = differenceInDays(normalizedEnd, normalizedStart) + 1
  const dayWidth = containerWidth / totalDays

  return { totalDays, dayWidth, normalizedStart, normalizedEnd }
}

/**
 * Calculate the left position for a single date in the timeline
 * Used for milestones, today marker, and other single-point markers
 */
export function calculateDatePosition(
  targetDate: Date,
  timelineStart: Date,
  timelineEnd: Date,
  containerWidth: number
): {
  left: number
  daysFromStart: number
} {
  const { dayWidth, normalizedStart } = calculateTimelineDimensions(
    timelineStart,
    timelineEnd,
    containerWidth
  )

  const normalizedTarget = normalizeDateToMidnight(targetDate)
  const daysFromStart = differenceInDays(normalizedTarget, normalizedStart)
  const left = daysFromStart * dayWidth

  return { left, daysFromStart }
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
  const { dayWidth, normalizedStart } = calculateTimelineDimensions(
    timelineStart,
    timelineEnd,
    containerWidth
  )

  const normalizedTaskStart = normalizeDateToMidnight(taskStart)
  const normalizedTaskEnd = normalizeDateToMidnight(taskEnd)

  const daysFromStart = differenceInDays(normalizedTaskStart, normalizedStart)
  const taskDuration = differenceInDays(normalizedTaskEnd, normalizedTaskStart) + 1

  const fullWidth = taskDuration * dayWidth
  const reducedWidth = fullWidth * 0.95 // Reduce 5% for better connection line visibility
  const leftOffset = (fullWidth - reducedWidth) / 2 // Center the reduced bar

  return {
    left: daysFromStart * dayWidth + leftOffset,
    width: reducedWidth,
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
  // Normalize dates to match the rest of the Gantt calculations
  const normalizedStart = normalizeDateToMidnight(start)
  const normalizedEnd = normalizeDateToMidnight(end)
  const totalDays = differenceInDays(normalizedEnd, normalizedStart) + 1
  const days = eachDayOfInterval({ start: normalizedStart, end: normalizedEnd })

  if (granularity === 'month') {
    const months: Array<{ date: Date; label: string; width: number }> = []
    let currentMonth = startOfMonth(normalizedStart)

    while (currentMonth <= normalizedEnd) {
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
    // Use default week start (Sunday) to match JavaScript's getDay() behavior
    let currentWeek = startOfWeek(normalizedStart)

    while (currentWeek <= normalizedEnd) {
      const weekEnd = endOfWeek(currentWeek)
      const weekDays = days.filter(
        (day) => day >= currentWeek && day <= weekEnd
      ).length

      weeks.push({
        date: currentWeek,
        label: `S${format(currentWeek, 'w')}`,
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

/**
 * Recalculate task dates based on dependencies
 * Returns updated tasks with recalculated dates
 * Uses Kahn's algorithm for topological sort to detect cycles
 * If actualDuration is set, it will be used instead of duration for calculating end dates
 */
export function recalculateTaskDates<T extends { id: string; parentId?: string | null; startDate: Date; endDate: Date; duration: number; actualDuration?: number | null }>(
  tasks: T[],
  dependencies: Array<{ predecessorId: string; successorId: string; lag?: number }>,
  workingDays: number[] = [1, 2, 3, 4, 5]
): T[] {
  if (tasks.length === 0) return []

  // Create a deep copy of tasks to avoid mutating originals
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]))

  // Identify parent tasks (tasks that have children)
  const parentTaskIds = new Set<string>()
  tasks.forEach(task => {
    if (task.parentId) {
      parentTaskIds.add(task.parentId)
    }
  })

  // Build adjacency list and in-degree map
  const adjacencyList = new Map<string, Array<{ successorId: string; lag: number }>>()
  const inDegree = new Map<string, number>()
  const predecessorMap = new Map<string, Array<{ predecessorId: string; lag: number }>>()

  // Initialize maps
  tasks.forEach(task => {
    adjacencyList.set(task.id, [])
    inDegree.set(task.id, 0)
    predecessorMap.set(task.id, [])
  })

  // Build graphs
  dependencies.forEach(dep => {
    const { predecessorId, successorId, lag = 0 } = dep

    // Skip if tasks don't exist
    if (!taskMap.has(predecessorId) || !taskMap.has(successorId)) {
      console.warn(`⚠️ Dependencia inválida: ${predecessorId} -> ${successorId}`)
      return
    }

    // Add to adjacency list (predecessor -> successor)
    adjacencyList.get(predecessorId)!.push({ successorId, lag })

    // Add to predecessor map (successor <- predecessor)
    predecessorMap.get(successorId)!.push({ predecessorId, lag })

    // Increment in-degree for successor
    inDegree.set(successorId, (inDegree.get(successorId) || 0) + 1)
  })

  // Kahn's algorithm for topological sort
  const queue: string[] = []
  const sorted: string[] = []

  // Start with tasks that have no predecessors
  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId)
    }
  })

  // Process queue
  let iterations = 0
  const maxIterations = tasks.length * 2 // Safety limit

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++
    const currentTaskId = queue.shift()!
    sorted.push(currentTaskId)

    // Process all successors
    const successors = adjacencyList.get(currentTaskId) || []
    successors.forEach(({ successorId }) => {
      const newDegree = (inDegree.get(successorId) || 0) - 1
      inDegree.set(successorId, newDegree)

      if (newDegree === 0) {
        queue.push(successorId)
      }
    })
  }

  // Check for circular dependencies
  if (sorted.length !== tasks.length) {
    console.error('❌ Dependencias circulares detectadas. No se puede recalcular.')
    console.error('Tareas procesadas:', sorted.length, '/ Total:', tasks.length)
    throw new Error('Circular dependencies detected. Cannot recalculate task dates.')
  }

  // Iterate multiple times until no changes or max iterations reached
  const MAX_PASSES = 10 // Safety limit
  let currentPass = 0
  let hadChanges = true

  while (hadChanges && currentPass < MAX_PASSES) {
    currentPass++
    hadChanges = false

    // Recalculate dates in topological order
    // IMPORTANT: Only recalculate dates for LEAF tasks (tasks without children)
    // Parent tasks will get their dates from rollupParentDates
    sorted.forEach(taskId => {
      const task = taskMap.get(taskId)
      if (!task) return
      if (parentTaskIds.has(taskId)) return

      const predecessors = predecessorMap.get(taskId) || []
      if (predecessors.length === 0) {
        let taskStartDate = new Date(task.startDate)
        let needsAdjustment = false

        if (!isWorkingDay(taskStartDate, workingDays)) {
          needsAdjustment = true
          let safetyCounter = 0
          while (!isWorkingDay(taskStartDate, workingDays) && safetyCounter < 14) {
            taskStartDate = addDays(taskStartDate, 1)
            safetyCounter++
          }
        }

        if (needsAdjustment) {
          const effectiveDuration = task.duration
          const taskEndDate = addBusinessDays(taskStartDate, effectiveDuration - 1, workingDays)

          const oldStartTime = task.startDate.getTime()
          const oldEndTime = task.endDate.getTime()
          const newStartTime = taskStartDate.getTime()
          const newEndTime = taskEndDate.getTime()

          if (oldStartTime !== newStartTime || oldEndTime !== newEndTime) {
            hadChanges = true
            task.startDate = taskStartDate
            task.endDate = taskEndDate
          }
        }
        return
      }

      let latestPredecessorEnd: Date | null = null
      let maxLag = 0

      for (const { predecessorId, lag } of predecessors) {
        const predecessor = taskMap.get(predecessorId)
        if (!predecessor) continue

        const predecessorEnd = new Date(predecessor.endDate)

        if (!latestPredecessorEnd || predecessorEnd > latestPredecessorEnd) {
          latestPredecessorEnd = predecessorEnd
          maxLag = lag
        } else if (predecessorEnd.getTime() === latestPredecessorEnd.getTime() && lag > maxLag) {
          maxLag = lag
        }
      }

      if (latestPredecessorEnd) {
        let newStartDate = addDays(latestPredecessorEnd, 1)

        let safetyCounter = 0
        while (!isWorkingDay(newStartDate, workingDays) && safetyCounter < 14) {
          newStartDate = addDays(newStartDate, 1)
          safetyCounter++
        }

        if (maxLag > 0) {
          newStartDate = addBusinessDays(newStartDate, maxLag, workingDays)
        }

        const effectiveDuration = task.duration
        const newEndDate = addBusinessDays(newStartDate, effectiveDuration - 1, workingDays)

        const oldStartTime = task.startDate.getTime()
        const oldEndTime = task.endDate.getTime()
        const newStartTime = newStartDate.getTime()
        const newEndTime = newEndDate.getTime()

        if (oldStartTime !== newStartTime || oldEndTime !== newEndTime) {
          hadChanges = true
          task.startDate = newStartDate
          task.endDate = newEndDate
        }
      }
    })

    const tasksArray = Array.from(taskMap.values())
    const rolledUpTasks = rollupParentDates(tasksArray, workingDays)

    rolledUpTasks.forEach(task => {
      taskMap.set(task.id, task)
    })
  }

  if (currentPass >= MAX_PASSES) {
    console.warn(`⚠️ Se alcanzó el límite de ${MAX_PASSES} pasadas. Puede que aún haya cambios pendientes.`)
  }

  return Array.from(taskMap.values())
}

/**
 * Rollup parent task dates based on their children
 */
export function rollupParentDates<T extends { id: string; parentId?: string | null; startDate: Date; endDate: Date; duration: number; level?: number }>(
  tasks: T[],
  workingDays: number[] = [1, 2, 3, 4, 5]
): T[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]))

  const childrenByParent = new Map<string, T[]>()
  tasks.forEach(task => {
    if (task.parentId) {
      if (!childrenByParent.has(task.parentId)) {
        childrenByParent.set(task.parentId, [])
      }
      childrenByParent.get(task.parentId)!.push(task)
    }
  })

  const sortedTasks = [...tasks].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))

  sortedTasks.forEach(task => {
    const children = childrenByParent.get(task.id)
    if (!children || children.length === 0) return

    const currentTask = taskMap.get(task.id)
    if (!currentTask) return

    const childStartDates = children.map(c => {
      const child = taskMap.get(c.id)
      return child ? child.startDate : c.startDate
    })
    const childEndDates = children.map(c => {
      const child = taskMap.get(c.id)
      return child ? child.endDate : c.endDate
    })

    const minStartDate = new Date(Math.min(...childStartDates.map(d => d.getTime())))
    const maxEndDate = new Date(Math.max(...childEndDates.map(d => d.getTime())))

    const newDuration = calculateBusinessDays(minStartDate, maxEndDate, workingDays)

    currentTask.startDate = minStartDate
    currentTask.endDate = maxEndDate
    currentTask.duration = newDuration

    taskMap.set(task.id, currentTask)
  })

  return Array.from(taskMap.values())
}

/**
 * Roll up parent task actual dates from their children
 */
export function rollupParentActualDates<T extends {
  id: string
  parentId?: string | null
  startDate: Date
  endDate: Date
  actualStartDate?: Date | null
  actualEndDate?: Date | null
  actualDuration?: number | null
  duration: number
  level?: number
}>(
  tasks: T[],
  workingDays: number[] = [1, 2, 3, 4, 5]
): T[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]))

  const childrenByParent = new Map<string, T[]>()
  tasks.forEach(task => {
    if (task.parentId) {
      if (!childrenByParent.has(task.parentId)) {
        childrenByParent.set(task.parentId, [])
      }
      childrenByParent.get(task.parentId)!.push(task)
    }
  })

  const sortedTasks = [...tasks].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))

  sortedTasks.forEach(task => {
    const children = childrenByParent.get(task.id)
    if (!children || children.length === 0) return

    const currentTask = taskMap.get(task.id)
    if (!currentTask) return

    const childActualStartDates = children.map(c => {
      const child = taskMap.get(c.id)
      if (!child) return c.actualStartDate || c.startDate
      return child.actualStartDate || child.startDate
    })
    const childActualEndDates = children.map(c => {
      const child = taskMap.get(c.id)
      if (!child) return c.actualEndDate || c.endDate
      return child.actualEndDate || child.endDate
    })

    const minActualStartDate = new Date(Math.min(...childActualStartDates.map(d => d.getTime())))
    const maxActualEndDate = new Date(Math.max(...childActualEndDates.map(d => d.getTime())))

    const newActualDuration = calculateBusinessDays(minActualStartDate, maxActualEndDate, workingDays)

    currentTask.actualStartDate = minActualStartDate
    currentTask.actualEndDate = maxActualEndDate
    currentTask.actualDuration = newActualDuration

    taskMap.set(task.id, currentTask)
  })

  return Array.from(taskMap.values())
}

/**
 * Calculate actual task dates based on dependencies and actual durations
 */
export function calculateActualDates<T extends {
  id: string
  startDate: Date
  endDate: Date
  duration: number
  actualStartDate?: Date
  actualEndDate?: Date
  actualDuration?: number
}>(
  tasks: T[],
  dependencies: Array<{ predecessorId: string; successorId: string; lag?: number; actualLag?: number }>,
  workingDays: number[] = [1, 2, 3, 4, 5]
): T[] {
  if (tasks.length === 0) return []

  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]))

  const adjacencyList = new Map<string, Array<{ successorId: string; lag: number }>>()
  const inDegree = new Map<string, number>()
  const predecessorMap = new Map<string, Array<{ predecessorId: string; lag: number }>>()

  tasks.forEach(task => {
    adjacencyList.set(task.id, [])
    inDegree.set(task.id, 0)
    predecessorMap.set(task.id, [])
  })

  dependencies.forEach(dep => {
    const { predecessorId, successorId } = dep
    const effectiveLag = dep.actualLag !== undefined && dep.actualLag !== null ? dep.actualLag : (dep.lag || 0)

    if (!taskMap.has(predecessorId) || !taskMap.has(successorId)) {
      console.warn(`⚠️ Dependencia inválida: ${predecessorId} -> ${successorId}`)
      return
    }

    adjacencyList.get(predecessorId)!.push({ successorId, lag: effectiveLag })
    predecessorMap.get(successorId)!.push({ predecessorId, lag: effectiveLag })
    inDegree.set(successorId, (inDegree.get(successorId) || 0) + 1)
  })

  const queue: string[] = []
  const sorted: string[] = []

  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId)
    }
  })

  let iterations = 0
  const maxIterations = tasks.length * 2

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++
    const currentTaskId = queue.shift()!
    sorted.push(currentTaskId)

    const successors = adjacencyList.get(currentTaskId) || []
    successors.forEach(({ successorId }) => {
      const newDegree = (inDegree.get(successorId) || 0) - 1
      inDegree.set(successorId, newDegree)

      if (newDegree === 0) {
        queue.push(successorId)
      }
    })
  }

  if (sorted.length !== tasks.length) {
    console.error('❌ Dependencias circulares detectadas. No se puede calcular fechas reales.')
    throw new Error('Circular dependencies detected. Cannot calculate actual dates.')
  }

  sorted.forEach(taskId => {
    const task = taskMap.get(taskId)
    if (!task) return

    const predecessors = predecessorMap.get(taskId) || []

    if (predecessors.length === 0) {
      const start = task.actualStartDate ? new Date(task.actualStartDate) : new Date(task.startDate)
      task.actualStartDate = start

      const effectiveDuration = task.actualDuration !== undefined && task.actualDuration !== null
        ? task.actualDuration
        : task.duration

      task.actualEndDate = addBusinessDays(start, effectiveDuration - 1, workingDays)
      return
    }

    let earliestActualStart: Date | null = null

    for (const { predecessorId, lag } of predecessors) {
      const predecessor = taskMap.get(predecessorId)
      if (!predecessor) continue

      const predecessorEnd = predecessor.actualEndDate
        ? new Date(predecessor.actualEndDate)
        : new Date(predecessor.endDate)

      const predCalculatedStart = addBusinessDays(predecessorEnd, lag + 1, workingDays)

      if (!earliestActualStart || predCalculatedStart.getTime() > earliestActualStart.getTime()) {
        earliestActualStart = predCalculatedStart
      }
    }

    if (earliestActualStart) {
      task.actualStartDate = earliestActualStart

      const effectiveDuration = task.actualDuration !== undefined && task.actualDuration !== null
        ? task.actualDuration
        : task.duration

      task.actualEndDate = addBusinessDays(earliestActualStart, effectiveDuration - 1, workingDays)
    }
  })

  const tasksWithRollup = rollupParentActualDates(Array.from(taskMap.values()), workingDays)
  return tasksWithRollup
}

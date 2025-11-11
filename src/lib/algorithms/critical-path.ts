import type { Task, Dependency } from '@/types'

/**
 * Task with CPM calculations
 */
export interface TaskWithCPM extends Task {
  // Early times
  earlyStart: number  // ES - Earliest this task can start
  earlyFinish: number // EF - Earliest this task can finish

  // Late times
  lateStart: number   // LS - Latest this task can start without delaying project
  lateFinish: number  // LF - Latest this task can finish without delaying project

  // Float/Slack
  totalFloat: number  // How much this task can be delayed without delaying project

  // Critical path
  isCritical: boolean // Is this task on the critical path?
}

/**
 * Calculate Critical Path using CPM (Critical Path Method)
 *
 * Algorithm:
 * 1. Forward Pass: Calculate ES and EF for all tasks
 * 2. Backward Pass: Calculate LS and LF for all tasks
 * 3. Calculate Float: TF = LS - ES (or LF - EF)
 * 4. Identify Critical Path: Tasks where Float = 0
 *
 * IMPORTANT: Only leaf tasks (tasks without children) are considered for the critical path.
 * Parent/summary tasks are containers and should not be marked as critical.
 */
export function calculateCriticalPath(
  tasks: Task[],
  dependencies: Dependency[]
): TaskWithCPM[] {
  if (tasks.length === 0) {
    return []
  }

  // Identify which tasks are parents (have children)
  const parentTaskIds = new Set<string>()
  tasks.forEach(task => {
    if (task.parentId) {
      parentTaskIds.add(task.parentId)
    }
  })

  // Initialize all tasks with CPM properties
  const tasksWithCPM: TaskWithCPM[] = tasks.map(task => ({
    ...task,
    earlyStart: 0,
    earlyFinish: 0,
    lateStart: 0,
    lateFinish: 0,
    totalFloat: 0,
    isCritical: false,
  }))

  // Build adjacency lists for easy traversal
  const successors = new Map<string, string[]>()
  const predecessors = new Map<string, string[]>()
  const dependencyMap = new Map<string, Dependency>()

  dependencies.forEach(dep => {
    // Successors: tasks that depend on this task
    if (!successors.has(dep.predecessorId)) {
      successors.set(dep.predecessorId, [])
    }
    successors.get(dep.predecessorId)!.push(dep.successorId)

    // Predecessors: tasks this task depends on
    if (!predecessors.has(dep.successorId)) {
      predecessors.set(dep.successorId, [])
    }
    predecessors.get(dep.successorId)!.push(dep.predecessorId)

    // Store dependency for lag lookup
    const key = `${dep.predecessorId}-${dep.successorId}`
    dependencyMap.set(key, dep)
  })

  // Create a map for quick task lookup
  const taskMap = new Map<string, TaskWithCPM>()
  tasksWithCPM.forEach(task => taskMap.set(task.id, task))

  // ============================================
  // FORWARD PASS: Calculate ES and EF
  // ============================================

  // Topological sort to process tasks in dependency order
  const processed = new Set<string>()
  const toProcess: string[] = []

  // Find start tasks (no predecessors)
  tasksWithCPM.forEach(task => {
    if (!predecessors.has(task.id) || predecessors.get(task.id)!.length === 0) {
      toProcess.push(task.id)
      const t = taskMap.get(task.id)!
      t.earlyStart = 0
      t.earlyFinish = task.duration
    }
  })

  // Process tasks level by level
  while (toProcess.length > 0) {
    const taskId = toProcess.shift()!
    if (processed.has(taskId)) continue

    const task = taskMap.get(taskId)!

    // Calculate ES as max(EF of all predecessors + lag)
    const preds = predecessors.get(taskId) || []
    if (preds.length > 0) {
      task.earlyStart = Math.max(
        ...preds.map(predId => {
          const pred = taskMap.get(predId)!
          const dep = dependencyMap.get(`${predId}-${taskId}`)
          const lag = dep?.lag || 0
          return pred.earlyFinish + lag
        })
      )
      task.earlyFinish = task.earlyStart + task.duration
    }

    processed.add(taskId)

    // Add successors to queue
    const succs = successors.get(taskId) || []
    succs.forEach(succId => {
      // Only add if all predecessors have been processed
      const succPreds = predecessors.get(succId) || []
      if (succPreds.every(p => processed.has(p))) {
        toProcess.push(succId)
      }
    })
  }

  // ============================================
  // BACKWARD PASS: Calculate LS and LF
  // ============================================

  // Find project completion time (max EF)
  const projectCompletion = Math.max(
    ...tasksWithCPM.map(t => t.earlyFinish)
  )

  // Find end tasks (no successors)
  const endTasks = tasksWithCPM.filter(
    task => !successors.has(task.id) || successors.get(task.id)!.length === 0
  )

  // Initialize end tasks with project completion time
  endTasks.forEach(task => {
    task.lateFinish = projectCompletion
    task.lateStart = task.lateFinish - task.duration
  })

  // Reverse topological sort
  const processedBackward = new Set<string>()
  const toProcessBackward: string[] = endTasks.map(t => t.id)

  while (toProcessBackward.length > 0) {
    const taskId = toProcessBackward.shift()!
    if (processedBackward.has(taskId)) continue

    const task = taskMap.get(taskId)!

    // Calculate LF as min(LS of all successors - lag)
    const succs = successors.get(taskId) || []
    if (succs.length > 0 && processedBackward.size > 0) {
      task.lateFinish = Math.min(
        ...succs.map(succId => {
          const succ = taskMap.get(succId)!
          const dep = dependencyMap.get(`${taskId}-${succId}`)
          const lag = dep?.lag || 0
          return succ.lateStart - lag
        })
      )
      task.lateStart = task.lateFinish - task.duration
    }

    processedBackward.add(taskId)

    // Add predecessors to queue
    const preds = predecessors.get(taskId) || []
    preds.forEach(predId => {
      // Only add if all successors have been processed
      const predSuccs = successors.get(predId) || []
      if (predSuccs.every(s => processedBackward.has(s))) {
        toProcessBackward.push(predId)
      }
    })
  }

  // ============================================
  // CALCULATE FLOAT AND IDENTIFY CRITICAL PATH
  // ============================================

  tasksWithCPM.forEach(task => {
    // Total Float = LS - ES (or LF - EF, same result)
    task.totalFloat = task.lateStart - task.earlyStart

    // Critical if:
    // 1. Float is 0 (or very close to 0 for floating point)
    // 2. AND task is a leaf task (not a parent/summary task)
    const hasZeroFloat = Math.abs(task.totalFloat) < 0.001
    const isLeafTask = !parentTaskIds.has(task.id)

    task.isCritical = hasZeroFloat && isLeafTask
  })

  return tasksWithCPM
}

/**
 * Get only the tasks on the critical path
 */
export function getCriticalTasks(tasksWithCPM: TaskWithCPM[]): TaskWithCPM[] {
  return tasksWithCPM.filter(task => task.isCritical)
}

/**
 * Get critical path as an ordered sequence of task IDs
 */
export function getCriticalPathSequence(
  tasksWithCPM: TaskWithCPM[],
  dependencies: Dependency[]
): string[] {
  const criticalTasks = getCriticalTasks(tasksWithCPM)

  if (criticalTasks.length === 0) {
    return []
  }

  // Build dependency graph for critical tasks only
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  criticalTasks.forEach(task => {
    graph.set(task.id, [])
    inDegree.set(task.id, 0)
  })

  dependencies.forEach(dep => {
    const predTask = tasksWithCPM.find(t => t.id === dep.predecessorId)
    const succTask = tasksWithCPM.find(t => t.id === dep.successorId)

    if (predTask?.isCritical && succTask?.isCritical) {
      graph.get(dep.predecessorId)!.push(dep.successorId)
      inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1)
    }
  })

  // Topological sort to get ordered sequence
  const result: string[] = []
  const queue: string[] = []

  // Find start tasks (no predecessors in critical path)
  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId)
    }
  })

  while (queue.length > 0) {
    // Sort by early start to get natural order
    queue.sort((a, b) => {
      const taskA = tasksWithCPM.find(t => t.id === a)!
      const taskB = tasksWithCPM.find(t => t.id === b)!
      return taskA.earlyStart - taskB.earlyStart
    })

    const taskId = queue.shift()!
    result.push(taskId)

    const neighbors = graph.get(taskId) || []
    neighbors.forEach(neighbor => {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1)
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor)
      }
    })
  }

  return result
}

/**
 * Calculate project duration (critical path length)
 */
export function getProjectDuration(tasksWithCPM: TaskWithCPM[]): number {
  if (tasksWithCPM.length === 0) return 0
  return Math.max(...tasksWithCPM.map(t => t.earlyFinish))
}

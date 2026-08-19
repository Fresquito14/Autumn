import type { Task } from '@/domain/models'

/**
 * Calculate the progress percentage of a task based on actualDuration.
 */
export function calculateTaskProgress(task: Task, allTasks: Task[]): number {
  const children = allTasks.filter(t => t.parentId === task.id)

  if (children.length === 0) {
    return (task.actualDuration !== undefined && task.actualDuration !== null) ? 100 : 0
  }

  const totalDays = children.reduce((sum, child) => sum + child.duration, 0)

  if (totalDays === 0) return 0

  const completedDays = children.reduce((sum, child) => {
    const childProgress = calculateTaskProgress(child, allTasks)
    return sum + (child.duration * childProgress / 100)
  }, 0)

  return Math.round((completedDays / totalDays) * 100)
}

/**
 * Calculate progress for all tasks in the project.
 */
export function calculateAllTaskProgress(tasks: Task[]): Task[] {
  return tasks.map(task => ({
    ...task,
    percentComplete: calculateTaskProgress(task, tasks)
  }))
}

/**
 * Get all child tasks recursively (descendants)
 */
export function getDescendants(taskId: string, allTasks: Task[]): Task[] {
  const children = allTasks.filter(t => t.parentId === taskId)
  const descendants: Task[] = [...children]

  for (const child of children) {
    descendants.push(...getDescendants(child.id, allTasks))
  }

  return descendants
}

/**
 * Check if a task has children
 */
export function hasChildren(taskId: string, allTasks: Task[]): boolean {
  return allTasks.some(t => t.parentId === taskId)
}

/**
 * Get all leaf tasks (tasks without children)
 */
export function getLeafTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => !hasChildren(task.id, tasks))
}

/**
 * Get all parent tasks (tasks with children)
 */
export function getParentTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => hasChildren(task.id, tasks))
}

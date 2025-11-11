import type { Task } from '@/types'

/**
 * Calculate the progress percentage of a task based on actualDuration.
 *
 * Rules:
 * - Leaf tasks (no children):
 *   - 100% if actualDuration is defined (has real duration data)
 *   - 0% otherwise (task not started or in progress without tracking)
 * - Parent tasks: sum of completed days / sum of total days
 *   Example: Parent has 3 children (10d, 15d, 5d = 30d total)
 *            If the 15d task has actualDuration → 15/30 = 50%
 *
 * @param task - The task to calculate progress for
 * @param allTasks - All tasks in the project
 * @returns Progress percentage (0-100)
 */
export function calculateTaskProgress(task: Task, allTasks: Task[]): number {
  // Get child tasks
  const children = allTasks.filter(t => t.parentId === task.id)

  // Leaf task (no children): completed if actualDuration is set
  if (children.length === 0) {
    return (task.actualDuration !== undefined && task.actualDuration !== null) ? 100 : 0
  }

  // Parent task: calculate based on children's durations and completion
  const totalDays = children.reduce((sum, child) => sum + child.duration, 0)

  if (totalDays === 0) return 0

  const completedDays = children.reduce((sum, child) => {
    // Recursively calculate child progress
    const childProgress = calculateTaskProgress(child, allTasks)
    // Convert percentage back to days completed
    return sum + (child.duration * childProgress / 100)
  }, 0)

  return Math.round((completedDays / totalDays) * 100)
}

/**
 * Calculate progress for all tasks in the project.
 * This should be called whenever a task's completion status changes.
 *
 * @param tasks - All tasks in the project
 * @returns Tasks with updated percentComplete values
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

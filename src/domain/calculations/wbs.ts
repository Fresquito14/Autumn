/**
 * WBS (Work Breakdown Structure) utilities
 */

/**
 * Generate a new WBS code for a task
 */
export function generateWbsCode(
  parentCode: string | undefined,
  siblingCount: number
): string {
  if (!parentCode) {
    return `${siblingCount + 1}`
  }
  return `${parentCode}.${siblingCount + 1}`
}

/**
 * Get parent WBS code from a WBS code
 */
export function getParentWbsCode(wbsCode: string): string | undefined {
  const parts = wbsCode.split('.')
  if (parts.length === 1) {
    return undefined
  }
  parts.pop()
  return parts.join('.')
}

/**
 * Get level of a WBS code (0-indexed)
 */
export function getWbsLevel(wbsCode: string): number {
  if (!wbsCode) return 0
  return wbsCode.split('.').length - 1
}

/**
 * Get human-readable depth/level of a WBS code (1-indexed: "1" -> 1, "1.1" -> 2, "1.1.1" -> 3)
 */
export function getWbsDepth(wbsCode: string): number {
  if (!wbsCode) return 1
  return wbsCode.split('.').length
}

export interface WbsTaskLike {
  wbsCode?: string
  level?: number
}

/**
 * Get 1-based hierarchy level for a task
 */
export function getTaskLevel<T extends WbsTaskLike>(task: T): number {
  if (task.wbsCode) {
    return getWbsDepth(task.wbsCode)
  }
  return (task.level ?? 0) + 1
}

/**
 * Get maximum 1-based hierarchy level across a list of tasks
 */
export function getMaxWbsLevel<T extends WbsTaskLike>(tasks: T[]): number {
  if (!tasks || tasks.length === 0) return 0
  return Math.max(...tasks.map(t => getTaskLevel(t)), 0)
}

/**
 * Check if a task is visible given a maximum display level filter (0 = all, 1 = root tasks only, 2 = up to level 2, etc.)
 */
export function isTaskVisibleAtLevel<T extends WbsTaskLike>(
  task: T,
  maxDisplayLevel: number
): boolean {
  if (maxDisplayLevel === 0) return true
  return getTaskLevel(task) <= maxDisplayLevel
}

/**
 * Compare two WBS codes for sorting
 */
export function compareWbsCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

/**
 * Check if a WBS code is a descendant of another
 */
export function isDescendantOf(code: string, ancestorCode: string): boolean {
  return code.startsWith(ancestorCode + '.')
}

/**
 * Get children WBS codes from a list
 */
export function getChildrenCodes(
  allCodes: string[],
  parentCode: string | undefined
): string[] {
  return allCodes.filter((code) => {
    const parent = getParentWbsCode(code)
    return parent === parentCode
  })
}

export interface WbsUpdateItem {
  taskId: string
  newWbsCode: string
}

/**
 * Given all project tasks and an array of ordered siblings (tasks with same parentId),
 * computes all new WBS codes for the siblings and recursively for all their descendants.
 */
export function reindexSiblingsAndDescendants<T extends { id: string; wbsCode: string; parentId?: string }>(
  allTasks: T[],
  orderedSiblings: T[],
  parentWbsCode?: string
): WbsUpdateItem[] {
  const updates: WbsUpdateItem[] = []

  orderedSiblings.forEach((sibling, index) => {
    const newSiblingWbsCode = generateWbsCode(parentWbsCode, index)
    const oldSiblingWbsCode = sibling.wbsCode

    if (oldSiblingWbsCode !== newSiblingWbsCode) {
      updates.push({
        taskId: sibling.id,
        newWbsCode: newSiblingWbsCode,
      })

      // Find all descendants of this sibling in allTasks and update their prefixes
      const prefix = `${oldSiblingWbsCode}.`
      allTasks.forEach((otherTask) => {
        if (otherTask.wbsCode && otherTask.wbsCode.startsWith(prefix)) {
          const suffix = otherTask.wbsCode.slice(oldSiblingWbsCode.length)
          updates.push({
            taskId: otherTask.id,
            newWbsCode: `${newSiblingWbsCode}${suffix}`,
          })
        }
      })
    }
  })

  return updates
}

/**
 * Move a sibling task up or down within its current siblings.
 * Returns the list of task WBS updates to apply.
 */
export function calculateMoveSiblingUpdates<T extends { id: string; wbsCode: string; parentId?: string }>(
  tasks: T[],
  taskId: string,
  direction: 'up' | 'down'
): WbsUpdateItem[] {
  const targetTask = tasks.find((t) => t.id === taskId)
  if (!targetTask) return []

  const parentId = targetTask.parentId
  const parentTask = parentId ? tasks.find((t) => t.id === parentId) : undefined
  const parentWbsCode = parentTask?.wbsCode

  // Get current siblings sorted by current WBS code
  const siblings = tasks
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

  const currentIndex = siblings.findIndex((t) => t.id === taskId)
  if (currentIndex === -1) return []

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= siblings.length) return [] // Already at boundary

  // Swap in array
  const newSiblings = [...siblings]
  const [removed] = newSiblings.splice(currentIndex, 1)
  newSiblings.splice(targetIndex, 0, removed)

  return reindexSiblingsAndDescendants(tasks, newSiblings, parentWbsCode)
}

/**
 * Reorders a task before or after a target task (same parent or drag & drop).
 * Prevents moving a task into its own descendant.
 */
export function calculateReorderTaskUpdates<T extends { id: string; wbsCode: string; parentId?: string }>(
  tasks: T[],
  sourceTaskId: string,
  targetTaskId: string,
  position: 'before' | 'after'
): WbsUpdateItem[] {
  if (sourceTaskId === targetTaskId) return []

  const sourceTask = tasks.find((t) => t.id === sourceTaskId)
  const targetTask = tasks.find((t) => t.id === targetTaskId)
  if (!sourceTask || !targetTask) return []

  // Invariant / Edge case: Cannot drop into own descendant
  if (isDescendantOf(targetTask.wbsCode, sourceTask.wbsCode)) {
    return []
  }

  // Sibling reordering (when target has the same parent as source)
  if (sourceTask.parentId === targetTask.parentId) {
    const parentId = sourceTask.parentId
    const parentTask = parentId ? tasks.find((t) => t.id === parentId) : undefined
    const parentWbsCode = parentTask?.wbsCode

    const siblings = tasks
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

    const sourceIndex = siblings.findIndex((t) => t.id === sourceTaskId)
    const targetIndex = siblings.findIndex((t) => t.id === targetTaskId)
    if (sourceIndex === -1 || targetIndex === -1) return []

    const newSiblings = [...siblings]
    const [moved] = newSiblings.splice(sourceIndex, 1)

    // Calculate insertion index
    let insertIndex = newSiblings.findIndex((t) => t.id === targetTaskId)
    if (position === 'after') {
      insertIndex += 1
    }
    newSiblings.splice(insertIndex, 0, moved)

    return reindexSiblingsAndDescendants(tasks, newSiblings, parentWbsCode)
  }

  // Cross-parent reordering: source moves into target's parent group
  const newParentId = targetTask.parentId
  const newParentTask = newParentId ? tasks.find((t) => t.id === newParentId) : undefined
  const newParentWbsCode = newParentTask?.wbsCode

  // Target parent's siblings (excluding sourceTask)
  const targetSiblings = tasks
    .filter((t) => t.parentId === newParentId && t.id !== sourceTaskId)
    .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

  let insertIndex = targetSiblings.findIndex((t) => t.id === targetTaskId)
  if (position === 'after') {
    insertIndex += 1
  }
  targetSiblings.splice(insertIndex, 0, sourceTask)

  // Re-index target siblings with sourceTask
  const targetUpdates = reindexSiblingsAndDescendants(tasks, targetSiblings, newParentWbsCode)

  // Also re-index old siblings of sourceTask so there is no gap in old parent
  const oldParentId = sourceTask.parentId
  const oldParentTask = oldParentId ? tasks.find((t) => t.id === oldParentId) : undefined
  const oldParentWbsCode = oldParentTask?.wbsCode
  const oldSiblings = tasks
    .filter((t) => t.parentId === oldParentId && t.id !== sourceTaskId)
    .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

  const oldUpdates = reindexSiblingsAndDescendants(tasks, oldSiblings, oldParentWbsCode)

  // Combine updates
  const updateMap = new Map<string, string>()
  oldUpdates.forEach((u) => updateMap.set(u.taskId, u.newWbsCode))
  targetUpdates.forEach((u) => updateMap.set(u.taskId, u.newWbsCode))

  return Array.from(updateMap.entries()).map(([taskId, newWbsCode]) => ({ taskId, newWbsCode }))
}

/**
 * Calculates shifts needed when inserting a new task directly below an existing task.
 * Returns the new WBS code for the inserted task, and the list of updates for siblings that must shift down (+1).
 */
export function calculateInsertBelowUpdates<T extends { id: string; wbsCode: string; parentId?: string }>(
  tasks: T[],
  referenceTaskId: string
): { newWbsCode: string; parentId?: string; updates: WbsUpdateItem[] } {
  const referenceTask = tasks.find((t) => t.id === referenceTaskId)
  if (!referenceTask) {
    return { newWbsCode: '1', updates: [] }
  }

  const parentId = referenceTask.parentId
  const parentTask = parentId ? tasks.find((t) => t.id === parentId) : undefined
  const parentWbsCode = parentTask?.wbsCode

  // Siblings sorted by current WBS code
  const siblings = tasks
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => compareWbsCodes(a.wbsCode || '', b.wbsCode || ''))

  const refIndex = siblings.findIndex((t) => t.id === referenceTaskId)
  const insertIndex = refIndex + 1

  // The new task will have index `insertIndex`
  const newWbsCode = generateWbsCode(parentWbsCode, insertIndex)

  // All siblings at or after insertIndex must shift by +1
  const updates: WbsUpdateItem[] = []

  for (let i = insertIndex; i < siblings.length; i++) {
    const sibling = siblings[i]
    const oldCode = sibling.wbsCode
    const shiftedCode = generateWbsCode(parentWbsCode, i + 1)

    updates.push({
      taskId: sibling.id,
      newWbsCode: shiftedCode,
    })

    // Shift any descendants of this sibling
    const prefix = `${oldCode}.`
    tasks.forEach((otherTask) => {
      if (otherTask.wbsCode && otherTask.wbsCode.startsWith(prefix)) {
        const suffix = otherTask.wbsCode.slice(oldCode.length)
        updates.push({
          taskId: otherTask.id,
          newWbsCode: `${shiftedCode}${suffix}`,
        })
      }
    })
  }

  return { newWbsCode, parentId, updates }
}


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


/**
 * WBS (Work Breakdown Structure) utilities
 */

/**
 * Generate a new WBS code for a task
 * @param parentCode - Parent WBS code (undefined for root level)
 * @param siblingCount - Number of siblings at the same level
 * @returns New WBS code
 */
export function generateWbsCode(
  parentCode: string | undefined,
  siblingCount: number
): string {
  if (!parentCode) {
    // Root level task
    return `${siblingCount + 1}`
  }
  // Child task
  return `${parentCode}.${siblingCount + 1}`
}

/**
 * Get parent WBS code from a WBS code
 * @param wbsCode - Current WBS code
 * @returns Parent WBS code or undefined if root level
 */
export function getParentWbsCode(wbsCode: string): string | undefined {
  const parts = wbsCode.split('.')
  if (parts.length === 1) {
    return undefined // Root level
  }
  parts.pop()
  return parts.join('.')
}

/**
 * Get level of a WBS code (0-indexed)
 * @param wbsCode - WBS code
 * @returns Level (0 = root, 1 = first child, etc.)
 */
export function getWbsLevel(wbsCode: string): number {
  return wbsCode.split('.').length - 1
}

/**
 * Compare two WBS codes for sorting
 * @param a - First WBS code
 * @param b - Second WBS code
 * @returns -1, 0, or 1 for sorting
 */
export function compareWbsCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

/**
 * Check if a WBS code is a descendant of another
 * @param code - WBS code to check
 * @param ancestorCode - Potential ancestor WBS code
 * @returns True if code is a descendant of ancestorCode
 */
export function isDescendantOf(code: string, ancestorCode: string): boolean {
  return code.startsWith(ancestorCode + '.')
}

/**
 * Get children WBS codes from a list
 * @param allCodes - All WBS codes
 * @param parentCode - Parent WBS code (undefined for root)
 * @returns Array of direct children WBS codes
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

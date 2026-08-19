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
  return wbsCode.split('.').length - 1
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

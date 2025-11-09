import { describe, it, expect } from 'vitest'

/**
 * Tests for WBS (Work Breakdown Structure) code generation and hierarchy
 */
describe('WBS Code Management', () => {
  function generateWbsCode(parentCode: string | undefined, siblingCount: number): string {
    if (!parentCode) {
      // Root level task
      return `${siblingCount + 1}`
    }
    // Child task
    return `${parentCode}.${siblingCount + 1}`
  }

  function getParentWbsCode(wbsCode: string): string | undefined {
    const parts = wbsCode.split('.')
    if (parts.length === 1) {
      return undefined // Root level
    }
    parts.pop()
    return parts.join('.')
  }

  function getLevel(wbsCode: string): number {
    return wbsCode.split('.').length - 1
  }

  it('should generate root level WBS codes', () => {
    expect(generateWbsCode(undefined, 0)).toBe('1')
    expect(generateWbsCode(undefined, 1)).toBe('2')
    expect(generateWbsCode(undefined, 2)).toBe('3')
  })

  it('should generate child WBS codes', () => {
    expect(generateWbsCode('1', 0)).toBe('1.1')
    expect(generateWbsCode('1', 1)).toBe('1.2')
    expect(generateWbsCode('1.1', 0)).toBe('1.1.1')
  })

  it('should extract parent WBS code', () => {
    expect(getParentWbsCode('1')).toBeUndefined()
    expect(getParentWbsCode('1.1')).toBe('1')
    expect(getParentWbsCode('1.1.1')).toBe('1.1')
    expect(getParentWbsCode('2.3.4')).toBe('2.3')
  })

  it('should calculate correct level', () => {
    expect(getLevel('1')).toBe(0)
    expect(getLevel('1.1')).toBe(1)
    expect(getLevel('1.1.1')).toBe(2)
    expect(getLevel('1.2.3.4')).toBe(3)
  })

  it('should sort WBS codes correctly', () => {
    const codes = ['1.10', '1.2', '1.1', '2.1', '1.1.1', '1']
    const sorted = codes.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    )

    expect(sorted).toEqual(['1', '1.1', '1.1.1', '1.2', '1.10', '2.1'])
  })
})

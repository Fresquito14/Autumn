import { describe, it, expect } from 'vitest'
import {
  generateWbsCode,
  getParentWbsCode,
  getWbsLevel,
  getWbsDepth,
  getTaskLevel,
  getMaxWbsLevel,
  isTaskVisibleAtLevel,
  compareWbsCodes,
  isDescendantOf,
  getChildrenCodes,
} from '@/domain/calculations/wbs'

/**
 * Tests for WBS (Work Breakdown Structure) code generation, hierarchy, and level filtering
 */
describe('WBS Code Management & Level Filtering', () => {
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

  it('should calculate correct 0-indexed internal level', () => {
    expect(getWbsLevel('1')).toBe(0)
    expect(getWbsLevel('1.1')).toBe(1)
    expect(getWbsLevel('1.1.1')).toBe(2)
    expect(getWbsLevel('1.2.3.4')).toBe(3)
  })

  it('should calculate correct 1-indexed human depth/level', () => {
    expect(getWbsDepth('1')).toBe(1)
    expect(getWbsDepth('2')).toBe(1)
    expect(getWbsDepth('1.1')).toBe(2)
    expect(getWbsDepth('1.2')).toBe(2)
    expect(getWbsDepth('1.1.1')).toBe(3)
    expect(getWbsDepth('1.2.3.4')).toBe(4)
  })

  it('should calculate task level consistently from wbsCode or level fallback', () => {
    expect(getTaskLevel({ wbsCode: '1' })).toBe(1)
    expect(getTaskLevel({ wbsCode: '1.1' })).toBe(2)
    expect(getTaskLevel({ wbsCode: '1.1.1' })).toBe(3)
    expect(getTaskLevel({ level: 0 })).toBe(1)
    expect(getTaskLevel({ level: 1 })).toBe(2)
  })

  it('should calculate max WBS level across tasks', () => {
    const tasks = [
      { id: '1', wbsCode: '1', level: 0 },
      { id: '2', wbsCode: '1.1', level: 1 },
      { id: '3', wbsCode: '1.2', level: 1 },
      { id: '4', wbsCode: '1.2.1', level: 2 },
      { id: '5', wbsCode: '2', level: 0 },
    ]

    expect(getMaxWbsLevel(tasks)).toBe(3)
    expect(getMaxWbsLevel([])).toBe(0)
    expect(getMaxWbsLevel([{ id: '1', wbsCode: '1', level: 0 }])).toBe(1)
  })

  it('should filter tasks properly based on maxDisplayLevel', () => {
    const tasks = [
      { id: '1', name: 'Padre 1', wbsCode: '1', level: 0 },
      { id: '2', name: 'Hijo 1.1', wbsCode: '1.1', level: 1 },
      { id: '3', name: 'Hijo 1.2', wbsCode: '1.2', level: 1 },
      { id: '4', name: 'Nieto 1.2.1', wbsCode: '1.2.1', level: 2 },
      { id: '5', name: 'Padre 2', wbsCode: '2', level: 0 },
    ]

    // Level 1: Solo tareas de primer nivel (padre/raíz)
    const level1Tasks = tasks.filter(t => isTaskVisibleAtLevel(t, 1))
    expect(level1Tasks.map(t => t.wbsCode)).toEqual(['1', '2'])

    // Level 2: Tareas de nivel 1 y subapartados 1.1, 1.2
    const level2Tasks = tasks.filter(t => isTaskVisibleAtLevel(t, 2))
    expect(level2Tasks.map(t => t.wbsCode)).toEqual(['1', '1.1', '1.2', '2'])

    // Level 3: Tareas hasta nivel 3
    const level3Tasks = tasks.filter(t => isTaskVisibleAtLevel(t, 3))
    expect(level3Tasks.map(t => t.wbsCode)).toEqual(['1', '1.1', '1.2', '1.2.1', '2'])

    // Level 0 (Todos): Todas las tareas
    const allTasks = tasks.filter(t => isTaskVisibleAtLevel(t, 0))
    expect(allTasks.length).toBe(5)
  })

  it('should sort WBS codes correctly', () => {
    const codes = ['1.10', '1.2', '1.1', '2.1', '1.1.1', '1']
    const sorted = [...codes].sort(compareWbsCodes)

    expect(sorted).toEqual(['1', '1.1', '1.1.1', '1.2', '1.10', '2.1'])
  })

  it('should detect descendant codes correctly', () => {
    expect(isDescendantOf('1.1', '1')).toBe(true)
    expect(isDescendantOf('1.1.1', '1')).toBe(true)
    expect(isDescendantOf('1.1.1', '1.1')).toBe(true)
    expect(isDescendantOf('2.1', '1')).toBe(false)
    expect(isDescendantOf('10.1', '1')).toBe(false)
  })

  it('should get child codes correctly', () => {
    const allCodes = ['1', '1.1', '1.2', '1.2.1', '2', '2.1']
    expect(getChildrenCodes(allCodes, undefined)).toEqual(['1', '2'])
    expect(getChildrenCodes(allCodes, '1')).toEqual(['1.1', '1.2'])
    expect(getChildrenCodes(allCodes, '1.2')).toEqual(['1.2.1'])
  })
})

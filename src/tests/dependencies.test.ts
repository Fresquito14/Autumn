import { describe, it, expect, beforeEach } from 'vitest'
import type { Dependency } from '@/types'

/**
 * Tests for dependency validation logic
 * Specifically testing circular dependency detection
 */
describe('Dependency Validation', () => {
  let dependencies: Dependency[]

  beforeEach(() => {
    dependencies = []
  })

  function validateDependency(
    deps: Dependency[],
    predecessorId: string,
    successorId: string
  ): boolean {
    // Build adjacency list
    const graph = new Map<string, string[]>()
    deps.forEach(dep => {
      if (!graph.has(dep.predecessorId)) {
        graph.set(dep.predecessorId, [])
      }
      graph.get(dep.predecessorId)!.push(dep.successorId)
    })

    // Add the new dependency temporarily
    if (!graph.has(predecessorId)) {
      graph.set(predecessorId, [])
    }
    graph.get(predecessorId)!.push(successorId)

    // DFS to detect cycle
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function hasCycle(node: string): boolean {
      if (!visited.has(node)) {
        visited.add(node)
        recursionStack.add(node)

        const neighbors = graph.get(node) || []
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && hasCycle(neighbor)) {
            return true
          } else if (recursionStack.has(neighbor)) {
            return true
          }
        }
      }

      recursionStack.delete(node)
      return false
    }

    return !hasCycle(predecessorId)
  }

  it('should allow valid linear dependency', () => {
    // A -> B
    dependencies = [
      {
        id: '1',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskB',
        type: 'FS',
      },
    ]

    // Adding B -> C should be valid
    const isValid = validateDependency(dependencies, 'taskB', 'taskC')
    expect(isValid).toBe(true)
  })

  it('should detect simple circular dependency', () => {
    // A -> B
    dependencies = [
      {
        id: '1',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskB',
        type: 'FS',
      },
    ]

    // Adding B -> A creates a cycle
    const isValid = validateDependency(dependencies, 'taskB', 'taskA')
    expect(isValid).toBe(false)
  })

  it('should detect complex circular dependency', () => {
    // A -> B -> C
    dependencies = [
      {
        id: '1',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskB',
        type: 'FS',
      },
      {
        id: '2',
        projectId: 'proj1',
        predecessorId: 'taskB',
        successorId: 'taskC',
        type: 'FS',
      },
    ]

    // Adding C -> A creates a cycle
    const isValid = validateDependency(dependencies, 'taskC', 'taskA')
    expect(isValid).toBe(false)
  })

  it('should allow branching dependencies', () => {
    // A -> B
    // A -> C
    dependencies = [
      {
        id: '1',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskB',
        type: 'FS',
      },
      {
        id: '2',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskC',
        type: 'FS',
      },
    ]

    // Adding B -> D and C -> D should be valid
    const isValidBD = validateDependency(dependencies, 'taskB', 'taskD')
    const isValidCD = validateDependency(dependencies, 'taskC', 'taskD')
    expect(isValidBD).toBe(true)
    expect(isValidCD).toBe(true)
  })

  it('should allow self-contained sub-graphs', () => {
    // A -> B
    // C -> D (separate chain)
    dependencies = [
      {
        id: '1',
        projectId: 'proj1',
        predecessorId: 'taskA',
        successorId: 'taskB',
        type: 'FS',
      },
      {
        id: '2',
        projectId: 'proj1',
        predecessorId: 'taskC',
        successorId: 'taskD',
        type: 'FS',
      },
    ]

    // Adding B -> C connects the chains
    const isValid = validateDependency(dependencies, 'taskB', 'taskC')
    expect(isValid).toBe(true)
  })
})

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Dependency } from '@/types'
import { dbHelpers } from '@/lib/storage/db'

interface DependencyState {
  dependencies: Dependency[]
  isLoading: boolean
  error: string | null

  // Actions
  loadDependencies: (projectId: string) => Promise<void>
  getTaskDependencies: (taskId: string) => { predecessors: Dependency[]; successors: Dependency[] }
  createDependency: (dependency: Omit<Dependency, 'id'>) => Promise<string>
  deleteDependency: (id: string) => Promise<void>
  clearDependencies: () => void
  validateDependency: (predecessorId: string, successorId: string) => boolean
}

export const useDependencies = create<DependencyState>()(
  devtools(
    (set, get) => ({
      dependencies: [],
      isLoading: false,
      error: null,

      loadDependencies: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          const dependencies = await dbHelpers.getProjectDependencies(projectId)
          set({ dependencies, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getTaskDependencies: (taskId: string) => {
        const deps = get().dependencies
        const predecessors = deps.filter(d => d.successorId === taskId)
        const successors = deps.filter(d => d.predecessorId === taskId)
        return { predecessors, successors }
      },

      createDependency: async (dependencyData) => {
        set({ isLoading: true, error: null })
        try {
          // Validate: no circular dependencies
          const isValid = get().validateDependency(
            dependencyData.predecessorId,
            dependencyData.successorId
          )

          if (!isValid) {
            throw new Error('Circular dependency detected')
          }

          const dependency: Dependency = {
            ...dependencyData,
            id: crypto.randomUUID(),
            type: 'FS', // Only FS for now
            lag: dependencyData.lag || 0,
          }

          await dbHelpers.createDependency(dependency)

          const dependencies = await dbHelpers.getProjectDependencies(dependency.projectId)
          set({ dependencies, isLoading: false })

          return dependency.id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      deleteDependency: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const dependency = get().dependencies.find(d => d.id === id)
          if (!dependency) {
            set({ isLoading: false })
            return
          }

          await dbHelpers.deleteDependency(id)

          const dependencies = await dbHelpers.getProjectDependencies(dependency.projectId)
          set({ dependencies, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearDependencies: () => {
        set({ dependencies: [], error: null })
      },

      validateDependency: (predecessorId: string, successorId: string) => {
        // Check if adding this dependency would create a cycle
        const deps = get().dependencies

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

        // Check for cycles starting from the predecessor
        return !hasCycle(predecessorId)
      },
    }),
    { name: 'DependencyStore' }
  )
)

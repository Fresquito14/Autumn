import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Dependency } from '@/types'
import { dbHelpers } from '@/lib/storage/db'
import { supabase } from '@/lib/supabase/client'

interface DependencyState {
  dependencies: Dependency[]
  isLoading: boolean
  error: string | null

  // Actions
  loadDependencies: (projectId: string) => Promise<void>
  getTaskDependencies: (taskId: string) => { predecessors: Dependency[]; successors: Dependency[] }
  createDependency: (dependency: Omit<Dependency, 'id'>, recalculateDates?: boolean) => Promise<string>
  updateDependency: (id: string, updates: Partial<Omit<Dependency, 'id' | 'projectId'>>) => Promise<void>
  deleteDependency: (id: string, recalculateDates?: boolean) => Promise<void>
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
        set({ error: null })
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
          set({ dependencies })

          return dependency.id
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      updateDependency: async (id, updates) => {
        set({ error: null })
        try {
          const dependency = get().dependencies.find(d => d.id === id)
          if (!dependency) {
            throw new Error('Dependency not found')
          }

          // If predecessorId or successorId changed, validate
          if (updates.predecessorId || updates.successorId) {
            const newPredecessorId = updates.predecessorId || dependency.predecessorId
            const newSuccessorId = updates.successorId || dependency.successorId

            const isValid = get().validateDependency(newPredecessorId, newSuccessorId)
            if (!isValid) {
              throw new Error('Circular dependency detected')
            }
          }

          const updatedDependency: Dependency = {
            ...dependency,
            ...updates,
          }

          await dbHelpers.updateDependency(id, updatedDependency)

          const dependencies = await dbHelpers.getProjectDependencies(dependency.projectId)
          set({ dependencies })
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      deleteDependency: async (id) => {
        set({ error: null })
        try {
          const dependency = get().dependencies.find(d => d.id === id)
          if (!dependency) return

          await dbHelpers.deleteDependency(id)

          try {
            await supabase.from('dependencies').delete().eq('id', id)
          } catch (cloudErr) {
            console.warn('Cloud delete dependency skipped:', cloudErr)
          }

          const dependencies = await dbHelpers.getProjectDependencies(dependency.projectId)
          set({ dependencies })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      clearDependencies: () => {
        set({ dependencies: [], error: null })
      },

      validateDependency: (predecessorId: string, successorId: string) => {
        const deps = get().dependencies

        const graph = new Map<string, string[]>()
        deps.forEach(dep => {
          if (!graph.has(dep.predecessorId)) {
            graph.set(dep.predecessorId, [])
          }
          graph.get(dep.predecessorId)!.push(dep.successorId)
        })

        if (!graph.has(predecessorId)) {
          graph.set(predecessorId, [])
        }
        graph.get(predecessorId)!.push(successorId)

        const visited = new Set<string>()
        const recStack = new Set<string>()

        function isCyclic(nodeId: string): boolean {
          visited.add(nodeId)
          recStack.add(nodeId)

          const neighbors = graph.get(nodeId) || []
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              if (isCyclic(neighbor)) {
                return true
              }
            } else if (recStack.has(neighbor)) {
              return true
            }
          }

          recStack.delete(nodeId)
          return false
        }

        const allNodes = new Set<string>()
        deps.forEach(d => {
          allNodes.add(d.predecessorId)
          allNodes.add(d.successorId)
        })
        allNodes.add(predecessorId)
        allNodes.add(successorId)

        for (const node of allNodes) {
          if (!visited.has(node)) {
            if (isCyclic(node)) {
              return false // Cycle found
            }
          }
        }

        return true // No cycles
      },
    }),
    { name: 'DependencyStore' }
  )
)

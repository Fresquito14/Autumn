export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface Dependency {
  id: string
  projectId: string
  predecessorId: string  // Task ID
  successorId: string    // Task ID
  type: 'FS'             // Only Finish-to-Start for now
  lag?: number           // Days of delay (0 by default)
}

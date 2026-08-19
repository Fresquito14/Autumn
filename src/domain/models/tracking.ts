import type { Task } from './task'
import type { Dependency } from './dependency'

export interface TimeEntry {
  id: string
  taskId: string
  resourceId: string
  date: Date
  hours: number
  notes?: string
}

export interface Baseline {
  id: string
  projectId: string
  name: string // "Original Plan", "Revision 1"
  createdAt: Date
  snapshot: {
    tasks: Task[]
    dependencies: Dependency[]
  }
}

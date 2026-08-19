import type { Project } from './project'
import type { Task, Milestone } from './task'
import type { Dependency } from './dependency'
import type { Resource, TaskResourceAssignment } from './resource'
import type { Baseline } from './tracking'

export interface ProjectExportData {
  version: string // Schema version for compatibility
  exportedAt: Date
  project: Project
  tasks: Task[]
  dependencies: Dependency[]
  resources: Resource[]
  milestones: Milestone[]
  baselines: Baseline[]
  taskResourceAssignments?: TaskResourceAssignment[]
}

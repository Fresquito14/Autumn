import type { Project, Task, Dependency, Resource, Milestone, Baseline, TaskResourceAssignment } from './index'

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

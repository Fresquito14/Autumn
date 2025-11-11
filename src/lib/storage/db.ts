import Dexie, { type EntityTable } from 'dexie'
import type {
  Project,
  Task,
  Milestone,
  Dependency,
  Resource,
  TimeEntry,
  Baseline,
} from '@/types'

// Database class extending Dexie
class AutumnDatabase extends Dexie {
  // Declare tables
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  dependencies!: EntityTable<Dependency, 'id'>
  resources!: EntityTable<Resource, 'id'>
  timeEntries!: EntityTable<TimeEntry, 'id'>
  baselines!: EntityTable<Baseline, 'id'>

  constructor() {
    super('AutumnDB')

    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, wbsCode, parentId, level, startDate, endDate, createdAt, updatedAt, [projectId+wbsCode]',
      milestones: 'id, projectId, date, linkedTaskId',
      dependencies: 'id, projectId, predecessorId, successorId, [projectId+predecessorId], [projectId+successorId]',
      resources: 'id, projectId, name',
      timeEntries: 'id, taskId, resourceId, date, [taskId+resourceId]',
      baselines: 'id, projectId, createdAt',
    })
  }
}

// Export a singleton instance
export const db = new AutumnDatabase()

// Helper functions for common operations
export const dbHelpers = {
  // Projects
  async getAllProjects() {
    return await db.projects.toArray()
  },

  async getProject(id: string) {
    return await db.projects.get(id)
  },

  async createProject(project: Project) {
    return await db.projects.add(project)
  },

  async updateProject(id: string, changes: Partial<Project>) {
    return await db.projects.update(id, {
      ...changes,
      updatedAt: new Date(),
    })
  },

  async deleteProject(id: string) {
    await db.transaction('rw', [db.projects, db.tasks, db.milestones, db.dependencies, db.resources, db.timeEntries, db.baselines], async () => {
      await db.tasks.where('projectId').equals(id).delete()
      await db.milestones.where('projectId').equals(id).delete()
      await db.dependencies.where('projectId').equals(id).delete()
      await db.resources.where('projectId').equals(id).delete()
      await db.baselines.where('projectId').equals(id).delete()
      await db.projects.delete(id)
    })
  },

  // Tasks
  async getProjectTasks(projectId: string) {
    return await db.tasks.where('projectId').equals(projectId).toArray()
  },

  async getTask(id: string) {
    return await db.tasks.get(id)
  },

  async createTask(task: Task) {
    return await db.tasks.add(task)
  },

  async updateTask(id: string, changes: Partial<Task>) {
    return await db.tasks.update(id, {
      ...changes,
      updatedAt: new Date(),
    })
  },

  async deleteTask(id: string) {
    await db.transaction('rw', [db.tasks, db.dependencies], async () => {
      // Delete dependencies related to this task
      await db.dependencies.where('predecessorId').equals(id).delete()
      await db.dependencies.where('successorId').equals(id).delete()
      // Delete the task
      await db.tasks.delete(id)
    })
  },

  // Dependencies
  async getProjectDependencies(projectId: string) {
    return await db.dependencies.where('projectId').equals(projectId).toArray()
  },

  async getTaskDependencies(taskId: string) {
    const predecessors = await db.dependencies.where('successorId').equals(taskId).toArray()
    const successors = await db.dependencies.where('predecessorId').equals(taskId).toArray()
    return { predecessors, successors }
  },

  async createDependency(dependency: Dependency) {
    return await db.dependencies.add(dependency)
  },

  async updateDependency(id: string, dependency: Dependency) {
    return await db.dependencies.update(id, dependency)
  },

  async deleteDependency(id: string) {
    return await db.dependencies.delete(id)
  },

  // Resources
  async getProjectResources(projectId: string) {
    return await db.resources.where('projectId').equals(projectId).toArray()
  },

  async getResource(id: string) {
    return await db.resources.get(id)
  },

  async createResource(resource: Resource) {
    return await db.resources.add(resource)
  },

  async updateResource(id: string, changes: Partial<Resource>) {
    return await db.resources.update(id, changes)
  },

  async deleteResource(id: string) {
    return await db.resources.delete(id)
  },

  // Milestones
  async getProjectMilestones(projectId: string) {
    return await db.milestones.where('projectId').equals(projectId).toArray()
  },

  async createMilestone(milestone: Milestone) {
    return await db.milestones.add(milestone)
  },

  async updateMilestone(id: string, changes: Partial<Milestone>) {
    return await db.milestones.update(id, changes)
  },

  async deleteMilestone(id: string) {
    return await db.milestones.delete(id)
  },

  // Time Entries
  async getTaskTimeEntries(taskId: string) {
    return await db.timeEntries.where('taskId').equals(taskId).toArray()
  },

  async createTimeEntry(entry: TimeEntry) {
    return await db.timeEntries.add(entry)
  },

  async deleteTimeEntry(id: string) {
    return await db.timeEntries.delete(id)
  },

  // Baselines
  async getProjectBaselines(projectId: string) {
    return await db.baselines.where('projectId').equals(projectId).toArray()
  },

  async createBaseline(baseline: Baseline) {
    return await db.baselines.add(baseline)
  },

  async getBaseline(id: string) {
    return await db.baselines.get(id)
  },

  async deleteBaseline(id: string) {
    return await db.baselines.delete(id)
  },

  // Development/Debug utilities
  async clearAllData() {
    await db.transaction('rw', [db.projects, db.tasks, db.milestones, db.dependencies, db.resources, db.timeEntries, db.baselines], async () => {
      await db.projects.clear()
      await db.tasks.clear()
      await db.milestones.clear()
      await db.dependencies.clear()
      await db.resources.clear()
      await db.timeEntries.clear()
      await db.baselines.clear()
    })
  },

  async deleteDatabase() {
    await db.delete()
    // Reload the page to reinitialize the database
    window.location.reload()
  },
}

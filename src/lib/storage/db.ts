import Dexie, { type EntityTable } from 'dexie'
import type {
  Project,
  Task,
  Milestone,
  Dependency,
  Resource,
  TimeEntry,
  Baseline,
  TaskResourceAssignment,
} from '@/types'

// Database class extending Dexie
class AutumnDatabase extends Dexie {
  // Declare tables
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  dependencies!: EntityTable<Dependency, 'id'>
  resources!: EntityTable<Resource, 'id'>
  taskResourceAssignments!: EntityTable<TaskResourceAssignment, 'id'>
  timeEntries!: EntityTable<TimeEntry, 'id'>
  baselines!: EntityTable<Baseline, 'id'>

  constructor() {
    super('AutumnDB')

    // Version 1: Initial schema with project-scoped resources
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, wbsCode, parentId, level, startDate, endDate, createdAt, updatedAt, [projectId+wbsCode]',
      milestones: 'id, projectId, date, linkedTaskId',
      dependencies: 'id, projectId, predecessorId, successorId, [projectId+predecessorId], [projectId+successorId]',
      resources: 'id, projectId, name',
      timeEntries: 'id, taskId, resourceId, date, [taskId+resourceId]',
      baselines: 'id, projectId, createdAt',
    })

    // Version 2: Global resources + task resource assignments
    this.version(2).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, wbsCode, parentId, level, startDate, endDate, createdAt, updatedAt, [projectId+wbsCode]',
      milestones: 'id, projectId, date, linkedTaskId',
      dependencies: 'id, projectId, predecessorId, successorId, [projectId+predecessorId], [projectId+successorId]',
      resources: 'id, name, email', // Removed projectId - resources are now global
      taskResourceAssignments: 'id, taskId, resourceId, [taskId+resourceId]', // New table for assignments
      timeEntries: 'id, taskId, resourceId, date, [taskId+resourceId]',
      baselines: 'id, projectId, createdAt',
    }).upgrade(async (trans) => {
      // Migration: Remove projectId from existing resources
      // This allows existing resources to become global
      // Note: Any duplicate resource names across projects will remain separate entities
      const resources = await trans.table('resources').toArray()
      await trans.table('resources').clear()
      await trans.table('resources').bulkAdd(resources.map(r => {
        const { projectId, ...rest } = r as any
        return rest
      }))
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
    await db.transaction('rw', [db.projects, db.tasks, db.milestones, db.dependencies, db.taskResourceAssignments, db.timeEntries, db.baselines], async () => {
      // Get all tasks for this project
      const projectTasks = await db.tasks.where('projectId').equals(id).toArray()
      const taskIds = projectTasks.map(t => t.id)

      // Delete task resource assignments for these tasks
      for (const taskId of taskIds) {
        await db.taskResourceAssignments.where('taskId').equals(taskId).delete()
      }

      // Delete project-related data
      await db.tasks.where('projectId').equals(id).delete()
      await db.milestones.where('projectId').equals(id).delete()
      await db.dependencies.where('projectId').equals(id).delete()
      await db.baselines.where('projectId').equals(id).delete()

      // Note: Resources are now global, so we don't delete them when deleting a project
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
    await db.transaction('rw', [db.tasks, db.dependencies, db.taskResourceAssignments, db.timeEntries], async () => {
      // Delete dependencies related to this task
      await db.dependencies.where('predecessorId').equals(id).delete()
      await db.dependencies.where('successorId').equals(id).delete()
      // Delete resource assignments for this task
      await db.taskResourceAssignments.where('taskId').equals(id).delete()
      // Delete time entries for this task
      await db.timeEntries.where('taskId').equals(id).delete()
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

  // Resources (Global)
  async getAllResources() {
    return await db.resources.toArray()
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
    await db.transaction('rw', [db.resources, db.taskResourceAssignments], async () => {
      // Delete all assignments for this resource
      await db.taskResourceAssignments.where('resourceId').equals(id).delete()
      // Delete the resource
      await db.resources.delete(id)
    })
  },

  // Get resources assigned to a specific project (via tasks)
  async getProjectResources(projectId: string) {
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    const taskIds = tasks.map(t => t.id)
    const assignments = await db.taskResourceAssignments.where('taskId').anyOf(taskIds).toArray()
    const resourceIds = [...new Set(assignments.map(a => a.resourceId))]
    return await db.resources.where('id').anyOf(resourceIds).toArray()
  },

  // Task Resource Assignments
  async getAllAssignments() {
    return await db.taskResourceAssignments.toArray()
  },

  async getTaskAssignments(taskId: string) {
    return await db.taskResourceAssignments.where('taskId').equals(taskId).toArray()
  },

  async getResourceAssignments(resourceId: string) {
    return await db.taskResourceAssignments.where('resourceId').equals(resourceId).toArray()
  },

  async createTaskAssignment(assignment: TaskResourceAssignment) {
    return await db.taskResourceAssignments.add(assignment)
  },

  async updateTaskAssignment(id: string, changes: Partial<TaskResourceAssignment>) {
    return await db.taskResourceAssignments.update(id, changes)
  },

  async deleteTaskAssignment(id: string) {
    return await db.taskResourceAssignments.delete(id)
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
    await db.transaction('rw', [db.projects, db.tasks, db.milestones, db.dependencies, db.resources, db.taskResourceAssignments, db.timeEntries, db.baselines], async () => {
      await db.projects.clear()
      await db.tasks.clear()
      await db.milestones.clear()
      await db.dependencies.clear()
      await db.resources.clear()
      await db.taskResourceAssignments.clear()
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

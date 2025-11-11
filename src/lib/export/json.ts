import { db, dbHelpers } from '../storage/db'
import type { ProjectExportData } from '@/types/export'
import type { Project, Task, Dependency, Resource, Milestone } from '@/types'

// Pokémon version names (Generation 1)
const POKEMON_VERSIONS = [
  'Bulbasaur',   // #001
  'Ivysaur',     // #002
  'Venusaur',    // #003
  'Charmander',  // #004
  'Charmeleon',  // #005
  'Charizard',   // #006
  'Squirtle',    // #007
  'Wartortle',   // #008
  'Blastoise',   // #009
  'Caterpie',    // #010
  'Metapod',     // #011
  'Butterfree',  // #012
  'Weedle',      // #013
  'Kakuna',      // #014
  'Beedrill',    // #015
  'Pidgey',      // #016
  'Pidgeotto',   // #017
  'Pidgeot',     // #018
  'Rattata',     // #019
  'Raticate',    // #020
]

const CURRENT_VERSION = 1
const EXPORT_VERSION = `${CURRENT_VERSION}.0-${POKEMON_VERSIONS[CURRENT_VERSION - 1]}`

/**
 * Export a complete project to JSON format
 */
export async function exportProject(projectId: string): Promise<ProjectExportData> {
  // Load all project data
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  const [tasks, dependencies, resources, milestones, baselines] = await Promise.all([
    dbHelpers.getProjectTasks(projectId),
    dbHelpers.getProjectDependencies(projectId),
    dbHelpers.getProjectResources(projectId),
    dbHelpers.getProjectMilestones(projectId),
    db.baselines.where('projectId').equals(projectId).toArray(),
  ])

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date(),
    project,
    tasks,
    dependencies,
    resources,
    milestones,
    baselines,
  }
}

/**
 * Download project as JSON file
 */
export async function downloadProjectAsJSON(projectId: string, filename?: string): Promise<void> {
  const data = await exportProject(projectId)

  // Use project name in filename if not provided
  const exportFilename = filename || `proyecto-${data.project.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`

  // Convert to JSON string with formatting
  const json = JSON.stringify(data, null, 2)

  // Create blob and trigger download
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = exportFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up
  URL.revokeObjectURL(url)
}

/**
 * Validate imported project data
 */
export function validateProjectImport(data: unknown): ProjectExportData | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const exportData = data as Partial<ProjectExportData>

  // Check required fields
  if (!exportData.version || !exportData.project) {
    return null
  }

  // Check project has required fields
  const project = exportData.project as Partial<Project>
  if (!project.name || !project.startDate || !project.config) {
    return null
  }

  // Ensure arrays exist (even if empty)
  return {
    version: exportData.version,
    exportedAt: exportData.exportedAt || new Date(),
    project: exportData.project,
    tasks: exportData.tasks || [],
    dependencies: exportData.dependencies || [],
    resources: exportData.resources || [],
    milestones: exportData.milestones || [],
    baselines: exportData.baselines || [],
  }
}

/**
 * Generate new IDs for all entities to avoid collisions
 */
function remapIds(data: ProjectExportData): {
  project: Project
  tasks: Task[]
  dependencies: Dependency[]
  resources: Resource[]
  milestones: Milestone[]
} {
  const idMap = new Map<string, string>()

  // Generate new project ID
  const newProjectId = crypto.randomUUID()
  idMap.set(data.project.id, newProjectId)

  // Generate new IDs for all entities
  data.tasks.forEach(task => idMap.set(task.id, crypto.randomUUID()))
  data.dependencies.forEach(dep => idMap.set(dep.id, crypto.randomUUID()))
  data.resources.forEach(res => idMap.set(res.id, crypto.randomUUID()))
  data.milestones.forEach(ms => idMap.set(ms.id, crypto.randomUUID()))

  // Remap project
  const project: Project = {
    ...data.project,
    id: newProjectId,
    startDate: new Date(data.project.startDate),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Remap tasks
  const tasks: Task[] = data.tasks.map(task => ({
    ...task,
    id: idMap.get(task.id)!,
    projectId: newProjectId,
    parentId: task.parentId ? idMap.get(task.parentId) : undefined,
    assignedTo: task.assignedTo?.map(resId => idMap.get(resId) || resId) || [],
    // Convert date strings back to Date objects
    startDate: new Date(task.startDate),
    endDate: new Date(task.endDate),
    actualStartDate: task.actualStartDate ? new Date(task.actualStartDate) : undefined,
    actualEndDate: task.actualEndDate ? new Date(task.actualEndDate) : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  // Remap dependencies
  const dependencies: Dependency[] = data.dependencies.map(dep => ({
    ...dep,
    id: idMap.get(dep.id)!,
    projectId: newProjectId,
    predecessorId: idMap.get(dep.predecessorId) || dep.predecessorId,
    successorId: idMap.get(dep.successorId) || dep.successorId,
  }))

  // Remap resources
  const resources: Resource[] = data.resources.map(res => ({
    ...res,
    id: idMap.get(res.id)!,
    projectId: newProjectId,
  }))

  // Remap milestones
  const milestones: Milestone[] = data.milestones.map(ms => ({
    ...ms,
    id: idMap.get(ms.id)!,
    projectId: newProjectId,
    linkedTaskId: ms.linkedTaskId ? idMap.get(ms.linkedTaskId) : undefined,
    date: new Date(ms.date),
  }))

  return { project, tasks, dependencies, resources, milestones }
}

/**
 * Import a project from JSON data
 */
export async function importProject(data: ProjectExportData): Promise<string> {
  // Validate data
  const validatedData = validateProjectImport(data)
  if (!validatedData) {
    throw new Error('Invalid project data')
  }

  // Remap all IDs to avoid collisions
  const { project, tasks, dependencies, resources, milestones } = remapIds(validatedData)

  // Import everything in a transaction
  await db.transaction('rw', [
    db.projects,
    db.tasks,
    db.dependencies,
    db.resources,
    db.milestones,
  ], async () => {
    // Create project
    await db.projects.add(project)

    // Create resources first (tasks might reference them)
    if (resources.length > 0) {
      await db.resources.bulkAdd(resources)
    }

    // Create tasks
    if (tasks.length > 0) {
      await db.tasks.bulkAdd(tasks)
    }

    // Create dependencies
    if (dependencies.length > 0) {
      await db.dependencies.bulkAdd(dependencies)
    }

    // Create milestones
    if (milestones.length > 0) {
      await db.milestones.bulkAdd(milestones)
    }
  })

  return project.id
}

/**
 * Read and parse JSON file from file input
 */
export function readProjectFile(file: File): Promise<ProjectExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const json = e.target?.result as string
        const data = JSON.parse(json)
        const validated = validateProjectImport(data)

        if (!validated) {
          reject(new Error('Archivo JSON inválido o corrupto'))
          return
        }

        resolve(validated)
      } catch (error) {
        reject(new Error('Error al leer el archivo: ' + (error as Error).message))
      }
    }

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'))
    }

    reader.readAsText(file)
  })
}

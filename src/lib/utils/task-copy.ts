import type { Task, Dependency } from '@/types'

/**
 * Gets all descendant tasks of a given task (children, grandchildren, etc.)
 */
export function getDescendantTasks(taskId: string, allTasks: Task[]): Task[] {
  const descendants: Task[] = []
  const directChildren = allTasks.filter(t => t.parentId === taskId)

  for (const child of directChildren) {
    descendants.push(child)
    // Recursively get children's descendants
    descendants.push(...getDescendantTasks(child.id, allTasks))
  }

  return descendants
}

/**
 * Generates a new WBS code for a task under a new parent
 */
function generateNewWbsCode(
  newParentWbsCode: string,
  siblingCodes: string[]
): string {
  // Get all children codes that start with the parent code
  const childrenCodes = siblingCodes.filter(code =>
    code.startsWith(newParentWbsCode + '.')
  )

  // Extract the next number at this level
  const parentLevel = newParentWbsCode.split('.').length
  const existingNumbers = childrenCodes
    .map(code => {
      const parts = code.split('.')
      if (parts.length === parentLevel + 1) {
        return parseInt(parts[parentLevel])
      }
      return 0
    })
    .filter(n => !isNaN(n))

  const nextNumber = existingNumbers.length > 0
    ? Math.max(...existingNumbers) + 1
    : 1

  return `${newParentWbsCode}.${nextNumber}`
}

/**
 * Copies a task block (a task and all its descendants) to a new parent
 * Returns the created tasks and dependencies
 */
export async function copyTaskBlock(
  sourceTaskId: string,
  targetParentId: string | undefined,
  allTasks: Task[],
  allDependencies: Dependency[],
  projectId: string
): Promise<{
  tasks: Task[]
  dependencies: Dependency[]
}> {
  // Get the source task and all its descendants
  const sourceTask = allTasks.find(t => t.id === sourceTaskId)
  if (!sourceTask) {
    throw new Error('Source task not found')
  }

  const descendants = getDescendantTasks(sourceTaskId, allTasks)
  const blockTasks = [sourceTask, ...descendants]
  const blockTaskIds = new Set(blockTasks.map(t => t.id))

  // Get target parent task (if specified)
  const targetParent = targetParentId
    ? allTasks.find(t => t.id === targetParentId)
    : undefined

  // Map old IDs to new IDs
  const idMap = new Map<string, string>()
  const newTasks: Task[] = []

  // Sort tasks by level to ensure parents are created before children
  const sortedBlockTasks = [...blockTasks].sort((a, b) => a.level - b.level)

  // Get all WBS codes for generating unique codes
  const allWbsCodes = allTasks.map(t => t.wbsCode)

  // Copy each task
  for (const oldTask of sortedBlockTasks) {
    const newId = crypto.randomUUID()
    idMap.set(oldTask.id, newId)

    // Determine new parent ID
    let newParentId: string | undefined
    if (oldTask.id === sourceTaskId) {
      // This is the root of the block - set to target parent
      newParentId = targetParentId
    } else if (oldTask.parentId) {
      // This is a descendant - map to new parent ID
      newParentId = idMap.get(oldTask.parentId)
    }

    // Generate new WBS code
    let newWbsCode: string
    if (oldTask.id === sourceTaskId) {
      // Root of the block
      if (targetParent) {
        newWbsCode = generateNewWbsCode(targetParent.wbsCode, [...allWbsCodes, ...newTasks.map(t => t.wbsCode)])
      } else {
        // No parent - top level
        const topLevelNumbers = allTasks
          .filter(t => !t.parentId)
          .map(t => parseInt(t.wbsCode))
          .filter(n => !isNaN(n))
        const nextNumber = topLevelNumbers.length > 0
          ? Math.max(...topLevelNumbers) + 1
          : 1
        newWbsCode = String(nextNumber)
      }
    } else {
      // Descendant task - preserve relative structure
      const newParentTask = newTasks.find(t => t.id === newParentId)
      if (newParentTask) {
        newWbsCode = generateNewWbsCode(newParentTask.wbsCode, [...allWbsCodes, ...newTasks.map(t => t.wbsCode)])
      } else {
        throw new Error('Parent task not found in new tasks')
      }
    }

    // Calculate new level
    const newLevel = targetParent
      ? (oldTask.id === sourceTaskId
          ? targetParent.level + 1
          : targetParent.level + 1 + (oldTask.level - sourceTask.level))
      : (oldTask.id === sourceTaskId
          ? 0
          : oldTask.level - sourceTask.level)

    // Create new task (copy all properties)
    const now = new Date()
    const newTask: Task = {
      ...oldTask,
      id: newId,
      projectId,
      parentId: newParentId,
      wbsCode: newWbsCode,
      level: newLevel,
      // Dates will be recalculated automatically
      createdAt: now,
      updatedAt: now,
    }

    newTasks.push(newTask)
    allWbsCodes.push(newWbsCode)
  }

  // Copy dependencies
  const newDependencies: Dependency[] = []

  for (const dep of allDependencies) {
    const isPredecessorInBlock = blockTaskIds.has(dep.predecessorId)
    const isSuccessorInBlock = blockTaskIds.has(dep.successorId)

    if (isPredecessorInBlock && isSuccessorInBlock) {
      // Internal dependency - remap both IDs
      const newPredecessorId = idMap.get(dep.predecessorId)
      const newSuccessorId = idMap.get(dep.successorId)

      if (newPredecessorId && newSuccessorId) {
        newDependencies.push({
          id: crypto.randomUUID(),
          projectId,
          predecessorId: newPredecessorId,
          successorId: newSuccessorId,
          type: dep.type,
          lag: dep.lag,
        })
      }
    } else if (!isPredecessorInBlock && isSuccessorInBlock) {
      // External predecessor - keep original predecessor, remap successor
      const newSuccessorId = idMap.get(dep.successorId)

      if (newSuccessorId) {
        newDependencies.push({
          id: crypto.randomUUID(),
          projectId,
          predecessorId: dep.predecessorId, // Keep original
          successorId: newSuccessorId,
          type: dep.type,
          lag: dep.lag,
        })
      }
    }
    // If predecessor is in block but successor is not, we don't copy
    // (the dependency points outward from the block)
  }

  return {
    tasks: newTasks,
    dependencies: newDependencies,
  }
}

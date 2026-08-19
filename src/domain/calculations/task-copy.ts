import type { Task, Dependency } from '@/domain/models'

/**
 * Gets all descendant tasks of a given task (children, grandchildren, etc.)
 */
export function getDescendantTasks(taskId: string, allTasks: Task[]): Task[] {
  const descendants: Task[] = []
  const directChildren = allTasks.filter(t => t.parentId === taskId)

  for (const child of directChildren) {
    descendants.push(child)
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
  const childrenCodes = siblingCodes.filter(code =>
    code.startsWith(newParentWbsCode + '.')
  )

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
  const sourceTask = allTasks.find(t => t.id === sourceTaskId)
  if (!sourceTask) {
    throw new Error('Source task not found')
  }

  const descendants = getDescendantTasks(sourceTaskId, allTasks)
  const blockTasks = [sourceTask, ...descendants]
  const blockTaskIds = new Set(blockTasks.map(t => t.id))

  const targetParent = targetParentId
    ? allTasks.find(t => t.id === targetParentId)
    : undefined

  const idMap = new Map<string, string>()
  const newTasks: Task[] = []

  const sortedBlockTasks = [...blockTasks].sort((a, b) => a.level - b.level)
  const allWbsCodes = allTasks.map(t => t.wbsCode)

  for (const oldTask of sortedBlockTasks) {
    const newId = crypto.randomUUID()
    idMap.set(oldTask.id, newId)

    let newParentId: string | undefined
    if (oldTask.id === sourceTaskId) {
      newParentId = targetParentId
    } else if (oldTask.parentId) {
      newParentId = idMap.get(oldTask.parentId)
    }

    let newWbsCode: string
    if (oldTask.id === sourceTaskId) {
      if (targetParent) {
        newWbsCode = generateNewWbsCode(targetParent.wbsCode, [...allWbsCodes, ...newTasks.map(t => t.wbsCode)])
      } else {
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
      const newParentTask = newTasks.find(t => t.id === newParentId)
      if (newParentTask) {
        newWbsCode = generateNewWbsCode(newParentTask.wbsCode, [...allWbsCodes, ...newTasks.map(t => t.wbsCode)])
      } else {
        throw new Error('Parent task not found in new tasks')
      }
    }

    const newLevel = targetParent
      ? (oldTask.id === sourceTaskId
          ? targetParent.level + 1
          : targetParent.level + 1 + (oldTask.level - sourceTask.level))
      : (oldTask.id === sourceTaskId
          ? 0
          : oldTask.level - sourceTask.level)

    const now = new Date()
    const newTask: Task = {
      ...oldTask,
      id: newId,
      projectId,
      parentId: newParentId,
      wbsCode: newWbsCode,
      level: newLevel,
      createdAt: now,
      updatedAt: now,
    }

    newTasks.push(newTask)
    allWbsCodes.push(newWbsCode)
  }

  const newDependencies: Dependency[] = []

  for (const dep of allDependencies) {
    const isPredecessorInBlock = blockTaskIds.has(dep.predecessorId)
    const isSuccessorInBlock = blockTaskIds.has(dep.successorId)

    if (isPredecessorInBlock && isSuccessorInBlock) {
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
      const newSuccessorId = idMap.get(dep.successorId)

      if (newSuccessorId) {
        newDependencies.push({
          id: crypto.randomUUID(),
          projectId,
          predecessorId: dep.predecessorId,
          successorId: newSuccessorId,
          type: dep.type,
          lag: dep.lag,
        })
      }
    }
  }

  return {
    tasks: newTasks,
    dependencies: newDependencies,
  }
}

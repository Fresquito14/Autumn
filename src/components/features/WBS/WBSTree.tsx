import { useState, useEffect } from 'react'
import { List, ChevronsDown, ChevronsUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TaskRow } from './TaskRow'
import { TaskFormDialog } from './TaskFormDialog'
import { LevelFilter } from './LevelFilter'
import { useTasks } from '@/hooks/useTasks'
import { useLevelFilter } from '@/hooks/useLevelFilter'
import { useProject } from '@/hooks/useProject'
import type { Task } from '@/types'

export function WBSTree() {
  const { tasks, loadTasks, isLoading } = useTasks()
  const { currentProject } = useProject()
  const { maxDisplayLevel, setMaxDisplayLevel } = useLevelFilter()
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id)
    }
  }, [currentProject, loadTasks])

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const getChildTasks = (parentId: string | undefined): Task[] => {
    return tasks.filter((task) => task.parentId === parentId)
  }

  const hasChildren = (taskId: string): boolean => {
    return tasks.some((task) => task.parentId === taskId)
  }

  const renderTask = (task: Task): React.ReactNode => {
    const children = getFilteredChildTasks(task.id)
    const isExpanded = expandedTasks.has(task.id)
    const taskHasChildren = children.length > 0

    return (
      <div key={task.id}>
        <TaskRow
          task={task}
          hasChildren={taskHasChildren}
          isExpanded={isExpanded}
          onToggleExpand={() => toggleExpand(task.id)}
          level={task.level}
        />
        {taskHasChildren && isExpanded && (
          <div>
            {children.map((child) => renderTask(child))}
          </div>
        )}
      </div>
    )
  }

  const rootTasks = getChildTasks(undefined)

  // Calculate max level in tasks
  const maxLevel = Math.max(...tasks.map(t => t.level), 0)

  // Filter tasks based on maxDisplayLevel
  const shouldShowTask = (task: Task): boolean => {
    if (maxDisplayLevel === 0) return true
    return task.level <= maxDisplayLevel
  }

  const getFilteredChildTasks = (parentId: string | undefined): Task[] => {
    return tasks.filter((task) => task.parentId === parentId && shouldShowTask(task))
  }

  const filteredRootTasks = getFilteredChildTasks(undefined)

  // Get all task IDs for expand/collapse all functionality
  const allTaskIds = tasks.map(t => t.id)
  const hasAnyExpanded = expandedTasks.size > 0
  const allTasksWithChildren = tasks.filter(t => hasChildren(t.id)).map(t => t.id)

  const handleExpandAll = () => {
    setExpandedTasks(new Set(allTasksWithChildren))
  }

  const handleCollapseAll = () => {
    setExpandedTasks(new Set())
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando tareas...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">Estructura de Tareas (WBS)</CardTitle>
              <CardDescription>
                {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LevelFilter
              maxLevel={maxLevel}
              currentMaxLevel={maxDisplayLevel}
              onLevelChange={setMaxDisplayLevel}
            />
            {allTasksWithChildren.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={hasAnyExpanded ? handleCollapseAll : handleExpandAll}
                title={hasAnyExpanded ? "Colapsar todos los niveles" : "Expandir todos los niveles"}
              >
                {hasAnyExpanded ? (
                  <>
                    <ChevronsUp className="h-4 w-4 mr-1" />
                    <span className="text-xs">Colapsar</span>
                  </>
                ) : (
                  <>
                    <ChevronsDown className="h-4 w-4 mr-1" />
                    <span className="text-xs">Expandir</span>
                  </>
                )}
              </Button>
            )}
            <TaskFormDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredRootTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No hay tareas creadas</p>
            <TaskFormDialog />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center py-1.5 px-3 bg-muted/50 border-b font-medium text-xs text-muted-foreground">
              <div className="w-5" /> {/* Expand button space */}
              <div className="w-5" /> {/* Critical path indicator */}
              <div className="w-20">WBS</div>
              <div className="flex-1">Tarea</div>
              <div className="w-16 text-center">Duración</div>
              <div className="w-40">Fechas</div>
              <div className="w-28">Acciones</div>
            </div>

            {/* Tasks - scrollable container */}
            <div className="overflow-y-auto scrollbar-hide max-h-[40vh]">
              {filteredRootTasks.map((task) => renderTask(task))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

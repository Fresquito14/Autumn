import { useState, useEffect } from 'react'
import { List } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskRow } from './TaskRow'
import { TaskFormDialog } from './TaskFormDialog'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Task } from '@/types'

export function WBSTree() {
  const { tasks, loadTasks, isLoading } = useTasks()
  const { currentProject } = useProject()
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
    const children = getChildTasks(task.id)
    const isExpanded = expandedTasks.has(task.id)
    const taskHasChildren = hasChildren(task.id)

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
              <CardTitle>Estructura de Tareas (WBS)</CardTitle>
              <CardDescription>
                {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
              </CardDescription>
            </div>
          </div>
          <TaskFormDialog />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rootTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No hay tareas creadas</p>
            <TaskFormDialog />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center py-2 px-4 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
              <div className="w-6" /> {/* Expand button space */}
              <div className="w-6" /> {/* Indent space */}
              <div className="w-24">WBS</div>
              <div className="flex-1">Tarea</div>
              <div className="w-20 text-center">Duración</div>
              <div className="w-48">Fechas</div>
              <div className="w-32">Acciones</div>
            </div>

            {/* Tasks */}
            <div>
              {rootTasks.map((task) => renderTask(task))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

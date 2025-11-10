import { useState } from 'react'
import { ChevronRight, ChevronDown, Trash2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { TaskFormDialog } from './TaskFormDialog'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface TaskRowProps {
  task: Task
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  level: number
}

export function TaskRow({ task, hasChildren, isExpanded, onToggleExpand, level }: TaskRowProps) {
  const { deleteTask } = useTasks()
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = async () => {
    if (confirm(`¿Eliminar tarea "${task.name}"?${hasChildren ? '\n\nEsto también eliminará todas las subtareas.' : ''}`)) {
      await deleteTask(task.id)
    }
  }

  const indentWidth = level * 24 // 24px per level

  return (
    <div
      className={cn(
        'group border-b hover:bg-muted/50 transition-colors',
        isHovered && 'bg-muted/30'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center py-3 px-4 gap-2">
        {/* Indent */}
        <div style={{ width: indentWidth }} />

        {/* Expand/Collapse */}
        <div className="w-6 flex-shrink-0">
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* WBS Code */}
        <div className="w-24 flex-shrink-0">
          <span className="text-sm font-mono text-muted-foreground">
            {task.wbsCode}
          </span>
        </div>

        {/* Task Name */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{task.name}</div>
          {task.description && (
            <div className="text-sm text-muted-foreground truncate">
              {task.description}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="w-20 flex-shrink-0 text-sm text-muted-foreground text-center">
          {task.duration}d
        </div>

        {/* Dates */}
        <div className="w-48 flex-shrink-0 text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>
            {format(task.startDate, 'dd/MM/yy', { locale: es })} -{' '}
            {format(task.endDate, 'dd/MM/yy', { locale: es })}
          </span>
        </div>

        {/* Actions */}
        <div className={cn(
          'flex gap-1 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <TaskFormDialog task={task} trigger={<Button variant="ghost" size="sm"><span className="sr-only">Editar</span></Button>} />
          <TaskFormDialog parentTask={task} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ChevronRight, ChevronDown, Trash2, Calendar, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { TaskFormDialog } from './TaskFormDialog'
import { ActualProgressDialog } from './ActualProgressDialog'
import { CopyTaskBlockDialog } from './CopyTaskBlockDialog'
import { useTasks } from '@/hooks/useTasks'
import { useCriticalPath } from '@/hooks/useCriticalPath'
import { calculateTaskProgress } from '@/lib/utils/progress'
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
  const { tasks, deleteTask } = useTasks()
  const { isTaskCritical, getTaskCPM } = useCriticalPath()
  const [isHovered, setIsHovered] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const isCritical = isTaskCritical(task.id)
  const taskCPM = getTaskCPM(task.id)

  // Calculate progress for this task
  const progress = calculateTaskProgress(task, tasks)

  const handleDelete = async () => {
    if (confirm(`¿Eliminar tarea "${task.name}"?${hasChildren ? '\n\nEsto también eliminará todas las subtareas.' : ''}`)) {
      await deleteTask(task.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    setIsEditDialogOpen(true)
  }

  const indentWidth = level * 24 // 24px per level

  return (
    <div
      className={cn(
        'group border-b hover:bg-muted/50 transition-colors cursor-pointer relative overflow-hidden',
        isHovered && 'bg-muted/30',
        // Border left: green if 100% complete, critical if incomplete and critical
        progress === 100
          ? 'border-l-4 border-l-autumn-progress'
          : isCritical && 'border-l-4 border-l-autumn-critical'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      title="Doble clic para editar"
    >
      {/* Progress background gradient */}
      {progress > 0 && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-autumn-progress/10 to-transparent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="flex items-center py-1.5 px-3 gap-2 relative z-10">
        {/* Indent */}
        <div style={{ width: indentWidth }} />

        {/* Expand/Collapse */}
        <div className="w-5 flex-shrink-0">
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
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

        {/* Critical Path Indicator */}
        <div className="w-5 flex-shrink-0">
          {isCritical && progress < 100 && (
            <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" title="Camino Crítico" />
          )}
        </div>

        {/* WBS Code */}
        <div className="w-20 flex-shrink-0">
          <span className={cn(
            "text-xs font-mono",
            progress === 100
              ? "text-autumn-progress font-semibold"
              : isCritical
              ? "text-autumn-critical font-semibold"
              : "text-muted-foreground"
          )}>
            {task.wbsCode}
          </span>
        </div>

        {/* Task Name */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm font-medium truncate",
            progress === 100
              ? "text-autumn-progress"
              : isCritical && "text-autumn-critical"
          )}>
            {task.name}
            {isCritical && progress < 100 && taskCPM && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (Holgura: {taskCPM.totalFloat}d)
              </span>
            )}
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground truncate">
              {task.description}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="w-16 flex-shrink-0 text-xs text-muted-foreground text-center">
          {task.duration}d
        </div>

        {/* Dates */}
        <div className="w-40 flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>
            {format(task.startDate, 'dd/MM/yy', { locale: es })} -{' '}
            {format(task.endDate, 'dd/MM/yy', { locale: es })}
          </span>
        </div>

        {/* Actions */}
        <div className={cn(
          'w-28 flex gap-0.5 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <ActualProgressDialog task={task} />
          <CopyTaskBlockDialog task={task} />
          <TaskFormDialog
            task={task}
            trigger={<Button variant="ghost" size="sm" className="h-6 w-6 p-0"><span className="sr-only">Editar</span></Button>}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
          <TaskFormDialog parentTask={task} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

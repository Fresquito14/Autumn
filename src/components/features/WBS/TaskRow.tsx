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
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useAuth } from '@/hooks/useAuth'
import { useProject } from '@/hooks/useProject'
import { calculateTaskProgress } from '@/lib/utils/progress'
import type { Task, Resource } from '@/types'
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
  const { resources } = useResources()
  const { assignments } = useResourceAssignments()
  const { user } = useAuth()
  const { currentProject } = useProject()
  const [isHovered, setIsHovered] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const isReadOnly = Boolean(user && currentProject?.userId && currentProject.userId !== user.id)

  const isCritical = isTaskCritical(task.id)
  const taskCPM = getTaskCPM(task.id)

  // Calculate progress for this task
  const progress = calculateTaskProgress(task, tasks)

  // Get assigned resources for this task
  const taskAssignments = assignments.filter(a => a.taskId === task.id)
  const assignedResources = taskAssignments
    .map(a => resources.find(r => r.id === a.resourceId))
    .filter((r): r is Resource => !!r)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isReadOnly) return
    if (confirm(`¿Eliminar tarea "${task.name}"?${hasChildren ? '\n\nEsto también eliminará todas las subtareas.' : ''}`)) {
      await deleteTask(task.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return
    if ((e.target as HTMLElement).closest('button, input, select, .dialog-trigger, [role="dialog"]')) {
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
        progress === 100
          ? 'border-l-4 border-l-autumn-progress'
          : isCritical && 'border-l-4 border-l-autumn-critical'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      title="Doble clic para editar tarea"
    >
      {/* Progress background gradient */}
      {progress > 0 && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-autumn-progress/10 to-transparent transition-all duration-300 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="flex items-center py-1.5 px-3 gap-2 relative z-10">
        {/* Indent */}
        <div style={{ width: indentWidth }} />

        {/* Expand/Collapse */}
        <div className="w-5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
            <span title="Camino Crítico">
              <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" />
            </span>
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
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {task.description}
            </div>
          )}
        </div>

        {/* Assigned Resources Column */}
        <div className="w-32 flex-shrink-0 flex items-center gap-1 overflow-hidden">
          {assignedResources.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap max-h-6 overflow-hidden">
              {assignedResources.map(r => (
                <span
                  key={r.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 truncate max-w-[110px]"
                  title={`${r.name} (${r.email || 'Sin email'})`}
                >
                  {r.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 italic">Sin asignar</span>
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

        {/* Actions - Strictly isolated from double-click bubbling */}
        {!isReadOnly && (
          <div
            className={cn(
              'flex items-center gap-0.5 transition-opacity',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <ActualProgressDialog key={`progress-${task.id}`} task={task} />
            <CopyTaskBlockDialog key={`copy-${task.id}`} task={task} />
            <TaskFormDialog parentTask={task} />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              title="Eliminar tarea"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Edit dialog triggered via double-click */}
      <TaskFormDialog
        task={task}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  )
}

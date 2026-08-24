import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Plus,
  Trash2,
  FolderGit2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LogHoursDialog } from './LogHoursDialog'
import { QuickSubtaskDialog } from './QuickSubtaskDialog'
import { useTasks } from '@/hooks/useTasks'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { db } from '@/infrastructure/storage/dexie/db'
import { getTaskTemporalStatus } from '@/domain/calculations/my-tasks'
import type { Task, ChecklistItem } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TaskManagementCardProps {
  task: Task
  projectName: string
  resourceId: string
  onTaskUpdated?: () => void
}

export function TaskManagementCard({
  task,
  projectName,
  resourceId,
  onTaskUpdated,
}: TaskManagementCardProps) {
  const { updateTask } = useTasks()
  const { assignments } = useResourceAssignments()

  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(task.checklist || [])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)

  // Keep local checklist in sync if task prop updates
  useEffect(() => {
    setLocalChecklist(task.checklist || [])
  }, [task.checklist])

  // Find assignment for this resource
  const assignment = assignments.find(
    (a) => a.taskId === task.id && a.resourceId === resourceId
  )

  const actualHours = assignment?.actualHours || 0
  const plannedHours = assignment?.plannedHours || 0

  const status = getTaskTemporalStatus(task)
  const isCompleted = status === 'completed'

  // Checklist statistics
  const totalItems = localChecklist.length
  const completedItems = localChecklist.filter((i) => i.completed).length
  const checklistPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // Hours consumption percent
  const hoursPercent = plannedHours > 0 ? Math.min(100, Math.round((actualHours / plannedHours) * 100)) : (actualHours > 0 ? 100 : 0)

  // Toggle checklist item status
  const handleToggleChecklistItem = async (itemId: string) => {
    const updatedChecklist = localChecklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
    setLocalChecklist(updatedChecklist)

    const allChecked = updatedChecklist.length > 0 && updatedChecklist.every((i) => i.completed)

    try {
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        ...(allChecked && !task.actualDuration ? { percentComplete: 100, actualDuration: task.duration, actualEndDate: new Date() } : {}),
        updatedAt: new Date(),
      })
      await updateTask(task.id, {
        checklist: updatedChecklist,
        ...(allChecked && !task.actualDuration ? { percentComplete: 100, actualDuration: task.duration, actualEndDate: new Date() } : {}),
      })
    } catch (err) {
      console.error('Error updating checklist item:', err)
    }

    if (allChecked && !task.actualDuration) {
      toast.success(`¡Todos los puntos de "${task.name}" completados!`)
    }
    onTaskUpdated?.()
  }

  // Add item to checklist
  const handleAddChecklistItem = async () => {
    const trimmed = newChecklistText.trim()
    if (!trimmed) return

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    }

    const updatedChecklist = [...localChecklist, newItem]
    setLocalChecklist(updatedChecklist)
    setNewChecklistText('')
    setIsAddingItem(false)

    try {
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        updatedAt: new Date(),
      })
      await updateTask(task.id, {
        checklist: updatedChecklist,
      })
    } catch (err) {
      console.error('Error adding checklist item:', err)
    }

    toast.success('Punto añadido al checklist')
    onTaskUpdated?.()
  }

  // Delete checklist item
  const handleDeleteChecklistItem = async (itemId: string) => {
    const updatedChecklist = localChecklist.filter((item) => item.id !== itemId)
    setLocalChecklist(updatedChecklist)

    try {
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        updatedAt: new Date(),
      })
      await updateTask(task.id, {
        checklist: updatedChecklist,
      })
    } catch (err) {
      console.error('Error deleting checklist item:', err)
    }

    onTaskUpdated?.()
  }

  // Toggle task complete / reopen
  const handleToggleComplete = async () => {
    if (isCompleted) {
      // Reopen task
      await updateTask(task.id, {
        percentComplete: 0,
        actualDuration: undefined,
        actualEndDate: undefined,
      })
      toast.info(`Tarea "${task.name}" reabierta`)
    } else {
      // Mark as complete
      await updateTask(task.id, {
        percentComplete: 100,
        actualDuration: task.duration,
        actualStartDate: task.actualStartDate || task.startDate,
        actualEndDate: new Date(),
      })
      toast.success(`Tarea "${task.name}" marcada como completada`)
    }
    onTaskUpdated?.()
  }

  return (
    <Card
      className={cn(
        'transition-all duration-200 border-l-4 overflow-hidden',
        isCompleted
          ? 'border-l-emerald-500 bg-card/60 opacity-90'
          : status === 'overdue'
          ? 'border-l-rose-500 hover:border-l-rose-600 bg-card'
          : status === 'active'
          ? 'border-l-amber-500 hover:border-l-amber-600 bg-card shadow-xs'
          : 'border-l-muted-foreground/30 bg-card'
      )}
    >
      <CardContent className="p-4 space-y-3.5">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Project Badge */}
              <Badge variant="outline" className="text-[11px] gap-1 py-0.5 bg-muted/40 font-medium">
                <FolderGit2 className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[160px]">{projectName}</span>
              </Badge>

              {/* WBS Code */}
              <span className="text-xs font-mono font-semibold text-primary">
                {task.wbsCode}
              </span>

              {/* Status Badge */}
              {isCompleted ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] py-0 px-2">
                  Completada
                </Badge>
              ) : status === 'overdue' ? (
                <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] py-0 px-2 gap-1">
                  <AlertCircle className="h-2.5 w-2.5" />
                  Vencida
                </Badge>
              ) : status === 'active' ? (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] py-0 px-2">
                  En curso
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0 px-2 text-muted-foreground">
                  Próxima
                </Badge>
              )}
            </div>

            {/* Task Title */}
            <h3
              className={cn(
                'text-sm font-semibold text-foreground pt-0.5 leading-snug',
                isCompleted && 'line-through text-muted-foreground'
              )}
            >
              {task.name}
            </h3>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <QuickSubtaskDialog
              parentTask={task}
              resourceId={resourceId}
              onSubtaskCreated={onTaskUpdated}
            />

            <LogHoursDialog
              task={task}
              resourceId={resourceId}
              onHoursLogged={onTaskUpdated}
            />

            <Button
              variant={isCompleted ? 'outline' : 'default'}
              size="sm"
              className={cn(
                'h-8 text-xs gap-1.5',
                isCompleted
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
              onClick={handleToggleComplete}
              title={isCompleted ? 'Reabrir tarea' : 'Marcar como completada'}
            >
              {isCompleted ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reabrir
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Details & Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          {/* Schedule info */}
          <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 rounded-md p-2">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <div className="truncate">
              <span className="font-medium text-foreground">
                {format(new Date(task.startDate), 'dd MMM', { locale: es })}
              </span>
              {' - '}
              <span className="font-medium text-foreground">
                {format(new Date(task.endDate), 'dd MMM yyyy', { locale: es })}
              </span>
              <span className="ml-1.5 text-muted-foreground">({task.duration} d)</span>
            </div>
          </div>

          {/* Hours logged info */}
          <div className="flex items-center justify-between bg-muted/30 rounded-md p-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span>
                Horas:{' '}
                <strong className="text-foreground">{actualHours}h</strong>
                {plannedHours > 0 && (
                  <span className="text-muted-foreground"> / {plannedHours}h</span>
                )}
              </span>
            </div>

            {/* Micro progress bar */}
            {plannedHours > 0 && (
              <div className="flex items-center gap-2 w-24">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      actualHours > plannedHours
                        ? 'bg-rose-500'
                        : actualHours > 0
                        ? 'bg-amber-500'
                        : 'bg-muted-foreground/30'
                    )}
                    style={{ width: `${Math.min(100, hoursPercent)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {hoursPercent}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Checklist Section */}
        <div className="border-t pt-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              Checklist
              {totalItems > 0 && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({completedItems}/{totalItems} completados - {checklistPercent}%)
                </span>
              )}
            </span>

            {!isAddingItem && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary hover:text-primary gap-1"
                onClick={() => setIsAddingItem(true)}
              >
                <Plus className="h-3 w-3" />
                Añadir ítem
              </Button>
            )}
          </div>

          {/* Checklist Items list */}
          {localChecklist.length > 0 ? (
            <div className="space-y-1">
              {localChecklist.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-2 text-xs py-1 px-2 rounded hover:bg-muted/40 transition-colors"
                >
                  <div
                    className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                    onClick={() => handleToggleChecklistItem(item.id)}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-foreground" />
                    )}
                    <span
                      className={cn(
                        'transition-colors break-words',
                        item.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.text}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    title="Eliminar punto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !isAddingItem ? (
            <p className="text-[11px] text-muted-foreground italic">
              No hay ítems en el checklist para esta tarea.
            </p>
          ) : null}

          {/* Inline Add Item Input */}
          {isAddingItem && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Escribe el nuevo punto y pulsa Enter..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChecklistItem()
                  } else if (e.key === 'Escape') {
                    setIsAddingItem(false)
                    setNewChecklistText('')
                  }
                }}
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={handleAddChecklistItem}
                disabled={!newChecklistText.trim()}
              >
                Añadir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setIsAddingItem(false)
                  setNewChecklistText('')
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

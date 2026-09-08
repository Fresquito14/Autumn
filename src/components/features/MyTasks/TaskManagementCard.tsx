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
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LogHoursDialog } from './LogHoursDialog'
import { QuickSubtaskDialog } from './QuickSubtaskDialog'
import { CompleteTaskDialog } from './CompleteTaskDialog'
import { useTasks } from '@/hooks/useTasks'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useDependencies } from '@/hooks/useDependencies'
import { db } from '@/infrastructure/storage/dexie/db'
import { supabase } from '@/lib/supabase/client'
import { getTaskTemporalStatus } from '@/domain/calculations/my-tasks'
import type { Task, ChecklistItem } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TaskManagementCardProps {
  task: Task
  projectName: string
  resourceId: string
  onTaskUpdated?: (taskId?: string, updatedChecklist?: ChecklistItem[]) => void
  hasConflict?: boolean
}

export function TaskManagementCard({
  task,
  projectName,
  resourceId,
  onTaskUpdated,
  hasConflict,
}: TaskManagementCardProps) {
  const { updateTask } = useTasks()
  const { updateDependency } = useDependencies()
  const { assignments } = useResourceAssignments()

  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(task.checklist || [])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)

  // Keep local checklist synchronized when task prop changes
  useEffect(() => {
    if (task.checklist) {
      setLocalChecklist(task.checklist)
    }
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
    const toggledItem = updatedChecklist.find((i) => i.id === itemId)

    try {
      // 1. Update Dexie
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        ...(allChecked && !task.actualDuration ? { percentComplete: 100, actualDuration: task.duration, actualEndDate: new Date() } : {}),
        updatedAt: new Date(),
      })

      // 2. Update Zustand store
      await updateTask(task.id, {
        checklist: updatedChecklist,
        ...(allChecked && !task.actualDuration ? { percentComplete: 100, actualDuration: task.duration, actualEndDate: new Date() } : {}),
      })

      // 3. Sync to Supabase in background if authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id && toggledItem) {
        await supabase
          .from('task_checklist_items')
          .update({ completed: toggledItem.completed })
          .eq('id', itemId)
      }
    } catch (err) {
      console.error('Error updating checklist item:', err)
    }

    if (allChecked && !task.actualDuration) {
      toast.success(`¡Todos los puntos de "${task.name}" completados!`)
    }
    onTaskUpdated?.(task.id, updatedChecklist)
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
      // 1. Update Dexie
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        updatedAt: new Date(),
      })

      // 2. Update Zustand store
      await updateTask(task.id, {
        checklist: updatedChecklist,
      })

      // 3. Sync to Supabase in background
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase.from('task_checklist_items').upsert({
          id: newItem.id,
          task_id: task.id,
          user_id: session.user.id,
          text: newItem.text,
          completed: false,
          position: updatedChecklist.length - 1,
          version: 1,
        })
      }
    } catch (err) {
      console.error('Error saving new checklist item:', err)
    }

    toast.success('Punto añadido al checklist')
    onTaskUpdated?.(task.id, updatedChecklist)
  }

  // Delete checklist item
  const handleDeleteChecklistItem = async (itemId: string) => {
    const updatedChecklist = localChecklist.filter((item) => item.id !== itemId)
    setLocalChecklist(updatedChecklist)

    try {
      // 1. Update Dexie
      await db.tasks.update(task.id, {
        checklist: updatedChecklist,
        updatedAt: new Date(),
      })

      // 2. Update Zustand store
      await updateTask(task.id, {
        checklist: updatedChecklist,
      })

      // 3. Sync delete to Supabase in background
      await supabase.from('task_checklist_items').delete().eq('id', itemId)
    } catch (err) {
      console.error('Error deleting checklist item:', err)
    }

    onTaskUpdated?.(task.id, updatedChecklist)
  }

  // Reopen task
  const handleReopenTask = async () => {
    const reopenData = {
      percentComplete: 0,
      actualDuration: undefined,
      actualStartDate: undefined,
      actualEndDate: undefined,
      updatedAt: new Date(),
    }

    try {
      // 1. Update task in Dexie
      await db.tasks.update(task.id, reopenData)

      // 2. Update task in Zustand store
      await updateTask(task.id, reopenData)

      // 3. Reset actualLag on incoming dependencies
      const incomingDeps = await db.dependencies.where('successorId').equals(task.id).toArray()
      for (const dep of incomingDeps) {
        await db.dependencies.update(dep.id, { actualLag: undefined })
        await updateDependency(dep.id, { actualLag: undefined })
      }

      // 4. Sync to Supabase in background if authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase
          .from('tasks')
          .update({
            percent_complete: 0,
            actual_duration: null,
            actual_start_date: null,
            actual_end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        for (const dep of incomingDeps) {
          await supabase
            .from('dependencies')
            .update({ actual_lag: null })
            .eq('id', dep.id)
        }
      }
      toast.info(`Tarea "${task.name}" reabierta`)
    } catch (err) {
      console.error('Error reopening task:', err)
    }

    onTaskUpdated?.()
  }

  // Confirm completion with actual duration and start delay (and update dependency actualLag)
  const handleConfirmCompletion = async (data: {
    actualDuration: number
    actualStartDate: Date
    actualEndDate: Date
    percentComplete: number
    startDelayDays: number
    notes?: string
  }) => {
    const completeData = {
      percentComplete: 100,
      actualDuration: data.actualDuration,
      actualStartDate: data.actualStartDate,
      actualEndDate: data.actualEndDate,
      notes: data.notes || task.notes,
      updatedAt: new Date(),
    }

    try {
      // 1. Update task in Dexie
      await db.tasks.update(task.id, completeData)

      // 2. Update task in Zustand store
      await updateTask(task.id, completeData)

      // 3. Update actualLag on incoming dependencies (where this task is successor)
      const incomingDeps = await db.dependencies.where('successorId').equals(task.id).toArray()
      for (const dep of incomingDeps) {
        const calculatedActualLag = (dep.lag || 0) + data.startDelayDays
        await db.dependencies.update(dep.id, { actualLag: calculatedActualLag })
        await updateDependency(dep.id, { actualLag: calculatedActualLag })
      }

      // 4. Sync to Supabase in background if authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase
          .from('tasks')
          .update({
            percent_complete: 100,
            actual_duration: data.actualDuration,
            actual_start_date: data.actualStartDate.toISOString(),
            actual_end_date: data.actualEndDate.toISOString(),
            notes: data.notes || task.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        for (const dep of incomingDeps) {
          const calculatedActualLag = (dep.lag || 0) + data.startDelayDays
          await supabase
            .from('dependencies')
            .update({ actual_lag: calculatedActualLag })
            .eq('id', dep.id)
        }
      }
      toast.success(`¡Tarea "${task.name}" completada con éxito!`)
    } catch (err) {
      console.error('Error completing task:', err)
    }

    onTaskUpdated?.()
  }

  return (
    <Card className={cn(
      'transition-all border',
      isCompleted
        ? 'opacity-75 bg-muted/20 border-border/60'
        : hasConflict
        ? 'border-amber-500/50 bg-amber-500/[0.03] shadow-xs'
        : status === 'overdue'
        ? 'border-rose-500/30 bg-rose-500/5'
        : 'bg-card hover:border-border/80'
    )}>
      <CardContent className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
              {/* Project badge */}
              <Badge variant="secondary" className="gap-1 font-normal text-[10px] sm:text-[11px] py-0 px-2">
                <FolderGit2 className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[140px]">{projectName}</span>
              </Badge>

              {/* WBS Code */}
              <span className="font-mono text-[11px] sm:text-xs font-medium text-muted-foreground">
                {task.wbsCode}
              </span>

              {/* Temporal status badge */}
              {status === 'overdue' ? (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Vencida
                </Badge>
              ) : status === 'active' ? (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] py-0 px-1.5">
                  En curso
                </Badge>
              ) : status === 'completed' ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] py-0 px-1.5">
                  Completada
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 px-1.5">
                  Próxima
                </Badge>
              )}

              {/* Overlap / Conflict indicator */}
              {hasConflict && !isCompleted && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] py-0 px-1.5 gap-1"
                  title="Esta tarea tiene solape de fechas con otra tarea asignada a este recurso"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  Solape
                </Badge>
              )}
            </div>

            {/* Task Name - Larger, bolder and wrap-friendly for mobile */}
            <h3
              className={cn(
                'text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug break-words',
                isCompleted && 'line-through text-muted-foreground'
              )}
              title={task.name}
            >
              {task.name}
            </h3>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-start sm:self-auto pt-0.5 sm:pt-0">
            <QuickSubtaskDialog
              parentTask={task}
              resourceId={resourceId}
              onSubtaskCreated={() => onTaskUpdated?.()}
            />

            <LogHoursDialog
              task={task}
              resourceId={resourceId}
              onHoursLogged={() => onTaskUpdated?.()}
            />

            {isCompleted ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={handleReopenTask}
                title="Reabrir tarea"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir
              </Button>
            ) : (
              <CompleteTaskDialog
                task={task}
                projectName={projectName}
                onConfirm={handleConfirmCompletion}
              />
            )}
          </div>
        </div>

        {/* Details & Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-0.5 text-xs">
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
                    className="h-6 w-6 sm:h-5 sm:w-5 p-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
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

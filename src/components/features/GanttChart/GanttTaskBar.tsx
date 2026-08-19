import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Zap } from 'lucide-react'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'
import { useCriticalPath } from '@/hooks/useCriticalPath'
import { useViewMode } from '@/hooks/useViewMode'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { useAuth } from '@/hooks/useAuth'
import { useDependencies } from '@/hooks/useDependencies'
import { calculateTaskProgress } from '@/lib/utils/progress'
import { addBusinessDays } from '@/lib/calculations/dates'
import { TaskFormDialog } from '../WBS/TaskFormDialog'
import { useRef, useState } from 'react'

interface GanttTaskBarProps {
  task: Task
  plannedLeft: number
  plannedWidth: number
  actualLeft: number
  actualWidth: number
  rowHeight: number
  dayWidth: number
}

export function GanttTaskBar({
  task,
  plannedLeft,
  plannedWidth,
  actualLeft,
  actualWidth,
  rowHeight,
  dayWidth
}: GanttTaskBarProps) {
  const { isTaskCritical, getTaskCPM } = useCriticalPath()
  const { viewMode } = useViewMode()
  const { tasks, updateTask } = useTasks()
  const { currentProject } = useProject()
  const { user } = useAuth()
  const { dependencies, updateDependency } = useDependencies()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const isCritical = isTaskCritical(task.id)
  const taskCPM = getTaskCPM(task.id)

  const isReadOnly = Boolean(user && currentProject?.userId && currentProject.userId !== user.id)

  const barHeight = rowHeight * 0.6
  const barTop = (rowHeight - barHeight) / 2

  // Adjust tasks for progress calculation in actual mode
  const adjustedTasks = viewMode === 'actual'
    ? tasks.map(t => {
        if (t.actualDuration !== undefined && t.actualDuration !== null) {
          return { ...t, duration: t.actualDuration }
        }
        return t
      })
    : tasks

  // Calculate task progress
  const progress = calculateTaskProgress(task, adjustedTasks)

  // Determine if task has actual progress
  const hasActualDuration = task.actualDuration !== undefined && task.actualDuration !== null

  const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]
  const isLeafTask = !tasks.some(t => t.parentId === task.id)
  const predecessors = dependencies.filter(d => d.successorId === task.id)
  const hasPredecessors = predecessors.length > 0

  // Local drag and resize states
  const [dragOffsetDays, setDragOffsetDays] = useState<number>(0)
  const [resizeDeltaDays, setResizeDeltaDays] = useState<number>(0)
  const [resizeLeftDeltaDays, setResizeLeftDeltaDays] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const pointerStartRef = useRef<{ clientX: number; originalStartDate: Date; originalDuration: number } | null>(null)

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'plan' || !isLeafTask || isReadOnly) return
    if ((e.target as HTMLElement).closest('.resize-handle')) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = {
      clientX: e.clientX,
      originalStartDate: new Date(task.startDate),
      originalDuration: task.duration
    }
    setIsDragging(true)
    e.stopPropagation()
  }

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pointerStartRef.current) return

    const deltaX = e.clientX - pointerStartRef.current.clientX
    const deltaDays = Math.round(deltaX / dayWidth)
    setDragOffsetDays(deltaDays)
  }

  const handleDragEnd = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pointerStartRef.current) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)

    const finalOffset = dragOffsetDays
    setDragOffsetDays(0)

    if (finalOffset !== 0) {
      if (hasPredecessors) {
        for (const dep of predecessors) {
          const currentLag = dep.lag || 0
          const newLag = Math.max(0, currentLag + finalOffset)
          await updateDependency(dep.id, { lag: newLag })
        }
      } else {
        const originalStart = pointerStartRef.current.originalStartDate
        let newStart = addBusinessDays(originalStart, finalOffset, workingDays)
        const newEnd = addBusinessDays(newStart, task.duration - 1, workingDays)

        await updateTask(task.id, {
          startDate: newStart,
          endDate: newEnd,
        })
      }
    }
    pointerStartRef.current = null
  }

  // Handle right resize (Duration increase/decrease)
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'plan' || !isLeafTask || isReadOnly) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = {
      clientX: e.clientX,
      originalStartDate: new Date(task.startDate),
      originalDuration: task.duration
    }
    setIsResizing(true)
    e.stopPropagation()
  }

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !pointerStartRef.current) return

    const deltaX = e.clientX - pointerStartRef.current.clientX
    const deltaDays = Math.round(deltaX / dayWidth)
    const minDelta = -(pointerStartRef.current.originalDuration - 1)
    setResizeDeltaDays(Math.max(minDelta, deltaDays))
  }

  const handleResizeEnd = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !pointerStartRef.current) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsResizing(false)

    const finalDelta = resizeDeltaDays
    setResizeDeltaDays(0)

    if (finalDelta !== 0) {
      const originalDuration = pointerStartRef.current.originalDuration
      const newDuration = Math.max(1, originalDuration + finalDelta)
      const startDate = new Date(task.startDate)
      const newEnd = addBusinessDays(startDate, newDuration - 1, workingDays)

      await updateTask(task.id, {
        duration: newDuration,
        endDate: newEnd,
      })
    }
    pointerStartRef.current = null
  }

  // Handle left resize (Start date shift)
  const handleResizeLeftStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'plan' || !isLeafTask || isReadOnly || hasPredecessors) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = {
      clientX: e.clientX,
      originalStartDate: new Date(task.startDate),
      originalDuration: task.duration
    }
    setIsResizingLeft(true)
    e.stopPropagation()
  }

  const handleResizeLeftMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingLeft || !pointerStartRef.current) return

    const deltaX = e.clientX - pointerStartRef.current.clientX
    const deltaDays = Math.round(deltaX / dayWidth)
    const maxDelta = pointerStartRef.current.originalDuration - 1
    setResizeLeftDeltaDays(Math.min(maxDelta, deltaDays))
  }

  const handleResizeLeftEnd = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingLeft || !pointerStartRef.current) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsResizingLeft(false)

    const finalDelta = resizeLeftDeltaDays
    setResizeLeftDeltaDays(0)

    if (finalDelta !== 0) {
      const originalStart = pointerStartRef.current.originalStartDate
      const originalDuration = pointerStartRef.current.originalDuration
      const newStart = addBusinessDays(originalStart, finalDelta, workingDays)
      const newDuration = Math.max(1, originalDuration - finalDelta)

      await updateTask(task.id, {
        startDate: newStart,
        duration: newDuration,
      })
    }
    pointerStartRef.current = null
  }

  // Compute live visual coordinates with drag / resize deltas
  const effectiveDragOffset = isDragging ? dragOffsetDays : 0
  const effectiveResizeDelta = isResizing ? resizeDeltaDays : 0
  const effectiveResizeLeftDelta = isResizingLeft ? resizeLeftDeltaDays : 0

  const currentLeft = plannedLeft + (effectiveDragOffset * dayWidth) + (effectiveResizeLeftDelta * dayWidth)
  const currentWidth = Math.max(dayWidth, plannedWidth + (effectiveResizeDelta * dayWidth) - (effectiveResizeLeftDelta * dayWidth))

  const previewDuration = Math.max(1, task.duration + effectiveResizeDelta - effectiveResizeLeftDelta)
  const previewStart = addBusinessDays(new Date(task.startDate), effectiveDragOffset + effectiveResizeLeftDelta, workingDays)
  const previewEnd = addBusinessDays(previewStart, previewDuration - 1, workingDays)

  return (
    <>
      {/* Planned Task Bar */}
      <div
        className={cn(
          'absolute group z-10',
          viewMode === 'plan' && isLeafTask && !isReadOnly
            ? 'cursor-grab active:cursor-grabbing'
            : isReadOnly
            ? 'cursor-default'
            : 'cursor-pointer'
        )}
        style={{
          left: `${currentLeft}px`,
          width: `${currentWidth}px`,
          minWidth: '20px',
          top: `${barTop}px`,
          height: `${barHeight}px`,
          transition: isDragging || isResizing || isResizingLeft ? 'none' : 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (!isReadOnly) {
            setIsEditDialogOpen(true)
          }
        }}
        title="Doble clic para editar detalles"
      >
        <div
          className={cn(
            'h-full rounded-md shadow-sm transition-all flex relative overflow-hidden',
            viewMode === 'actual' && 'opacity-40',
            progress === 100
              ? 'border-2 border-autumn-progress/20'
              : isCritical
              ? 'border-2 border-autumn-critical/20'
              : 'border border-primary-foreground/10'
          )}
        >
          {/* Completed portion (green) */}
          {progress > 0 && (
            <div
              className="h-full transition-colors flex items-center flex-shrink-0"
              style={{
                width: `${progress}%`,
                backgroundColor: 'hsl(153 98% 10%)',
                borderTopLeftRadius: '0.375rem',
                borderBottomLeftRadius: '0.375rem',
                borderTopRightRadius: progress === 100 ? '0.375rem' : '0',
                borderBottomRightRadius: progress === 100 ? '0.375rem' : '0'
              }}
            >
              {/* Task Name in completed portion - only if wide enough and in plan mode */}
              {viewMode === 'plan' && (currentWidth * progress / 100) > 100 && (
                <div className="px-2 flex items-center gap-1 w-full">
                  {isCritical && progress < 100 && <Zap className="h-3 w-3 fill-white text-white" />}
                  <span className="text-xs font-medium truncate text-white">
                    {task.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Remaining portion - only show if not 100% complete */}
          {progress < 100 && (
            <div
              className="h-full transition-colors flex items-center flex-grow"
              style={{
                backgroundColor: isCritical ? 'hsl(9 55% 14%)' : 'hsl(38 92% 50%)',
                borderTopLeftRadius: progress === 0 ? '0.375rem' : '0',
                borderBottomLeftRadius: progress === 0 ? '0.375rem' : '0',
                borderTopRightRadius: '0.375rem',
                borderBottomRightRadius: '0.375rem'
              }}
            >
              {/* Task Name in remaining portion - only if completed portion is too small or progress is 0 */}
              {viewMode === 'plan' && currentWidth > 100 && (progress === 0 || (currentWidth * progress / 100) <= 100) && (
                <div className="px-2 flex items-center gap-1 w-full">
                  {isCritical && <Zap className="h-3 w-3 fill-white text-white" />}
                  <span className="text-xs font-medium truncate text-white">
                    {task.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Left Resize handle (only for leaf tasks in plan view when not readOnly) */}
          {viewMode === 'plan' && isLeafTask && !isReadOnly && (
            <div
              className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 active:bg-white/50 rounded-l-md transition-colors z-20 animate-pulse"
              onPointerDown={handleResizeLeftStart}
              onPointerMove={handleResizeLeftMove}
              onPointerUp={handleResizeLeftEnd}
            />
          )}

          {/* Right Resize handle (only for leaf tasks in plan view when not readOnly) */}
          {viewMode === 'plan' && isLeafTask && !isReadOnly && (
            <div
              className="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 active:bg-white/50 rounded-r-md transition-colors z-20 animate-pulse"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
            />
          )}
        </div>

        {/* Tooltip - only on planned bar */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm whitespace-nowrap">
            <div className="font-semibold flex items-center gap-1">
              {isCritical && progress < 100 && <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" />}
              {task.wbsCode} - {task.name}
              {isCritical && progress < 100 && <span className="text-autumn-critical ml-1">(CRÍTICO)</span>}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              <span className="font-medium">Planificado: </span>
              {format(previewStart, 'dd MMM', { locale: es })} - {format(previewEnd, 'dd MMM yyyy', { locale: es })}
            </div>
            <div className="text-muted-foreground text-xs">
              Duración: {previewDuration} {previewDuration === 1 ? 'día' : 'días'}
            </div>
            {progress > 0 && (
              <div className="text-autumn-progress text-xs font-medium">
                Progreso: {progress}%
              </div>
            )}
            {hasActualDuration && task.actualDuration !== undefined && (
              <>
                <div className="text-muted-foreground text-xs mt-1">
                  <span className="font-medium">Real: </span>
                  Duración {task.actualDuration} {task.actualDuration === 1 ? 'día' : 'días'}
                </div>
                <div className={cn(
                  "text-xs font-medium",
                  task.actualDuration > task.duration ? "text-autumn-critical" : "text-autumn-progress"
                )}>
                  Variación: {task.actualDuration > task.duration ? '+' : ''}{task.actualDuration - task.duration} {Math.abs(task.actualDuration - task.duration) === 1 ? 'día' : 'días'}
                </div>
              </>
            )}
            {taskCPM && (
              <div className="text-muted-foreground text-xs">
                Holgura: {taskCPM.totalFloat} {taskCPM.totalFloat === 1 ? 'día' : 'días'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actual/Real Task Bar - only shown in actual mode */}
      {viewMode === 'actual' && (
        <div
          className="absolute group cursor-pointer z-10"
          style={{
            left: `${actualLeft}px`,
            width: `${actualWidth}px`,
            minWidth: '20px',
            top: `${barTop}px`,
            height: `${barHeight}px`,
            transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            className={cn(
              'h-full rounded-md shadow-sm transition-all flex',
              progress === 100
                ? 'border-2 border-autumn-progress/20'
                : isCritical
                ? 'border-2 border-autumn-critical/20'
                : 'border border-primary-foreground/10'
            )}
          >
            {/* Completed portion (green) */}
            {progress > 0 && (
              <div
                className="h-full transition-colors flex items-center flex-shrink-0"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'hsl(153 98% 10%)',
                  borderRadius: '0.375rem'
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Double-click edit modal directly from Gantt bar */}
      <TaskFormDialog
        task={task}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  )
}

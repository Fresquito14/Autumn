import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Zap } from 'lucide-react'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'
import { useCriticalPath } from '@/hooks/useCriticalPath'
import { useViewMode } from '@/hooks/useViewMode'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { useDependencies } from '@/hooks/useDependencies'
import { calculateTaskProgress } from '@/lib/utils/progress'
import { addBusinessDays } from '@/lib/calculations/dates'
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
  const { dependencies, updateDependency } = useDependencies()
  const isCritical = isTaskCritical(task.id)
  const taskCPM = getTaskCPM(task.id)

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
    if (viewMode !== 'plan' || !isLeafTask) return
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
        // If it has predecessors, shift the lag of those dependencies instead of updating start date directly
        for (const dep of predecessors) {
          const currentLag = dep.lag || 0
          const newLag = Math.max(0, currentLag + finalOffset)
          await updateDependency(dep.id, { lag: newLag })
        }
      } else {
        // If no predecessors, update task startDate directly
        const originalStart = pointerStartRef.current.originalStartDate
        const duration = pointerStartRef.current.originalDuration

        const newStartDate = addDays(originalStart, finalOffset)
        const newEndDate = addBusinessDays(newStartDate, duration - 1, workingDays)

        try {
          await updateTask(task.id, {
            startDate: newStartDate,
            endDate: newEndDate
          })
        } catch (err) {
          console.error('Error updating task date on drag:', err)
        }
      }
    }
    pointerStartRef.current = null
  }

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'plan' || !isLeafTask) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = {
      clientX: e.clientX,
      originalStartDate: new Date(task.startDate),
      originalDuration: task.duration
    }
    setIsResizing(true)
    e.stopPropagation()
    e.preventDefault()
  }

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !pointerStartRef.current) return

    const deltaX = e.clientX - pointerStartRef.current.clientX
    const deltaDays = Math.round(deltaX / dayWidth)
    
    const originalDuration = pointerStartRef.current.originalDuration
    const potentialNewDuration = originalDuration + deltaDays
    if (potentialNewDuration < 1) {
      setResizeDeltaDays(1 - originalDuration)
    } else {
      setResizeDeltaDays(deltaDays)
    }
  }

  const handleResizeEnd = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !pointerStartRef.current) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsResizing(false)

    const finalDelta = resizeDeltaDays
    setResizeDeltaDays(0)

    if (finalDelta !== 0) {
      const originalStart = pointerStartRef.current.originalStartDate
      const originalDuration = pointerStartRef.current.originalDuration
      const newDuration = Math.max(1, originalDuration + finalDelta)
      const newEndDate = addBusinessDays(originalStart, newDuration - 1, workingDays)

      try {
        await updateTask(task.id, {
          duration: newDuration,
          endDate: newEndDate
        })
      } catch (err) {
        console.error('Error updating task duration on resize:', err)
      }
    }
    pointerStartRef.current = null
  }

  const handleResizeLeftStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'plan' || !isLeafTask) return

    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = {
      clientX: e.clientX,
      originalStartDate: new Date(task.startDate),
      originalDuration: task.duration
    }
    setIsResizingLeft(true)
    e.stopPropagation()
    e.preventDefault()
  }

  const handleResizeLeftMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingLeft || !pointerStartRef.current) return

    const deltaX = e.clientX - pointerStartRef.current.clientX
    const deltaDays = Math.round(deltaX / dayWidth)
    
    const originalDuration = pointerStartRef.current.originalDuration
    const potentialNewDuration = originalDuration - deltaDays
    if (potentialNewDuration < 1) {
      setResizeLeftDeltaDays(originalDuration - 1)
    } else {
      setResizeLeftDeltaDays(deltaDays)
    }
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
      const newDuration = Math.max(1, originalDuration - finalDelta)

      try {
        if (hasPredecessors) {
          // If task has predecessors, only the duration varies, start date remains anchored (no change to lag)
          const newEndDate = addBusinessDays(task.startDate, newDuration - 1, workingDays)
          await updateTask(task.id, {
            duration: newDuration,
            endDate: newEndDate
          })
        } else {
          // If no predecessors, shift the start date and reduce/increase duration so the end date remains unchanged
          const newStartDate = addDays(originalStart, finalDelta)
          await updateTask(task.id, {
            startDate: newStartDate,
            duration: newDuration
          })
        }
      } catch (err) {
        console.error('Error updating task dates on left resize:', err)
      }
    }
    pointerStartRef.current = null
  }

  const currentLeft = plannedLeft + (dragOffsetDays * dayWidth) + (isResizingLeft && !hasPredecessors ? resizeLeftDeltaDays * dayWidth : 0)
  const currentWidth = Math.max(20, plannedWidth + (resizeDeltaDays * dayWidth) - (isResizingLeft ? resizeLeftDeltaDays * dayWidth : 0))

  // Real-time preview dates for the tooltip
  const previewStart = isDragging
    ? addDays(new Date(task.startDate), dragOffsetDays)
    : isResizingLeft && !hasPredecessors
    ? addDays(new Date(task.startDate), resizeLeftDeltaDays)
    : new Date(task.startDate)

  const previewDuration = isResizing
    ? Math.max(1, task.duration + resizeDeltaDays)
    : isResizingLeft
    ? Math.max(1, task.duration - resizeLeftDeltaDays)
    : task.duration

  const previewEnd = isDragging || isResizing || isResizingLeft
    ? addBusinessDays(previewStart, previewDuration - 1, workingDays)
    : new Date(task.endDate)

  return (
    <>
      {/* Planned Task Bar - always positioned at planned location */}
      <div
        className={cn(
          "absolute group z-10 select-none",
          viewMode === 'plan' && isLeafTask ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
        style={{
          left: `${currentLeft}px`,
          width: `${currentWidth}px`,
          minWidth: '20px',
          top: `${barTop}px`,
          height: `${barHeight}px`,
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div
          className={cn(
            'h-full rounded-md shadow-sm transition-all flex relative overflow-hidden',
            viewMode === 'actual' && 'opacity-40',
            // Border color: green if 100% complete, critical if incomplete and critical, otherwise default
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
                  {isCritical && progress < 100 && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                  <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
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
                  {isCritical && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                  <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                    {task.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Left Resize handle (only for leaf tasks in plan view) */}
          {viewMode === 'plan' && isLeafTask && (
            <div
              className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 active:bg-white/50 rounded-l-md transition-colors z-20 animate-pulse"
              onPointerDown={handleResizeLeftStart}
              onPointerMove={handleResizeLeftMove}
              onPointerUp={handleResizeLeftEnd}
            />
          )}

          {/* Right Resize handle (only for leaf tasks in plan view) */}
          {viewMode === 'plan' && isLeafTask && (
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
          }}
        >
          <div
            className={cn(
              'h-full rounded-md shadow-sm transition-all flex',
              // Border color: green if 100% complete, critical if incomplete and critical, otherwise default
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
                {/* Task Name in completed portion - only if wide enough */}
                {(actualWidth * progress / 100) > 100 && (
                  <div className="px-2 flex items-center gap-1 w-full">
                    {isCritical && progress < 100 && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                    <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
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
                {actualWidth > 100 && (progress === 0 || (actualWidth * progress / 100) <= 100) && (
                  <div className="px-2 flex items-center gap-1 w-full">
                    {isCritical && <Zap className="h-3 w-3" style={{ fill: 'white', color: 'white' }} />}
                    <span className="text-xs font-medium truncate" style={{ color: 'white' }}>
                      {task.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tooltip - only on actual bar */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-sm whitespace-nowrap">
              <div className="font-semibold flex items-center gap-1">
                {isCritical && progress < 100 && <Zap className="h-3 w-3 text-autumn-critical fill-autumn-critical" />}
                {task.wbsCode} - {task.name}
                {isCritical && progress < 100 && <span className="text-autumn-critical ml-1">(CRÍTICO)</span>}
              </div>
              {task.actualStartDate && task.actualEndDate ? (
                <>
                  <div className="text-muted-foreground text-xs mt-1">
                    <span className="font-medium">Real: </span>
                    {format(task.actualStartDate, 'dd MMM', { locale: es })} - {format(task.actualEndDate, 'dd MMM yyyy', { locale: es })}
                  </div>
                  {task.actualDuration !== undefined && (
                    <div className="text-muted-foreground text-xs">
                      Duración: {task.actualDuration} {task.actualDuration === 1 ? 'día' : 'días'}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-muted-foreground text-xs mt-1">
                    <span className="font-medium">Planificado: </span>
                    {format(task.startDate, 'dd MMM', { locale: es })} - {format(task.endDate, 'dd MMM yyyy', { locale: es })}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Duración: {task.duration} {task.duration === 1 ? 'día' : 'días'}
                  </div>
                </>
              )}
              {progress > 0 && (
                <div className="text-autumn-progress text-xs font-medium">
                  Progreso: {progress}%
                </div>
              )}
              {hasActualDuration && task.actualDuration !== undefined && task.actualDuration !== task.duration && (
                <div className={cn(
                  "text-xs font-medium",
                  task.actualDuration > task.duration ? "text-autumn-critical" : "text-autumn-progress"
                )}>
                  Variación: {task.actualDuration > task.duration ? '+' : ''}{task.actualDuration - task.duration} {Math.abs(task.actualDuration - task.duration) === 1 ? 'día' : 'días'}
                </div>
              )}
              {taskCPM && (
                <div className="text-muted-foreground text-xs">
                  Holgura: {taskCPM.totalFloat} {taskCPM.totalFloat === 1 ? 'día' : 'días'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

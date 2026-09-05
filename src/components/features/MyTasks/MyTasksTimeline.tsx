import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Calendar, Briefcase, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GanttTimeline } from '../GanttChart/GanttTimeline'
import { TaskFormDialog } from '../WBS/TaskFormDialog'
import {
  getTimelineBounds,
  calculateTaskBarPosition,
  calculateTimelineDimensions,
  calculateDatePosition,
} from '@/domain/calculations/dates'
import { detectTaskConflicts, type TaskConflictInfo } from '@/domain/calculations/conflicts'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 46

interface MyTasksTimelineProps {
  tasks: Task[]
  projectMap: Map<string, string>
  onTaskUpdated?: (taskId?: string) => void
  resourceId?: string
}

export function MyTasksTimeline({
  tasks,
  projectMap,
  onTaskUpdated,
  resourceId: _resourceId,
}: MyTasksTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('week')
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null)
  const [hoveredTask, setHoveredTask] = useState<{
    task: Task
    hasConflict: boolean
    conflictInfo?: TaskConflictInfo
    projectName: string
    taskStart: Date
    taskEnd: Date
    progress: number
  } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Layout measurement with ResizeObserver
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // Detect conflicts between assigned tasks
  const conflictMap = useMemo(() => detectTaskConflicts(tasks), [tasks])

  // Count total tasks with conflicts
  const conflictingTasksCount = useMemo(() => {
    let count = 0
    conflictMap.forEach((info) => {
      if (info.hasConflict) count++
    })
    return count
  }, [conflictMap])

  // Calculate timeline bounds encompassing all tasks
  // For uncompleted tasks, use planned dates so orphaned actual dates cannot stretch the timeline into the past
  const timelineTasks = useMemo(() => {
    return tasks.map((t) => {
      const isCompleted =
        t.percentComplete === 100 ||
        (t.actualDuration !== undefined && t.actualDuration !== null)
      return {
        startDate: t.startDate,
        endDate: t.endDate,
        actualStartDate: isCompleted ? t.actualStartDate : undefined,
        actualEndDate: isCompleted ? t.actualEndDate : undefined,
      }
    })
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">No hay tareas para representar en el cronograma</p>
          <p className="text-xs">Ajusta los filtros para visualizar tus tareas en el eje temporal.</p>
        </CardContent>
      </Card>
    )
  }

  const { start: timelineStart, end: timelineEnd } = getTimelineBounds(timelineTasks)

  // Base day width according to zoom
  let baseDayWidth = 24
  if (zoomLevel === 'day') {
    baseDayWidth = 60
  } else if (zoomLevel === 'month') {
    baseDayWidth = 8
  }

  const { totalDays: baseTotalDays } = calculateTimelineDimensions(timelineStart, timelineEnd, 1000)
  const calculatedWidth = baseTotalDays * baseDayWidth
  const ganttWidth = Math.max(containerWidth, calculatedWidth)

  // Floating cursor tooltip style anchored directly at the mouse position
  // Portaled to document.body so it floats on top of the left task panel and escapes scroll container clipping
  const getCursorTooltipStyle = (pos: { x: number; y: number }): React.CSSProperties => {
    const showBelow = pos.y < 160
    const isNearLeft = pos.x < 220
    const isNearRight = typeof window !== 'undefined' && pos.x > window.innerWidth - 220

    let transformX = '-50%'
    let offsetX = 0

    if (isNearLeft) {
      transformX = '0%'
      offsetX = 14
    } else if (isNearRight) {
      transformX = '-100%'
      offsetX = -14
    }

    return {
      position: 'fixed',
      left: `${pos.x + offsetX}px`,
      top: showBelow ? `${pos.y + 16}px` : `${pos.y - 12}px`,
      transform: showBelow ? `translate(${transformX}, 0)` : `translate(${transformX}, -100%)`,
      pointerEvents: 'none',
      zIndex: 9999,
    }
  }

  const { totalDays, dayWidth, normalizedStart, normalizedEnd } = calculateTimelineDimensions(
    timelineStart,
    timelineEnd,
    ganttWidth
  )

  // Generate weekend column markers
  const weekendColumns: { left: number; width: number }[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(normalizedStart, i)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendColumns.push({
        left: i * dayWidth,
        width: dayWidth,
      })
    }
  }

  // Calculate today marker position
  const today = new Date()
  const todayPosition =
    today >= normalizedStart && today <= normalizedEnd
      ? calculateDatePosition(today, timelineStart, timelineEnd, ganttWidth).left
      : null

  // Sort tasks chronologically by start date
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )

  return (
    <div className="space-y-4">
      {/* Top Banner Alert if conflicts exist */}
      {conflictingTasksCount > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-300 flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-xs font-semibold">
                ¡Conflicto de sobreasignación detectado en tu tejado!
              </p>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                Tienes {conflictingTasksCount} tareas que se solapan en las mismas fechas. Revisa las
                barras destacadas con advertencia para gestionar prioridades o ajustar plazos.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 shrink-0 text-[10px]">
            {conflictingTasksCount} en conflicto
          </Badge>
        </div>
      )}

      {/* Main Timeline Card */}
      <Card className="overflow-hidden shadow-xs">
        <div className="p-3 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Cronograma de Tareas Asignadas
            </span>
            <span className="text-[11px] text-muted-foreground">
              ({sortedTasks.length} {sortedTasks.length === 1 ? 'tarea' : 'tareas'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <ToggleGroup
              type="single"
              value={zoomLevel}
              onValueChange={(value) => value && setZoomLevel(value as 'day' | 'week' | 'month')}
              className="border rounded-md bg-background h-7"
            >
              <ToggleGroupItem value="day" aria-label="Zoom día" className="text-[11px] px-2 h-6">
                Día
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Zoom semana" className="text-[11px] px-2 h-6">
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Zoom mes" className="text-[11px] px-2 h-6">
                Mes
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Gantt Split View: Left Panel (Tasks info) + Right Panel (Horizontal Bars) */}
        <div className="flex border-b overflow-hidden">
          {/* Left Panel: Task & Project name with conflict badge */}
          <div className="w-72 sm:w-80 flex-shrink-0 border-r bg-muted/15">
            <div className="h-[60px] border-b flex items-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-muted/40 z-20 box-border">
              Tarea & Proyecto
            </div>
            <div>
              {sortedTasks.map((task) => {
                const conflictInfo = conflictMap.get(task.id)
                const hasConflict = conflictInfo?.hasConflict
                const projectName = projectMap.get(task.projectId) || 'Proyecto'
                const isCompleted = task.percentComplete === 100

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'border-b px-3 flex items-center box-border shrink-0 transition-colors',
                      hasConflict ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-muted/30'
                    )}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {hasConflict && (
                          <span title={`Solapamiento con ${conflictInfo?.conflictingTasks.length} tarea(s)`}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          </span>
                        )}
                        {isCompleted && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span
                          className={cn(
                            'text-xs font-medium truncate block',
                            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                          )}
                          title={task.name}
                        >
                          {task.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[9px] font-normal truncate max-w-[140px]"
                        >
                          <Briefcase className="h-2.5 w-2.5 mr-1 inline opacity-70" />
                          {projectName}
                        </Badge>
                        <span>{task.duration}d</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Panel: Scrollable Horizontal Timeline Canvas */}
          <div className="flex-1 overflow-x-auto scrollbar-hide" ref={containerRef}>
            <div style={{ width: `${ganttWidth}px`, minWidth: '100%' }}>
              <GanttTimeline
                startDate={timelineStart}
                endDate={timelineEnd}
                width={ganttWidth}
                zoomLevel={zoomLevel}
              />

              {/* Task Bars Area */}
              <div className="relative">
                {/* Weekend Background Columns */}
                {weekendColumns.map((col, index) => (
                  <div
                    key={`weekend-${index}`}
                    className="absolute top-0 bottom-0 bg-muted-foreground/5 pointer-events-none"
                    style={{
                      left: `${col.left}px`,
                      width: `${col.width}px`,
                      zIndex: 0,
                    }}
                  />
                ))}

                {/* Today Line Marker */}
                {todayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-sky-500 z-30"
                    style={{
                      left: `${todayPosition}px`,
                      width: '0px',
                    }}
                  >
                    <div className="absolute top-1 left-1 bg-sky-500 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-xs whitespace-nowrap opacity-90 select-none">
                      Hoy
                    </div>
                  </div>
                )}

                {/* Task Bars Rows */}
                {sortedTasks.map((task) => {
                  const conflictInfo = conflictMap.get(task.id)
                  const hasConflict = conflictInfo?.hasConflict
                  const isCompleted = task.percentComplete === 100
                  const progress = task.percentComplete || 0
                  const projectName = projectMap.get(task.projectId) || 'Proyecto'

                  // Compute bar coordinates
                  // For uncompleted tasks, use planned dates so obsolete actual dates cannot shift the bar
                  const isTaskDone =
                    task.percentComplete === 100 ||
                    (task.actualDuration !== undefined && task.actualDuration !== null)
                  const taskStart =
                    isTaskDone && task.actualStartDate
                      ? new Date(task.actualStartDate)
                      : new Date(task.startDate)
                  const taskEnd =
                    isTaskDone && task.actualEndDate
                      ? new Date(task.actualEndDate)
                      : new Date(task.endDate)

                  const { left, width } = calculateTaskBarPosition(
                    taskStart,
                    taskEnd,
                    timelineStart,
                    timelineEnd,
                    ganttWidth
                  )

                  const barH = ROW_HEIGHT * 0.62
                  const barTop = (ROW_HEIGHT - barH) / 2

                  return (
                    <div
                      key={task.id}
                      className="border-b relative box-border shrink-0 hover:z-40"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {/* Interactive Horizontal Task Bar */}
                      <div
                        className={cn(
                          'absolute group cursor-pointer z-10 hover:z-50 transition-all rounded-md shadow-xs flex',
                          hasConflict
                            ? 'border-2 border-amber-500 shadow-amber-500/20 shadow-sm'
                            : isCompleted
                            ? 'border-2 border-emerald-500/50'
                            : 'border border-primary-foreground/20'
                        )}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          minWidth: '20px',
                          top: `${barTop}px`,
                          height: `${barH}px`,
                        }}
                        onPointerEnter={(e) => {
                          setHoveredTask({
                            task,
                            hasConflict: Boolean(hasConflict),
                            conflictInfo,
                            projectName,
                            taskStart,
                            taskEnd,
                            progress,
                          })
                          setMousePos({ x: e.clientX, y: e.clientY })
                        }}
                        onPointerMove={(e) => {
                          setMousePos({ x: e.clientX, y: e.clientY })
                        }}
                        onPointerLeave={() => {
                          setHoveredTask(null)
                          setMousePos(null)
                        }}
                        onClick={() => setSelectedTaskForEdit(task)}
                        title="Haz clic para ver o editar detalles"
                      >
                        {/* Completed Progress Portion */}
                        {progress > 0 && (
                          <div
                            className="h-full transition-colors flex items-center flex-shrink-0"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: 'hsl(153 98% 10%)',
                              borderTopLeftRadius: '0.375rem',
                              borderBottomLeftRadius: '0.375rem',
                              borderTopRightRadius: progress === 100 ? '0.375rem' : '0',
                              borderBottomRightRadius: progress === 100 ? '0.375rem' : '0',
                            }}
                          >
                            {width * (progress / 100) > 60 && (
                              <span className="text-[11px] font-medium truncate text-white px-2 drop-shadow-xs">
                                {task.name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Remaining / Solid Pending Portion */}
                        {progress < 100 && (
                          <div
                            className="h-full transition-colors flex items-center flex-grow overflow-hidden px-2 gap-1.5"
                            style={{
                              backgroundColor: hasConflict
                                ? 'hsl(28 85% 44%)' // Warning Terracotta / Amber when in conflict
                                : 'hsl(38 92% 50%)', // Standard Autumn Warm Amber
                              borderTopLeftRadius: progress === 0 ? '0.375rem' : '0',
                              borderBottomLeftRadius: progress === 0 ? '0.375rem' : '0',
                              borderTopRightRadius: '0.375rem',
                              borderBottomRightRadius: '0.375rem',
                            }}
                          >
                            {hasConflict && (
                              <AlertTriangle className="h-3 w-3 text-white shrink-0 animate-pulse" />
                            )}
                            {width > 60 && (progress === 0 || width * (progress / 100) <= 60) && (
                              <span className="text-[11px] font-medium truncate text-white drop-shadow-xs">
                                {task.name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Floating Cursor Tooltip Portaled to document.body */}
      {hoveredTask && mousePos && createPortal(
        <div
          className="pointer-events-none transition-opacity duration-75 animate-in fade-in-0"
          style={getCursorTooltipStyle(mousePos)}
        >
          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-xl border text-xs whitespace-nowrap space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              {hoveredTask.hasConflict && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              )}
              <span>{hoveredTask.task.name}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                {hoveredTask.projectName}
              </Badge>
            </div>

            <div className="text-muted-foreground text-[11px]">
              {hoveredTask.task.percentComplete === 100 && hoveredTask.task.actualStartDate ? (
                <>
                  <div>
                    Real: {format(hoveredTask.taskStart, 'dd MMM', { locale: es })} -{' '}
                    {format(hoveredTask.taskEnd, 'dd MMM yyyy', { locale: es })} ({hoveredTask.task.actualDuration || hoveredTask.task.duration}d)
                  </div>
                  <div className="text-[10px] opacity-75">
                    Planificado: {format(new Date(hoveredTask.task.startDate), 'dd MMM', { locale: es })} -{' '}
                    {format(new Date(hoveredTask.task.endDate), 'dd MMM yyyy', { locale: es })}
                  </div>
                </>
              ) : (
                <div>
                  Fechas: {format(hoveredTask.taskStart, 'dd MMM', { locale: es })} -{' '}
                  {format(hoveredTask.taskEnd, 'dd MMM yyyy', { locale: es })} ({hoveredTask.task.duration}d)
                </div>
              )}
            </div>

            {hoveredTask.progress > 0 && (
              <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                Progreso: {hoveredTask.progress}%
              </div>
            )}

            {/* Detailed Conflict Notice in Tooltip */}
            {hoveredTask.hasConflict && hoveredTask.conflictInfo && (
              <div className="pt-1.5 mt-1 border-t border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                <p className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" /> Solapa con en las mismas fechas:
                </p>
                <ul className="list-disc list-inside mt-0.5 text-[10px] space-y-0.5">
                  {hoveredTask.conflictInfo.conflictingTasks.map((ct) => (
                    <li key={ct.id}>
                      <span className="font-semibold">{ct.name}</span> (
                      {projectMap.get(ct.projectId) || 'Proyecto'})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground/80 pt-1">
              Haz clic para ver o editar detalles
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Task Form Dialog */}
      {selectedTaskForEdit && (
        <TaskFormDialog
          task={selectedTaskForEdit}
          open={Boolean(selectedTaskForEdit)}
          onOpenChange={(open: boolean) => {
            if (!open) {
              const editedId = selectedTaskForEdit.id
              setSelectedTaskForEdit(null)
              onTaskUpdated?.(editedId)
            }
          }}
        />
      )}
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Calendar, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { addDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GanttTimeline } from './GanttTimeline'
import { GanttTaskBar } from './GanttTaskBar'
import { GanttDependencyLines } from './GanttDependencyLines'
import { GanttMilestone } from './GanttMilestone'
import { ProjectStatistics } from './ProjectStatistics'
import { LevelFilter } from '../WBS/LevelFilter'
import { TaskDebugExport } from '../Debug/TaskDebugExport'
import { useTasks } from '@/hooks/useTasks'
import { useDependencies } from '@/hooks/useDependencies'
import { useMilestones } from '@/hooks/useMilestones'
import { useProject } from '@/hooks/useProject'
import { useLevelFilter } from '@/hooks/useLevelFilter'
import { useViewMode } from '@/hooks/useViewMode'
import {
  getTimelineBounds,
  calculateTaskBarPosition,
  calculateTimelineDimensions,
  calculateDatePosition,
  rollupParentActualDates
} from '@/lib/calculations/dates'
import { getMaxWbsLevel, isTaskVisibleAtLevel, getWbsLevel } from '@/domain/calculations/wbs'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 40

export function GanttChart() {
  const { tasks, loadTasks, isLoading } = useTasks()
  const { dependencies, loadDependencies } = useDependencies()
  const { milestones, loadMilestones } = useMilestones()
  const { currentProject } = useProject()
  const { maxDisplayLevel, setMaxDisplayLevel } = useLevelFilter()
  const { viewMode, setViewMode, zoomLevel, setZoomLevel } = useViewMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [isTaskListCollapsed, setIsTaskListCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autumn_gantt_task_list_collapsed') === 'true'
    }
    return false
  })

  const handleToggleTaskList = (collapsed: boolean) => {
    setIsTaskListCollapsed(collapsed)
    try {
      localStorage.setItem('autumn_gantt_task_list_collapsed', String(collapsed))
    } catch {
      // ignore storage error
    }
  }

  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id)
      loadDependencies(currentProject.id)
      loadMilestones(currentProject.id)
    }
  }, [currentProject, loadTasks, loadDependencies, loadMilestones])

  // Use useLayoutEffect to avoid intermediate renders with wrong width
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Update width immediately
    updateWidth()

    // Use ResizeObserver for better performance and accuracy
    const resizeObserver = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, []) // Run only once on mount

  const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]

  // Roll up actual and planned dates for parent tasks so summary tasks always enclose all children
  const tasksWithRollup = rollupParentActualDates(tasks, workingDays)

  const { start: timelineStart, end: timelineEnd } = getTimelineBounds(
    tasksWithRollup,
    milestones,
    currentProject?.startDate
  )

  // Calculate base total days first to compute zoom width
  const { totalDays: baseTotalDays } = calculateTimelineDimensions(timelineStart, timelineEnd, 1000)

  // Determine base day width depending on zoom level
  let baseDayWidth = 20
  if (zoomLevel === 'day') {
    baseDayWidth = 60
  } else if (zoomLevel === 'month') {
    baseDayWidth = 6
  }

  const calculatedWidth = baseTotalDays * baseDayWidth
  const ganttWidth = Math.max(containerWidth, calculatedWidth)

  // Calculate timeline dimensions using centralized function
  const { totalDays, dayWidth, normalizedStart, normalizedEnd } = calculateTimelineDimensions(
    timelineStart,
    timelineEnd,
    ganttWidth
  )

  // Auto-scroll to project start date whenever switching projects or adjusting zoom/dimensions
  useLayoutEffect(() => {
    if (containerRef.current && currentProject) {
      const projectStart = currentProject.startDate
        ? new Date(currentProject.startDate)
        : timelineStart
      const pos = calculateDatePosition(projectStart, timelineStart, timelineEnd, ganttWidth)
      const targetScroll = Math.max(0, pos.left - 24)
      containerRef.current.scrollLeft = targetScroll
    }
  }, [currentProject, ganttWidth, timelineStart, timelineEnd])

  if (isLoading && tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando diagrama...</p>
        </CardContent>
      </Card>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Diagrama de Gantt</CardTitle>
          </div>
          <CardDescription>
            Visualización temporal de las tareas del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay tareas para visualizar</p>
            <p className="text-sm mt-2">Crea tareas en el WBS para verlas en el diagrama</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate max level in tasks (1-based: 1 = root, 2 = child, 3 = grandchild, etc.)
  const maxLevel = getMaxWbsLevel(tasksWithRollup)

  // Filter tasks based on maxDisplayLevel
  const filteredTasks = tasksWithRollup.filter(task => isTaskVisibleAtLevel(task, maxDisplayLevel))

  // Get visible tasks (flatten hierarchy for Gantt)
  const visibleTasks = filteredTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))

  // Generate weekend columns using normalized dates
  const weekendColumns: { left: number; width: number; date: Date; day: number }[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(normalizedStart, i)
    const dayOfWeek = date.getDay()

    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const col = {
        left: i * dayWidth,
        width: dayWidth,
        date,
        day: dayOfWeek
      }
      weekendColumns.push(col)
    }
  }

  // Calculate today's position using centralized function
  const today = new Date()
  const todayPosition = today >= normalizedStart && today <= normalizedEnd
    ? calculateDatePosition(today, timelineStart, timelineEnd, ganttWidth).left
    : null

  // Create a map of task positions for dependency lines
  const taskPositions = new Map<string, { left: number; width: number; top: number }>()

  visibleTasks.forEach((task, index) => {
    // Use actual dates in Real mode if available, otherwise use planned dates
    let taskStart: Date
    let taskEnd: Date

    if (viewMode === 'actual' && task.actualStartDate && task.actualEndDate) {
      taskStart = new Date(task.actualStartDate)
      taskEnd = new Date(task.actualEndDate)
    } else {
      taskStart = new Date(task.startDate)
      taskEnd = new Date(task.endDate)
    }

    const { left, width } = calculateTaskBarPosition(
      taskStart,
      taskEnd,
      timelineStart,
      timelineEnd,
      ganttWidth
    )

    // Debug log for tasks starting on 21/11
    if (taskStart.getDate() === 21 && taskStart.getMonth() === 10) { // November is month 10 (0-indexed)
      console.log(`Task "${task.name}": ${taskStart.toLocaleDateString()} (day ${taskStart.getDay()}), left: ${left}px, dayWidth: ${dayWidth}px`)
    }

    taskPositions.set(task.id, {
      left,
      width,
      top: index * ROW_HEIGHT,
    })
  })

  const getTaskPosition = (taskId: string) => taskPositions.get(taskId) || null

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ProjectStatistics />
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode (Plan / Real) */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as 'plan' | 'actual')}
              className="border rounded-md"
            >
              <ToggleGroupItem value="plan" aria-label="Vista planificada" className="text-xs px-3">
                Plan
              </ToggleGroupItem>
              <ToggleGroupItem value="actual" aria-label="Vista real" className="text-xs px-3">
                Real
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Zoom Controls */}
            <ToggleGroup
              type="single"
              value={zoomLevel}
              onValueChange={(value) => value && setZoomLevel(value as 'day' | 'week' | 'month')}
              className="border rounded-md bg-muted/40"
            >
              <ToggleGroupItem value="day" aria-label="Zoom día" className="text-xs px-2.5 h-8">
                Día
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Zoom semana" className="text-xs px-2.5 h-8">
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Zoom mes" className="text-xs px-2.5 h-8">
                Mes
              </ToggleGroupItem>
            </ToggleGroup>

            <LevelFilter
              maxLevel={maxLevel}
              currentMaxLevel={maxDisplayLevel}
              onLevelChange={setMaxDisplayLevel}
            />

            {/* Toggle Task List Column */}
            <Button
              variant={isTaskListCollapsed ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleToggleTaskList(!isTaskListCollapsed)}
              className="h-8 text-xs gap-1.5 font-medium"
              title={isTaskListCollapsed ? "Mostrar columna con nombres de tareas" : "Colapsar columna de tareas para ampliar el diagrama de Gantt"}
            >
              {isTaskListCollapsed ? (
                <>
                  <PanelLeftOpen className="h-3.5 w-3.5 text-primary" />
                  <span>Mostrar Tareas</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Colapsar Tareas</span>
                </>
              )}
            </Button>

            {import.meta.env.DEV && <TaskDebugExport />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-b">
          {/* Left panel - Task names */}
          {!isTaskListCollapsed ? (
            <div className="w-64 flex-shrink-0 border-r bg-muted/30 transition-all duration-200">
              <div className="h-[60px] border-b flex items-center justify-between px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-muted/50 z-20 box-border">
                <span>Tarea</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleToggleTaskList(true)}
                  title="Colapsar panel de tareas para ampliar Gantt"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              <div>
                {visibleTasks.map((task) => {
                  const isParent = tasksWithRollup.some(t => t.parentId === task.id)
                  const indent = getWbsLevel(task.wbsCode) * 14

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "border-b px-4 flex items-center box-border h-10 max-h-10 min-h-10 shrink-0 overflow-hidden",
                        isParent ? "bg-muted/40 font-medium" : ""
                      )}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                          {task.wbsCode}
                        </span>
                        <span
                          className={cn(
                            "text-sm truncate select-none",
                            isParent ? "font-semibold text-foreground" : "text-foreground/90"
                          )}
                          style={{ marginLeft: `${indent}px` }}
                          title={task.name}
                        >
                          {task.name}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Collapsed slim rail: takes only 32px so the timeline occupies maximum width */
            <div className="w-8 flex-shrink-0 border-r bg-muted/20 flex flex-col items-center transition-all duration-200 select-none">
              <div className="h-[60px] border-b flex items-center justify-center w-full sticky top-0 bg-muted/50 z-20 box-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleToggleTaskList(false)}
                  title="Expandir nombres de tareas"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </div>
              <div className="py-4">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                  Tareas
                </span>
              </div>
            </div>
          )}

          {/* Right panel - Timeline and bars */}
          <div className="flex-1 overflow-x-auto scrollbar-hide" ref={containerRef}>
            <div style={{ width: `${ganttWidth}px`, minWidth: '100%' }}>
              <GanttTimeline
                startDate={timelineStart}
                endDate={timelineEnd}
                width={ganttWidth}
                zoomLevel={zoomLevel}
              />

              {/* Task bars */}
              <div className="relative">
                {/* Weekend columns */}
                {weekendColumns.map((col, index) => (
                  <div
                    key={`weekend-${index}`}
                    className="absolute top-0 bottom-0 bg-muted-foreground/5 pointer-events-none"
                    style={{
                      left: `${col.left}px`,
                      width: `${col.width}px`,
                      zIndex: 0
                    }}
                  />
                ))}

                {/* Today marker */}
                {todayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-sky-500 z-30"
                    style={{
                      left: `${todayPosition}px`,
                      width: '0px'
                    }}
                  >
                    <div className="absolute top-1 left-1 bg-sky-500 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-sm whitespace-nowrap opacity-90 select-none">
                      Hoy
                    </div>
                  </div>
                )}

                {/* Dependency lines */}
                <GanttDependencyLines
                  dependencies={dependencies}
                  tasks={visibleTasks}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  containerWidth={ganttWidth}
                  rowHeight={ROW_HEIGHT}
                  getTaskPosition={getTaskPosition}
                />

                {/* Milestones */}
                {milestones.map((milestone) => {
                  // Use centralized function for consistent positioning
                  const { left } = calculateDatePosition(
                    milestone.date,
                    timelineStart,
                    timelineEnd,
                    ganttWidth
                  )

                  return (
                    <GanttMilestone
                      key={milestone.id}
                      milestone={milestone}
                      left={left}
                      totalHeight={visibleTasks.length * ROW_HEIGHT}
                      rowHeight={ROW_HEIGHT}
                    />
                  )
                })}

                {visibleTasks.map((task) => {
                  // Calculate planned position (always based on startDate/endDate)
                  const plannedPosition = calculateTaskBarPosition(
                    new Date(task.startDate),
                    new Date(task.endDate),
                    timelineStart,
                    timelineEnd,
                    ganttWidth
                  )

                  // Calculate actual position (fallback to planned dates if actual not defined)
                  const actualStart = task.actualStartDate ? new Date(task.actualStartDate) : new Date(task.startDate)
                  const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : new Date(task.endDate)

                  const actualPosition = calculateTaskBarPosition(
                    actualStart,
                    actualEnd,
                    timelineStart,
                    timelineEnd,
                    ganttWidth
                  )

                  return (
                    <div
                      key={task.id}
                      className="border-b relative box-border h-10 max-h-10 min-h-10 shrink-0 hover:z-40"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      <GanttTaskBar
                        task={task}
                        plannedLeft={plannedPosition.left}
                        plannedWidth={plannedPosition.width}
                        actualLeft={actualPosition.left}
                        actualWidth={actualPosition.width}
                        rowHeight={ROW_HEIGHT}
                        dayWidth={dayWidth}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

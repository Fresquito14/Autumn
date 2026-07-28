import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { addDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GanttTimeline } from './GanttTimeline'
import { GanttTaskBar } from './GanttTaskBar'
import { GanttDependencyLines } from './GanttDependencyLines'
import { GanttMilestone } from './GanttMilestone'
import { ProjectStatistics } from './ProjectStatistics'
import { LevelFilter } from '../WBS/LevelFilter'
import { TaskDebugExport } from '../Debug/TaskDebugExport'
import { RecalculateAllButton } from '../Debug/RecalculateAllButton'
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
  calculateDatePosition
} from '@/lib/calculations/dates'

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

  if (isLoading) {
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

  const { start: timelineStart, end: timelineEnd } = getTimelineBounds(tasks)

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

  // Debug log
  console.log(`Timeline: ${normalizedStart.toLocaleDateString()} to ${normalizedEnd.toLocaleDateString()} (${totalDays} days, dayWidth: ${dayWidth}px, zoomLevel: ${zoomLevel})`)

  // Calculate max level in tasks
  const maxLevel = Math.max(...tasks.map(t => t.level || 0), 0)

  // Filter tasks based on maxDisplayLevel
  const filteredTasks = maxDisplayLevel === 0
    ? tasks
    : tasks.filter(task => task.level <= maxDisplayLevel)

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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <div>
              <CardTitle>Diagrama de Gantt</CardTitle>
              <CardDescription>
                {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <RecalculateAllButton />
            <TaskDebugExport />
          </div>
        </div>
      </CardHeader>
      <ProjectStatistics />
      <CardContent className="p-0">
        <div className="flex border-b">
          {/* Left panel - Task names */}
          <div className="w-64 flex-shrink-0 border-r bg-muted/30">
            <div className="h-14 border-b flex items-center px-4 font-medium text-sm sticky top-0 bg-muted/50 z-20">
              Tarea
            </div>
            <div>
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="border-b px-4 flex items-center"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                      {task.wbsCode}
                    </span>
                    <span className="text-sm truncate" style={{ marginLeft: task.level * 12 }}>
                      {task.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

                  // Calculate actual position if we have actual dates
                  let actualPosition = plannedPosition
                  if (task.actualStartDate && task.actualEndDate) {
                    actualPosition = calculateTaskBarPosition(
                      new Date(task.actualStartDate),
                      new Date(task.actualEndDate),
                      timelineStart,
                      timelineEnd,
                      ganttWidth
                    )
                  }

                  return (
                    <div
                      key={task.id}
                      className="border-b relative"
                      style={{ height: ROW_HEIGHT }}
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

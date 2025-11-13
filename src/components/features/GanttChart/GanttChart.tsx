import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { addDays, differenceInDays } from 'date-fns'
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
import { getTimelineBounds, calculateTaskBarPosition } from '@/lib/calculations/dates'
import type { Task } from '@/types'

const ROW_HEIGHT = 40

export function GanttChart() {
  const { tasks, loadTasks, isLoading } = useTasks()
  const { dependencies, loadDependencies } = useDependencies()
  const { milestones, loadMilestones } = useMilestones()
  const { currentProject } = useProject()
  const { maxDisplayLevel, setMaxDisplayLevel } = useLevelFilter()
  const { viewMode, setViewMode } = useViewMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id)
      loadDependencies(currentProject.id)
      loadMilestones(currentProject.id)
    }
  }, [currentProject, loadTasks, loadDependencies, loadMilestones])

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Update width immediately
    updateWidth()

    // Also update after a short delay to ensure DOM has fully rendered
    const timeoutId = setTimeout(updateWidth, 100)

    window.addEventListener('resize', updateWidth)
    return () => {
      window.removeEventListener('resize', updateWidth)
      clearTimeout(timeoutId)
    }
  }, [tasks.length]) // Re-run when tasks change

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

  // Debug log
  console.log(`Timeline: ${timelineStart.toLocaleDateString()} (day ${timelineStart.getDay()}) to ${timelineEnd.toLocaleDateString()}`)

  // Calculate max level in tasks
  const maxLevel = Math.max(...tasks.map(t => t.level), 0)

  // Filter tasks based on maxDisplayLevel
  const filteredTasks = maxDisplayLevel === 0
    ? tasks
    : tasks.filter(task => task.level <= maxDisplayLevel)

  // Get visible tasks (flatten hierarchy for Gantt)
  const visibleTasks = filteredTasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))

  // Calculate total days and days for weekend/today markers
  const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const dayWidth = containerWidth / totalDays

  // Generate weekend columns
  const weekendColumns: { left: number; width: number; date: Date; day: number }[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(timelineStart, i)
    // Normalize to avoid timezone issues
    const normalized = new Date(date)
    normalized.setHours(12, 0, 0, 0)
    const dayOfWeek = normalized.getDay()

    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const col = {
        left: i * dayWidth,
        width: dayWidth,
        date: normalized,
        day: dayOfWeek
      }
      weekendColumns.push(col)

      // Debug log
      if (weekendColumns.length <= 3) {
        console.log(`Weekend ${weekendColumns.length}: ${normalized.toLocaleDateString()} (day ${dayOfWeek}), left: ${col.left}px`)
      }
    }
  }

  // Calculate today's position
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPosition = today >= timelineStart && today <= timelineEnd
    ? differenceInDays(today, timelineStart) * dayWidth
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
      containerWidth
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
            <div style={{ minWidth: containerWidth }}>
              <GanttTimeline
                startDate={timelineStart}
                endDate={timelineEnd}
                width={containerWidth}
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
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${todayPosition}px`,
                      zIndex: 5,
                      width: '2px'
                    }}
                  >
                    <div className="w-full h-full bg-blue-500 opacity-50" />
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
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
                  containerWidth={containerWidth}
                  rowHeight={ROW_HEIGHT}
                  getTaskPosition={getTaskPosition}
                />

                {/* Milestones */}
                {milestones.map((milestone) => {
                  const milestoneDate = new Date(milestone.date)
                  const daysFromStart = differenceInDays(milestoneDate, timelineStart)
                  const left = (daysFromStart * containerWidth) / totalDays

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

                {visibleTasks.map((task, index) => {
                  // Calculate planned position (always based on startDate/endDate)
                  const plannedPosition = calculateTaskBarPosition(
                    new Date(task.startDate),
                    new Date(task.endDate),
                    timelineStart,
                    timelineEnd,
                    containerWidth
                  )

                  // Calculate actual position if we have actual dates
                  let actualPosition = plannedPosition
                  if (task.actualStartDate && task.actualEndDate) {
                    actualPosition = calculateTaskBarPosition(
                      new Date(task.actualStartDate),
                      new Date(task.actualEndDate),
                      timelineStart,
                      timelineEnd,
                      containerWidth
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

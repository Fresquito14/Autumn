import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GanttTimeline } from './GanttTimeline'
import { GanttTaskBar } from './GanttTaskBar'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { getTimelineBounds, calculateTaskBarPosition } from '@/lib/calculations/dates'
import type { Task } from '@/types'

const ROW_HEIGHT = 40

export function GanttChart() {
  const { tasks, loadTasks, isLoading } = useTasks()
  const { currentProject } = useProject()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id)
    }
  }, [currentProject, loadTasks])

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

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

  // Get visible tasks (flatten hierarchy for Gantt)
  const visibleTasks = tasks.sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <div>
            <CardTitle>Diagrama de Gantt</CardTitle>
            <CardDescription>
              {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
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
          <div className="flex-1 overflow-x-auto" ref={containerRef}>
            <div style={{ minWidth: containerWidth }}>
              <GanttTimeline
                startDate={timelineStart}
                endDate={timelineEnd}
                width={containerWidth}
              />

              {/* Task bars */}
              <div className="relative">
                {visibleTasks.map((task, index) => {
                  const { left, width } = calculateTaskBarPosition(
                    new Date(task.startDate),
                    new Date(task.endDate),
                    timelineStart,
                    timelineEnd,
                    containerWidth
                  )

                  return (
                    <div
                      key={task.id}
                      className="border-b relative"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <GanttTaskBar
                        task={task}
                        left={left}
                        width={width}
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

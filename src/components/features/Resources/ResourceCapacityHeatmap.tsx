import { useState, useEffect, useMemo } from 'react'
import { startOfWeek, addWeeks, format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Resource, TaskResourceAssignment, Task, Holiday, Project } from '@/types'
import { getWeekKey, calculateWeeklyAllocation } from '@/lib/calculations/resources'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '@/lib/storage/db'

interface ResourceCapacityHeatmapProps {
  resources: Resource[]
  assignments: TaskResourceAssignment[]
  tasks?: Task[] // Optional: to use actual dates when available
  workingDaysPerWeek?: number[]
  holidays?: Holiday[] // Project holidays
  startDate: Date
  weekCount?: number // Number of weeks to display
}

interface WeekCapacity {
  weekKey: string
  weekStart: Date
  totalCapacity: number
  allocatedHours: number
  utilizationPercent: number
}

export function ResourceCapacityHeatmap({
  resources,
  assignments,
  tasks,
  workingDaysPerWeek = [1, 2, 3, 4, 5],
  holidays,
  startDate,
  weekCount = 12
}: ResourceCapacityHeatmapProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(new Set())
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')

  // Load all projects for breakdown and filter
  useEffect(() => {
    db.projects.toArray()
      .then(setProjects)
      .catch(err => console.error('Error loading projects for capacity map:', err))
  }, [])

  // Calculate capacity data per resource per week
  const capacityData = useMemo(() => {
    const data: Record<string, Record<string, WeekCapacity>> = {}
    const projectData: Record<string, Record<string, Record<string, number>>> = {}

    // Generate week keys
    const weeks: string[] = []
    for (let i = 0; i < weekCount; i++) {
      const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), i)
      const weekKey = getWeekKey(weekStart)
      weeks.push(weekKey)
    }

    // Initialize data structure for each resource
    resources.forEach(resource => {
      data[resource.id] = {}
      projectData[resource.id] = {}

      weeks.forEach(weekKey => {
        const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), weeks.indexOf(weekKey))
        data[resource.id][weekKey] = {
          weekKey,
          weekStart,
          totalCapacity: resource.maxHoursPerWeek,
          allocatedHours: 0,
          utilizationPercent: 0
        }
      })
    })

    // Create a map of tasks for quick lookup
    const taskMap = new Map<string, Task>()
    tasks?.forEach(task => taskMap.set(task.id, task))

    // Create a map of resources for quick lookup
    const resourceMap = new Map<string, Resource>()
    resources.forEach(resource => resourceMap.set(resource.id, resource))

    // Calculate allocated hours from assignments
    assignments.forEach(assignment => {
      // Get the task to check for actual dates and projectId
      const task = taskMap.get(assignment.taskId)
      if (!task) return

      const projectId = task.projectId
      const resource = resourceMap.get(assignment.resourceId)
      if (!resource) return

      // Apply project filter
      if (selectedProjectId !== 'all' && projectId !== selectedProjectId) {
        return
      }

      // Use actual dates if available, otherwise use the stored distribution
      let weeklyDistribution = assignment.weeklyDistribution

      if (task && (task.actualStartDate || task.actualEndDate)) {
        const taskStart = task.actualStartDate || task.startDate
        const taskEnd = task.actualEndDate || task.endDate

        weeklyDistribution = calculateWeeklyAllocation(
          taskStart,
          taskEnd,
          assignment.plannedHours,
          workingDaysPerWeek,
          resource,
          holidays
        )
      }

      // Initialize project breakdown sub-keys if needed
      if (!projectData[assignment.resourceId][projectId]) {
        projectData[assignment.resourceId][projectId] = {}
        weeks.forEach(wk => {
          projectData[assignment.resourceId][projectId][wk] = 0
        })
      }

      // Add hours to the heatmap
      weeklyDistribution.forEach(week => {
        const weekStartDate = week.weekStart instanceof Date ? week.weekStart : new Date(week.weekStart)
        const weekKey = getWeekKey(weekStartDate)

        if (data[assignment.resourceId] && data[assignment.resourceId][weekKey]) {
          data[assignment.resourceId][weekKey].allocatedHours += week.plannedHours
        }

        if (projectData[assignment.resourceId][projectId] && projectData[assignment.resourceId][projectId][weekKey] !== undefined) {
          projectData[assignment.resourceId][projectId][weekKey] += week.plannedHours
        }
      })
    })

    // Calculate utilization percentages
    Object.keys(data).forEach(resourceId => {
      Object.keys(data[resourceId]).forEach(weekKey => {
        const weekData = data[resourceId][weekKey]
        weekData.utilizationPercent = Math.round(
          (weekData.allocatedHours / weekData.totalCapacity) * 100
        )
      })
    })

    return { data, weeks, projectData }
  }, [resources, assignments, tasks, workingDaysPerWeek, holidays, startDate, weekCount, selectedProjectId])

  // Get color class based on utilization
  const getUtilizationColor = (percent: number) => {
    if (percent === 0) return 'bg-muted/40 dark:bg-muted/10'
    if (percent <= 50) return 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
    if (percent <= 75) return 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300'
    if (percent <= 100) return 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
    return 'bg-red-200 dark:bg-red-950/60 text-red-700 dark:text-red-300' // Over capacity
  }

  const getUtilizationLabel = (percent: number) => {
    if (percent === 0) return 'Sin asignar'
    if (percent <= 50) return 'Baja carga'
    if (percent <= 75) return 'Carga media'
    if (percent <= 100) return 'Alta carga'
    return 'Sobreasignado'
  }

  return (
    <div className="space-y-4">
      {/* Legend & Project Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3 mb-2">
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="font-semibold text-muted-foreground">Utilización:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-muted/40 border rounded" />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-green-100 dark:bg-green-950/40 border rounded" />
            <span>1-50%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-yellow-100 dark:bg-yellow-950/40 border rounded" />
            <span>51-75%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-orange-100 dark:bg-orange-950/40 border rounded" />
            <span>76-100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-red-200 dark:bg-red-950/60 border rounded" />
            <span>&gt;100%</span>
          </div>
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Filtrar por proyecto:</span>
          <select
            className="h-8 rounded-md border border-input bg-background text-foreground px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="all">Todos los proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="inline-block min-w-full">
          {/* Week headers */}
          <div className="flex">
            <div className="w-48 flex-shrink-0 p-2 font-semibold text-xs border-b uppercase text-muted-foreground">
              Recurso
            </div>
            {capacityData.weeks.map((weekKey, i) => {
              const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), i)
              return (
                <div
                  key={weekKey}
                  className="w-20 flex-shrink-0 p-2 text-center text-[10px] font-bold border-b border-l uppercase text-muted-foreground"
                >
                  {format(weekStart, 'dd MMM', { locale: es })}
                </div>
              )
            })}
          </div>

          {/* Resource rows */}
          {resources.map(resource => {
            const isExpanded = expandedResourceIds.has(resource.id)
            const rData = capacityData.data[resource.id]

            // Find all projects that have non-zero hours assigned to this resource in at least one week
            const assignedProjectIds = Object.keys(capacityData.projectData[resource.id] || {}).filter(pId => {
              return capacityData.weeks.some(wk => (capacityData.projectData[resource.id][pId]?.[wk] || 0) > 0)
            })

            return (
              <div key={resource.id} className="flex flex-col border-b">
                {/* Main Resource Row */}
                <div className="flex hover:bg-muted/10 h-12 items-center">
                  <div className="w-48 flex-shrink-0 p-2 border-r flex items-center gap-1.5 min-w-0 h-full bg-background/50">
                    {assignedProjectIds.length > 0 && (
                      <button
                        onClick={() => {
                          setExpandedResourceIds(prev => {
                            const next = new Set(prev)
                            if (next.has(resource.id)) next.delete(resource.id)
                            else next.add(resource.id)
                            return next
                          })
                        }}
                        className="p-1 hover:bg-muted rounded text-muted-foreground flex-shrink-0"
                        title={isExpanded ? "Contraer proyectos" : "Expandir proyectos"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0 flex-1 pl-1">
                      <div className="font-semibold text-xs text-foreground truncate" title={resource.name}>
                        {resource.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        Capacidad: {resource.maxHoursPerWeek}h/sem
                      </div>
                    </div>
                  </div>

                  {/* Heatmap cells */}
                  {capacityData.weeks.map(weekKey => {
                    const weekData = rData[weekKey]
                    return (
                      <div
                        key={weekKey}
                        className={cn(
                          'w-20 flex-shrink-0 border-l h-full flex flex-col justify-center items-center group relative cursor-help transition-colors',
                          getUtilizationColor(weekData.utilizationPercent)
                        )}
                      >
                        <div className="text-center text-xs font-bold">
                          {weekData.allocatedHours}h
                        </div>
                        <div className="text-center text-[9px] opacity-80 font-medium">
                          {weekData.utilizationPercent}%
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                            <div className="font-semibold">{resource.name}</div>
                            <div className="text-muted-foreground text-[10px]">
                              Semana {format(weekData.weekStart, 'dd MMM yyyy', { locale: es })}
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <div>Capacidad: {weekData.totalCapacity}h</div>
                              <div>Asignado: {weekData.allocatedHours}h</div>
                              <div>Utilización: {weekData.utilizationPercent}%</div>
                              <div className={cn(
                                'font-bold mt-0.5',
                                weekData.utilizationPercent > 100 && 'text-red-500'
                              )}>
                                {getUtilizationLabel(weekData.utilizationPercent)}
                              </div>

                              {/* Project breakdown inside tooltip */}
                              {assignedProjectIds.length > 0 && (
                                <div className="border-t pt-1.5 mt-1.5 text-[10px] space-y-1">
                                  <div className="font-semibold text-muted-foreground">Por Proyecto:</div>
                                  {assignedProjectIds.map(pId => {
                                    const proj = projects.find(p => p.id === pId)
                                    const hrs = capacityData.projectData[resource.id]?.[pId]?.[weekKey] || 0
                                    if (hrs === 0) return null
                                    return (
                                      <div key={pId} className="flex justify-between gap-4">
                                        <span className="text-muted-foreground truncate max-w-[120px]">{proj?.name}:</span>
                                        <span className="font-bold">{hrs}h</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Project Breakdown Rows */}
                {isExpanded && assignedProjectIds.map(pId => {
                  const project = projects.find(p => p.id === pId)
                  if (!project) return null

                  return (
                    <div key={pId} className="flex bg-muted/5 dark:bg-muted/2 h-9 items-center border-t border-muted/5">
                      {/* Left title */}
                      <div className="w-48 flex-shrink-0 pl-8 pr-2 border-r text-[10px] text-muted-foreground truncate font-medium h-full flex items-center bg-background/20" title={project.name}>
                        ↳ {project.name}
                      </div>

                      {/* Cells */}
                      {capacityData.weeks.map(weekKey => {
                        const hours = capacityData.projectData[resource.id]?.[pId]?.[weekKey] || 0
                        return (
                          <div
                            key={weekKey}
                            className="w-20 flex-shrink-0 border-l text-center text-xs font-semibold text-muted-foreground h-full flex items-center justify-center"
                          >
                            {hours > 0 ? (
                              <span className="text-foreground/80">{hours}h</span>
                            ) : (
                              <span className="opacity-20">-</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {resources.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No hay recursos disponibles. Crea recursos para ver el mapa de capacidad.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

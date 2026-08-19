import { useState, useEffect, useMemo } from 'react'
import { startOfWeek, addWeeks, addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Resource, TaskResourceAssignment, Task, Holiday, Project } from '@/types'
import { getWeekKey, calculateWeeklyAllocation } from '@/lib/calculations/resources'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Zap,
  Users
} from 'lucide-react'
import { db } from '@/lib/storage/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'


interface ResourceCapacityHeatmapProps {
  resources: Resource[]
  assignments: TaskResourceAssignment[]
  tasks?: Task[]
  workingDaysPerWeek?: number[]
  holidays?: Holiday[]
  startDate: Date
  weekCount?: number
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

  // Find earliest task date or project start date for smart initial date
  const earliestDate = useMemo(() => {
    if (tasks && tasks.length > 0) {
      const validDates = tasks.map(t => new Date(t.startDate)).filter(d => !isNaN(d.getTime()))
      if (validDates.length > 0) {
        const minTime = Math.min(...validDates.map(d => d.getTime()))
        return startOfWeek(new Date(minTime), { weekStartsOn: 1 })
      }
    }
    return startOfWeek(startDate || new Date(), { weekStartsOn: 1 })
  }, [tasks, startDate])


  // Internal Navigation Date & Week Count States
  const [currentStartDate, setCurrentStartDate] = useState<Date>(earliestDate)
  const [visibleWeeks, setVisibleWeeks] = useState<number>(weekCount)

  // Sync internal date when earliestDate changes initially
  useEffect(() => {
    setCurrentStartDate(earliestDate)
  }, [earliestDate])

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

    const weekStartBase = startOfWeek(currentStartDate, { weekStartsOn: 1 })

    // Generate week keys
    const weeks: string[] = []
    for (let i = 0; i < visibleWeeks; i++) {
      const wStart = addWeeks(weekStartBase, i)
      const weekKey = getWeekKey(wStart)
      weeks.push(weekKey)
    }

    // Initialize data structure for each resource
    resources.forEach(resource => {
      data[resource.id] = {}
      projectData[resource.id] = {}

      weeks.forEach((weekKey, idx) => {
        const wStart = addWeeks(weekStartBase, idx)
        data[resource.id][weekKey] = {
          weekKey,
          weekStart: wStart,
          totalCapacity: resource.maxHoursPerWeek,
          allocatedHours: 0,
          utilizationPercent: 0
        }
      })
    })

    // Maps for fast lookup
    const taskMap = new Map<string, Task>()
    tasks?.forEach(task => taskMap.set(task.id, task))

    const resourceMap = new Map<string, Resource>()
    resources.forEach(resource => resourceMap.set(resource.id, resource))

    // Calculate allocated hours from assignments
    assignments.forEach(assignment => {
      const task = taskMap.get(assignment.taskId)
      if (!task) return

      const projectId = task.projectId
      const resource = resourceMap.get(assignment.resourceId)
      if (!resource) return

      if (selectedProjectId !== 'all' && projectId !== selectedProjectId) {
        return
      }

      let allocations = assignment.weeklyDistribution

      if (!allocations || allocations.length === 0 || !assignment.isManualDistribution) {
        const taskStart = new Date(task.startDate)
        const taskEnd = new Date(task.endDate)

        if (!isNaN(taskStart.getTime()) && !isNaN(taskEnd.getTime())) {
          allocations = calculateWeeklyAllocation(
            taskStart,
            taskEnd,
            assignment.plannedHours,
            workingDaysPerWeek,
            resource,
            holidays
          )
        }
      }

      allocations?.forEach(alloc => {
        const weekKey = getWeekKey(new Date(alloc.weekStart))

        if (data[resource.id]?.[weekKey]) {
          data[resource.id][weekKey].allocatedHours += alloc.plannedHours

          if (!projectData[resource.id][projectId]) {
            projectData[resource.id][projectId] = {}
          }
          projectData[resource.id][projectId][weekKey] = (projectData[resource.id][projectId][weekKey] || 0) + alloc.plannedHours
        }
      })
    })

    // Calculate utilization percentages
    resources.forEach(resource => {
      weeks.forEach(weekKey => {
        const item = data[resource.id][weekKey]
        if (item && item.totalCapacity > 0) {
          item.utilizationPercent = Math.round((item.allocatedHours / item.totalCapacity) * 100)
        }
      })
    })

    return { data, weeks, projectData }
  }, [resources, assignments, tasks, workingDaysPerWeek, holidays, currentStartDate, visibleWeeks, selectedProjectId])

  // Statistics Summary
  const stats = useMemo(() => {
    let overloadedCount = 0
    let optimalCount = 0
    let availableCount = 0

    resources.forEach(r => {
      const rWeeks = capacityData.data[r.id]
      if (!rWeeks) return
      const maxUtil = Math.max(...Object.values(rWeeks).map(w => w.utilizationPercent), 0)
      if (maxUtil > 100) overloadedCount++
      else if (maxUtil >= 75) optimalCount++
      else availableCount++
    })

    return { overloadedCount, optimalCount, availableCount }
  }, [resources, capacityData])

  // Helpers for navigation
  const handleNavWeeks = (count: number) => {
    setCurrentStartDate(prev => addWeeks(prev, count))
  }

  const handleJumpToToday = () => {
    setCurrentStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const handleJumpToEarliest = () => {
    setCurrentStartDate(earliestDate)
  }

  const getUtilizationColor = (percent: number) => {
    if (percent === 0) return 'bg-muted/30 dark:bg-muted/10 text-muted-foreground'
    if (percent <= 50) return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold border-emerald-200/60'
    if (percent <= 75) return 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 font-semibold border-sky-200/60'
    if (percent <= 100) return 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 font-bold border-amber-300/60'
    return 'bg-rose-200 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 font-extrabold border-rose-300 animate-pulse'
  }

  const firstWeekStart = startOfWeek(currentStartDate, { weekStartsOn: 1 })
  const lastWeekEnd = addDays(addWeeks(firstWeekStart, visibleWeeks - 1), 6)

  return (
    <div className="space-y-4">
      {/* Upper UX Toolbar: KPI Summary & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* KPI Cards */}
        <div className="flex items-center gap-2 p-3 bg-card border rounded-xl shadow-sm">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.overloadedCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Recursos Sobreasignados (&gt;100%)</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-card border rounded-xl shadow-sm">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.optimalCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Alta Carga Óptima (75-100%)</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-card border rounded-xl shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.availableCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Capacidad Disponible (&lt;75%)</div>
          </div>
        </div>
      </div>

      {/* Date Navigation & View Controls Bar */}
      <div className="p-3 bg-card border rounded-xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Navigation Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavWeeks(-4)}
              title="Retroceder 4 semanas"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavWeeks(-1)}
              title="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={handleJumpToToday}
            >
              Hoy
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleJumpToEarliest}
              title="Ir al inicio de las tareas del proyecto"
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Inicio Tareas
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavWeeks(1)}
              title="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNavWeeks(4)}
              title="Avanzar 4 semanas"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>

            {/* Date Input Jump */}
            <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                className="h-8 text-xs px-2 rounded border border-input bg-background text-foreground focus:outline-none"
                value={format(firstWeekStart, 'yyyy-MM-dd')}
                onChange={e => {
                  if (e.target.value) {
                    const d = new Date(e.target.value)
                    if (!isNaN(d.getTime())) {
                      setCurrentStartDate(startOfWeek(d, { weekStartsOn: 1 }))
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Active Range Display Badge & View Options */}
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold gap-1 bg-muted/60">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {format(firstWeekStart, 'dd MMM yyyy', { locale: es })} — {format(lastWeekEnd, 'dd MMM yyyy', { locale: es })}
            </Badge>


            {/* Weeks Count Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground font-medium hidden sm:inline">Semanas:</span>
              <div className="flex border rounded-lg overflow-hidden bg-muted/30">
                {[4, 8, 12, 16].map(count => (
                  <button
                    key={count}
                    onClick={() => setVisibleWeeks(count)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      visibleWeeks === count
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {count}w
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Legend Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t text-xs">
          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-muted-foreground">Ocupación:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-muted/30 border rounded" />
              <span className="text-[11px] text-muted-foreground">0%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-emerald-100 dark:bg-emerald-950/50 border rounded" />
              <span className="text-[11px]">1-50%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-sky-100 dark:bg-sky-950/50 border rounded" />
              <span className="text-[11px]">51-75%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-100 dark:bg-amber-950/50 border rounded" />
              <span className="text-[11px]">76-100%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-rose-200 dark:bg-rose-950/80 border rounded" />
              <span className="text-[11px] font-bold text-rose-600">&gt;100% (Sobreasignado)</span>
            </div>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Proyecto:</span>
            <select
              className="h-7 rounded border border-input bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
      </div>

      {/* Heatmap Grid Container */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm w-full">
        <div className="overflow-x-auto scrollbar-hide w-full">
          <div className="min-w-full inline-block">
            {/* Week headers */}
            <div className="flex bg-muted/40 border-b w-full">
              <div className="w-52 flex-shrink-0 p-2.5 font-bold text-xs uppercase text-muted-foreground border-r flex items-center gap-2 bg-muted/50">
                <Users className="h-3.5 w-3.5" />
                Recurso
              </div>
              {capacityData.weeks.map((weekKey, i) => {
                const wStart = addWeeks(firstWeekStart, i)
                return (
                  <div
                    key={weekKey}
                    className="flex-1 min-w-[75px] p-2 text-center text-[10px] font-bold border-r uppercase text-muted-foreground"
                  >
                    <div>{format(wStart, 'dd MMM', { locale: es })}</div>
                    <div className="text-[9px] font-normal text-muted-foreground/80">Sem {i + 1}</div>
                  </div>
                )
              })}
            </div>

            {/* Resource rows */}
            {resources.map(resource => {
              const isExpanded = expandedResourceIds.has(resource.id)
              const rData = capacityData.data[resource.id]

              const assignedProjectIds = Object.keys(capacityData.projectData[resource.id] || {}).filter(pId => {
                return capacityData.weeks.some(wk => (capacityData.projectData[resource.id][pId]?.[wk] || 0) > 0)
              })

              return (
                <div key={resource.id} className="flex flex-col border-b last:border-b-0 w-full">
                  {/* Main Resource Row */}
                  <div className="flex hover:bg-muted/20 h-11 items-center transition-colors w-full">
                    <div className="w-52 flex-shrink-0 px-3 py-2 border-r flex items-center justify-between min-w-0 h-full bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        {assignedProjectIds.length > 0 ? (
                          <button
                            onClick={() => {
                              setExpandedResourceIds(prev => {
                                const next = new Set(prev)
                                if (next.has(resource.id)) next.delete(resource.id)
                                else next.add(resource.id)
                                return next
                              })
                            }}
                            className="hover:bg-muted rounded p-0.5 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <div className="w-4" />
                        )}
                        <span className="font-semibold text-xs truncate" title={resource.name}>
                          {resource.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                        {resource.maxHoursPerWeek}h
                      </span>
                    </div>

                    {/* Capacity cells */}
                    {capacityData.weeks.map(weekKey => {
                      const weekCap = rData?.[weekKey]
                      const allocated = weekCap?.allocatedHours || 0
                      const percent = weekCap?.utilizationPercent || 0
                      const colorClass = getUtilizationColor(percent)

                      return (
                        <div
                          key={weekKey}
                          className={cn(
                            "flex-1 min-w-[75px] h-full border-r flex flex-col items-center justify-center p-1 text-[11px] border-b border-b-transparent transition-all hover:scale-105 hover:z-10 hover:shadow-md cursor-default",
                            colorClass
                          )}
                          title={`${resource.name} (${format(weekCap?.weekStart || new Date(), 'dd MMM', { locale: es })}): ${allocated}h / ${resource.maxHoursPerWeek}h (${percent}%)`}
                        >
                          <div>{allocated > 0 ? `${allocated}h` : '-'}</div>
                          {allocated > 0 && (
                            <div className="text-[9px] opacity-80">{percent}%</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Expanded Breakdown by Project */}
                  {isExpanded && assignedProjectIds.map(pId => {
                    const project = projects.find(p => p.id === pId)
                    const projectName = project ? project.name : 'Proyecto Desconocido'

                    return (
                      <div key={pId} className="flex bg-muted/20 h-8 items-center border-t border-dashed w-full">
                        <div className="w-52 flex-shrink-0 pl-8 pr-2 text-[11px] font-medium text-muted-foreground truncate border-r">
                          ↳ {projectName}
                        </div>
                        {capacityData.weeks.map(weekKey => {
                          const projHours = capacityData.projectData[resource.id]?.[pId]?.[weekKey] || 0
                          return (
                            <div
                              key={weekKey}
                              className="flex-1 min-w-[75px] h-full border-r flex items-center justify-center text-[10px] text-muted-foreground/80 font-mono"
                            >
                              {projHours > 0 ? `${projHours}h` : '-'}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

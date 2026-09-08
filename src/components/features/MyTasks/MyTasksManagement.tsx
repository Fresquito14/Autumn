import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ListTodo,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  Filter,
  UserCheck,
  AlertCircle,
  Briefcase,
  LayoutGrid,
  CalendarRange,
  AlertTriangle,
  Columns,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TaskManagementCard } from './TaskManagementCard'
import { MyTasksTimeline } from './MyTasksTimeline'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useProject } from '@/hooks/useProject'
import { db } from '@/infrastructure/storage/dexie/db'
import { detectTaskConflicts } from '@/domain/calculations/conflicts'
import {
  filterAndSortMyTasks,
  getTaskTemporalStatus,
  type TaskStatusFilter,
} from '@/domain/calculations/my-tasks'
import type { Task, Project, ChecklistItem } from '@/types'

export function MyTasksManagement() {
  const { user } = useAuth()
  const { userRole } = useOrganization()
  const { resources, loadAllResources } = useResources()
  const { assignments, loadAllAssignments } = useResourceAssignments()
  const { loadProjects } = useProject()

  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [allDbProjects, setAllDbProjects] = useState<Project[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('active')
  const [viewLayout, setViewLayout] = useState<'both' | 'cards' | 'timeline'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('autumn_my_tasks_layout') : null
    if (saved === 'both' || saved === 'cards' || saved === 'timeline') {
      return saved
    }
    return 'both'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const handleLayoutChange = (newLayout: 'both' | 'cards' | 'timeline') => {
    setViewLayout(newLayout)
    try {
      localStorage.setItem('autumn_my_tasks_layout', newLayout)
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  const isInitialLoadRef = useRef(true)
  const hasAutoMatchedUserRef = useRef(false)

  const isManagerOrAdmin = !user || userRole === 'manager' || userRole === 'admin'

  // Load all projects, tasks, resources, and assignments directly from storage
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent && isInitialLoadRef.current) {
      setIsLoading(true)
    }

    try {
      // Sync stores in parallel
      await Promise.all([
        loadProjects(),
        loadAllResources(),
        loadAllAssignments(),
      ])

      // Fetch directly from IndexedDB
      const [dbProjects, rawDbTasks, , dbResources] = await Promise.all([
        db.projects.toArray(),
        db.tasks.toArray(),
        db.taskResourceAssignments.toArray(),
        db.resources.toArray(),
      ])

      // Sanitize any stale or orphaned actualStartDate for tasks that are not completed
      // (e.g. old 2025 dates that conflict with 2026 planned schedules)
      const dbTasks = await Promise.all(
        rawDbTasks.map(async (task) => {
          const isCompleted =
            task.percentComplete === 100 ||
            (task.actualDuration !== undefined && task.actualDuration !== null)
          if (!isCompleted && task.actualStartDate) {
            const actualStart = new Date(task.actualStartDate)
            const plannedStart = new Date(task.startDate)
            if (actualStart.getTime() < plannedStart.getTime()) {
              await db.tasks.update(task.id, {
                actualStartDate: undefined,
                actualEndDate: undefined,
              })
              return {
                ...task,
                actualStartDate: undefined,
                actualEndDate: undefined,
              }
            }
          }
          return task
        })
      )

      setAllDbProjects(dbProjects)
      setAllTasks(dbTasks)

      // Auto-match user to their resource once on mount
      if (!hasAutoMatchedUserRef.current && dbResources.length > 0) {
        hasAutoMatchedUserRef.current = true
        let matchedId = ''

        if (user?.email) {
          const matchingResource = dbResources.find(
            (r) => r.email?.toLowerCase() === user.email?.toLowerCase()
          )
          if (matchingResource) {
            matchedId = matchingResource.id
          }
        }

        // Fallback to the first resource if no email match
        if (!matchedId && dbResources.length > 0) {
          matchedId = dbResources[0].id
        }

        if (matchedId) {
          setSelectedResourceId(matchedId)
        }
      }
    } catch (err) {
      console.error('Error loading tasks for MyTasks view:', err)
    } finally {
      setIsLoading(false)
      isInitialLoadRef.current = false
    }
  }, [loadProjects, loadAllResources, loadAllAssignments, user?.email])

  // Single mount effect - no infinite render loop
  useEffect(() => {
    loadAllData(false)
  }, [loadAllData])

  const currentResource = resources.find((r) => r.id === selectedResourceId)

  // Map of project names
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    allDbProjects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [allDbProjects])

  // Tasks eligible for current resource selection
  const relevantTasks = useMemo(() => {
    if (!selectedResourceId || selectedResourceId === 'all') {
      return allTasks
    }
    return allTasks.filter((t) => {
      const isDirect = Array.isArray(t.assignedTo) && t.assignedTo.includes(selectedResourceId)
      const hasAssign = assignments.some(
        (a) => a.taskId === t.id && a.resourceId === selectedResourceId
      )
      return isDirect || hasAssign
    })
  }, [allTasks, selectedResourceId, assignments])

  // Count metrics for tabs
  const counts = useMemo(() => {
    let active = 0
    let upcoming = 0
    let completed = 0

    relevantTasks.forEach((t) => {
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) {
        return
      }
      const st = getTaskTemporalStatus(t)
      if (st === 'completed') {
        completed++
      } else if (st === 'upcoming') {
        upcoming++
      } else {
        // 'active' or 'overdue'
        active++
      }
    })

    const total = active + upcoming + completed
    return { active, upcoming, completed, total }
  }, [relevantTasks, selectedProjectId])

  // Total actual hours logged by selected resource(s)
  const totalHoursLogged = useMemo(() => {
    let myAssignments = assignments
    if (selectedResourceId && selectedResourceId !== 'all') {
      myAssignments = assignments.filter((a) => a.resourceId === selectedResourceId)
    }
    const hours = myAssignments.reduce((sum, a) => sum + (a.actualHours || 0), 0)
    return Math.round(hours * 10) / 10
  }, [assignments, selectedResourceId])

  // Conflict map for all relevant tasks of this resource
  const conflictMap = useMemo(() => {
    return detectTaskConflicts(relevantTasks)
  }, [relevantTasks])

  // Count tasks with scheduling conflicts
  const conflictsCount = useMemo(() => {
    let count = 0
    conflictMap.forEach((info) => {
      if (info.hasConflict) count++
    })
    return count
  }, [conflictMap])

  // Filtered and sorted tasks for display
  const displayedTasks = useMemo(() => {
    return filterAndSortMyTasks({
      tasks: allTasks,
      resourceId: selectedResourceId,
      statusFilter,
      projectId: selectedProjectId,
      searchQuery,
      assignments,
    })
  }, [allTasks, selectedResourceId, statusFilter, selectedProjectId, searchQuery, assignments])

  const handleTaskUpdated = useCallback((taskId?: string, updatedChecklist?: ChecklistItem[]) => {
    if (taskId && updatedChecklist) {
      setAllTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, checklist: updatedChecklist } : t))
      )
    } else {
      // Refresh tasks directly from local IndexedDB without triggering cloud overwrites
      db.tasks.toArray().then((dbTasks) => {
        setAllTasks(dbTasks)
      })
    }
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-8 sm:pb-12 px-0 sm:px-1">
      {/* Header Banner & Filters */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Gestión de Tareas</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">
              Imputa horas, completa checklists y supervisa solapes de tareas en el cronograma.
            </p>
          </div>

          {/* Resource Selector & Conflict Indicator */}
          <div className="flex items-center gap-3 flex-wrap">
            {conflictsCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs py-1 px-2.5 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-500/20 transition-colors"
                onClick={() => handleLayoutChange('both')}
                title="Ver solapes y cronograma a la vez"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>{conflictsCount} en conflicto / solape</span>
              </Badge>
            )}

            {isManagerOrAdmin && resources.length > 0 ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="resource-select" className="text-xs text-muted-foreground whitespace-nowrap">
                  Recurso:
                </Label>
                <select
                  id="resource-select"
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background text-foreground px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer font-medium"
                >
                  <option value="all">👥 Todos los miembros del equipo</option>
                  {resources.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} {res.email ? `(${res.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : currentResource ? (
              <Badge variant="outline" className="text-xs py-1 px-2.5 gap-1.5 bg-muted/30">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>{currentResource.name}</span>
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'active' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">Tareas Activas</span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">{counts.active}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">Horas Imputadas</span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">{totalHoursLogged}h</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'completed' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('completed')}
          >
            <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">Completadas</span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">{counts.completed}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'all' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">Total Asignadas</span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">{counts.total}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'active'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              En Curso / Activas
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'active'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('upcoming')}
              className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'upcoming'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Próximas
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'upcoming'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts.upcoming}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'completed'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Completadas
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'completed'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts.completed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Todas
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'all'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts.total}
              </span>
            </button>
          </div>

          {/* View Layout Toggle & Project filter & Search input */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Layout Switcher */}
            <ToggleGroup
              type="single"
              value={viewLayout}
              onValueChange={(val) => val && handleLayoutChange(val as 'both' | 'cards' | 'timeline')}
              className="border rounded-md bg-background h-8"
            >
              <ToggleGroupItem
                value="both"
                aria-label="Vista combinada: cronograma y tarjetas a la vez"
                className="text-xs px-2.5 h-7 gap-1.5"
                title="Mostrar cronograma y tarjetas simultáneamente para ver solapes"
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">A la vez</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cards"
                aria-label="Vista tarjetas"
                className="text-xs px-2.5 h-7 gap-1.5"
                title="Ver solo tarjetas de tareas"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tarjetas</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="timeline"
                aria-label="Vista cronograma horizontal"
                className="text-xs px-2.5 h-7 gap-1.5"
                title="Ver solo cronograma"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cronograma</span>
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Project Filter */}
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer flex-1 sm:w-44"
              >
                <option value="all">Todos los proyectos</option>
                {allDbProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar tarea o WBS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tasks View: Cards, Horizontal Timeline, or Both Concurrently */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Cargando tareas asignadas...
        </div>
      ) : displayedTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium">
              No hay tareas para mostrar en esta sección
            </p>
            <p className="text-xs">
              {allTasks.length === 0
                ? 'No existen tareas creadas en tus proyectos todavía.'
                : statusFilter === 'active'
                ? 'No tienes tareas activas o en curso actualmente. Puedes ver tus tareas futuras en la pestaña "Próximas" o en "Todas".'
                : 'No se encontraron tareas con los filtros seleccionados.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Cronograma / Timeline Section (visible in 'both' or 'timeline' modes) */}
          {(viewLayout === 'both' || viewLayout === 'timeline') && (
            <div className="space-y-2">
              {viewLayout === 'both' && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CalendarRange className="h-4 w-4 text-primary" />
                    <span>Cronograma de Responsabilidades y Solapes</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Visualización temporal con detección de solapes
                  </span>
                </div>
              )}
              <MyTasksTimeline
                tasks={displayedTasks}
                projectMap={projectMap}
                onTaskUpdated={handleTaskUpdated}
                resourceId={selectedResourceId && selectedResourceId !== 'all' ? selectedResourceId : currentResource?.id || resources[0]?.id}
              />
            </div>
          )}

          {/* Cards Management Section (visible in 'both' or 'cards' modes) */}
          {(viewLayout === 'both' || viewLayout === 'cards') && (
            <div className="space-y-3">
              {viewLayout === 'both' && (
                <div className="flex items-center justify-between px-1 pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <ListTodo className="h-4 w-4 text-primary" />
                    <span>Detalle y Gestión de Tareas ({displayedTasks.length})</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Imputa horas, completa checklists o crea subtareas
                  </span>
                </div>
              )}

              <div className="space-y-2.5 sm:space-y-3">
                {displayedTasks.map((task) => {
                  const effectiveResourceId =
                    selectedResourceId && selectedResourceId !== 'all'
                      ? selectedResourceId
                      : task.assignedTo?.[0] || resources[0]?.id || ''

                  const conflictInfo = conflictMap.get(task.id)

                  return (
                    <TaskManagementCard
                      key={task.id}
                      task={task}
                      projectName={projectMap.get(task.projectId) || 'Proyecto'}
                      resourceId={effectiveResourceId}
                      onTaskUpdated={handleTaskUpdated}
                      hasConflict={conflictInfo?.hasConflict}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

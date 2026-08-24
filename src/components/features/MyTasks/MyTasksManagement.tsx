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
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TaskManagementCard } from './TaskManagementCard'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useProject } from '@/hooks/useProject'
import { db } from '@/infrastructure/storage/dexie/db'
import {
  filterAndSortMyTasks,
  getTaskTemporalStatus,
  type TaskStatusFilter,
} from '@/domain/calculations/my-tasks'
import type { Task, Project } from '@/types'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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
      const [dbProjects, dbTasks, , dbResources] = await Promise.all([
        db.projects.toArray(),
        db.tasks.toArray(),
        db.taskResourceAssignments.toArray(),
        db.resources.toArray(),
      ])

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

  const handleSilentRefresh = useCallback(() => {
    loadAllData(true)
  }, [loadAllData])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ListTodo className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Gestión de Tareas</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Imputa horas, completa checklists y crea subtareas ordenadas por fecha de inicio.
            </p>
          </div>

          {/* Resource Selector for Managers / Admins */}
          <div className="flex items-center gap-3 flex-wrap">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'active' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Tareas Activas</span>
                <span className="text-lg font-bold text-foreground">{counts.active}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Horas Imputadas</span>
                <span className="text-lg font-bold text-foreground">{totalHoursLogged}h</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'completed' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('completed')}
          >
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Completadas</span>
                <span className="text-lg font-bold text-foreground">{counts.completed}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${
              statusFilter === 'all' ? 'border-primary ring-1 ring-primary' : 'bg-card/50 hover:bg-card'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Total Asignadas</span>
                <span className="text-lg font-bold text-foreground">{counts.total}</span>
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
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
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
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
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
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
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
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
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

          {/* Project filter & Search input */}
          <div className="flex items-center gap-2">
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

      {/* Task List */}
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
        <div className="space-y-3">
          {displayedTasks.map((task) => {
            const effectiveResourceId =
              selectedResourceId && selectedResourceId !== 'all'
                ? selectedResourceId
                : task.assignedTo?.[0] || resources[0]?.id || ''

            return (
              <TaskManagementCard
                key={task.id}
                task={task}
                projectName={projectMap.get(task.projectId) || 'Proyecto'}
                resourceId={effectiveResourceId}
                onTaskUpdated={handleSilentRefresh}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

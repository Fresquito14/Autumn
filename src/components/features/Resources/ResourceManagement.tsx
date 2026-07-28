import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit, Trash2, Users, Search, CheckSquare, Square, X, Calendar } from 'lucide-react'
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { useGlobalHolidays } from '@/hooks/useGlobalHolidays'
import { getCombinedHolidays } from '@/lib/calculations/holidays'
import { ResourceCapacityHeatmap } from './ResourceCapacityHeatmap'
import { ResourceFormDialog } from './ResourceFormDialog'
import { db } from '@/lib/storage/db'
import type { Resource, Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function ResourceManagement() {
  const { resources, isLoading, loadAllResources, deleteResource, deleteResources, updateResource } = useResources()
  const { assignments, loadAllAssignments } = useResourceAssignments()
  const { tasks } = useTasks()
  const { currentProject } = useProject()
  const { holidays: globalHolidays, loadAllHolidays } = useGlobalHolidays()

  const [selectedResource, setSelectedResource] = useState<Resource | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [heatmapStartDate, setHeatmapStartDate] = useState<Date>(() => new Date())
  const [allTasks, setAllTasks] = useState<Task[]>([])
  
  // Selection and search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set())

  // Vacation management states
  const [vacationsResource, setVacationsResource] = useState<Resource | null>(null)
  const [newVacationStart, setNewVacationStart] = useState('')
  const [newVacationEnd, setNewVacationEnd] = useState('')

  const handleAddVacationToResource = async (resourceId: string, start: Date, end: Date) => {
    const res = resources.find(r => r.id === resourceId)
    if (!res) return
    const currentVacations = res.calendar?.vacations || []
    const newVacations = [...currentVacations, { start, end }]
    
    try {
      await updateResource(resourceId, {
        calendar: { ...res.calendar, vacations: newVacations }
      })
      setNewVacationStart('')
      setNewVacationEnd('')
      setVacationsResource({ ...res, calendar: { ...res.calendar, vacations: newVacations } })
    } catch (err) {
      console.error('Error adding vacation:', err)
    }
  }

  const handleRemoveVacationFromResource = async (resourceId: string, index: number) => {
    const res = resources.find(r => r.id === resourceId)
    if (!res) return
    const currentVacations = res.calendar?.vacations || []
    const newVacations = currentVacations.filter((_, idx) => idx !== index)
    
    try {
      await updateResource(resourceId, {
        calendar: { ...res.calendar, vacations: newVacations }
      })
      setVacationsResource({ ...res, calendar: { ...res.calendar, vacations: newVacations } })
    } catch (err) {
      console.error('Error removing vacation:', err)
    }
  }

  // Load all resources, global holidays, assignments, and tasks on mount
  useEffect(() => {
    loadAllResources()
    loadAllAssignments()
    loadAllHolidays()
    db.tasks.toArray()
      .then(setAllTasks)
      .catch(err => console.error('Error loading all tasks for resources:', err))
  }, [loadAllResources, loadAllAssignments, loadAllHolidays])

  // Combine global and project-specific holidays
  const combinedHolidays = useMemo(() => {
    if (!currentProject) return []
    return getCombinedHolidays(globalHolidays, currentProject.config)
  }, [globalHolidays, currentProject])

  // Filter resources based on query (checks name, email, and tags)
  const filteredResources = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return resources

    return resources.filter(resource => {
      const matchName = resource.name.toLowerCase().includes(query)
      const matchEmail = resource.email?.toLowerCase().includes(query) || false
      const matchTags = resource.tags?.some(tag => tag.toLowerCase().includes(query)) || false
      return matchName || matchEmail || matchTags
    })
  }, [resources, searchQuery])

  // Track if all currently filtered resources are selected
  const isAllFilteredSelected = useMemo(() => {
    if (filteredResources.length === 0) return false
    return filteredResources.every(r => selectedResourceIds.has(r.id))
  }, [filteredResources, selectedResourceIds])

  const toggleSelectResource = (id: string) => {
    setSelectedResourceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllFiltered = () => {
    setSelectedResourceIds(prev => {
      const next = new Set(prev)
      if (isAllFilteredSelected) {
        // Deselect all filtered resources
        filteredResources.forEach(r => next.delete(r.id))
      } else {
        // Select all filtered resources
        filteredResources.forEach(r => next.add(r.id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    const count = selectedResourceIds.size
    if (count === 0) return

    if (confirm(`¿Estás seguro de que deseas eliminar los ${count} recursos seleccionados? Se borrarán todas sus asignaciones.`)) {
      const idsToDelete = Array.from(selectedResourceIds)
      await deleteResources(idsToDelete)
      setSelectedResourceIds(new Set()) // Reset selection
    }
  }

  const handleCreateResource = () => {
    setSelectedResource(undefined)
    setIsFormOpen(true)
  }

  const handleEditResource = (resource: Resource) => {
    setSelectedResource(resource)
    setIsFormOpen(true)
  }

  const handleDeleteResource = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este recurso? Se eliminarán todas sus asignaciones.')) {
      await deleteResource(id)
      setSelectedResourceIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gestión de Recursos
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra los recursos globales y visualiza su carga de trabajo
          </p>
        </div>
        <Button onClick={handleCreateResource}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Recurso
        </Button>
      </div>

      {/* Resource List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Recursos Disponibles</CardTitle>
            <CardDescription>
              {resources.length} recurso{resources.length !== 1 ? 's' : ''} registrado{resources.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 w-72">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrar por nombre, email o tags..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando recursos...
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay recursos creados</p>
              <p className="text-sm">Crea tu primer recurso para comenzar</p>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Ningún recurso coincide con "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Action bar for selection */}
              <div className="flex items-center justify-between pb-2 border-b text-sm text-muted-foreground gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 h-8 text-xs flex items-center gap-1.5 hover:bg-muted"
                    onClick={handleSelectAllFiltered}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {isAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos los filtrados'}
                  </Button>
                  {selectedResourceIds.size > 0 && (
                    <span className="text-xs font-medium text-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedResourceIds.size} seleccionado{selectedResourceIds.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {selectedResourceIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs font-semibold px-3"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Eliminar seleccionados ({selectedResourceIds.size})
                  </Button>
                )}
              </div>

              {/* Compact table layout */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="p-3 w-12 text-center">Seleccionar</th>
                      <th className="p-3">Recurso</th>
                      <th className="p-3">Capacidad y Coste</th>
                      <th className="p-3">Tags / Habilidades</th>
                      <th className="p-3">Vacaciones Solicitadas</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResources.map(resource => {
                      const isSelected = selectedResourceIds.has(resource.id)
                      const vacations = resource.calendar?.vacations || []
                      return (
                        <tr
                          key={resource.id}
                          className={`border-b last:border-0 transition-colors ${
                            isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="p-3 text-center">
                            <button
                              className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center mx-auto"
                              onClick={() => toggleSelectResource(resource.id)}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4.5 w-4.5 text-primary" />
                              ) : (
                                <Square className="h-4.5 w-4.5" />
                              )}
                            </button>
                          </td>

                          {/* Resource Name and Email */}
                          <td className="p-3">
                            <div className="font-semibold text-foreground text-xs">{resource.name}</div>
                            {resource.email && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={resource.email}>
                                {resource.email}
                              </div>
                            )}
                          </td>

                          {/* Capacity and Cost */}
                          <td className="p-3 text-[11px] space-y-0.5">
                            <div className="font-medium text-foreground">{resource.maxHoursPerWeek}h/semana</div>
                            {resource.costPerHour && (
                              <div className="text-muted-foreground">{resource.costPerHour}€/hora</div>
                            )}
                          </td>

                          {/* Tags */}
                          <td className="p-3">
                            {resource.tags && resource.tags.length > 0 ? (
                              <div className="flex gap-1 flex-wrap max-w-[160px]">
                                {resource.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60 italic">Sin tags</span>
                            )}
                          </td>

                          {/* Vacations */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-[260px]">
                              {vacations.length > 0 ? (
                                vacations.map((vac, idx) => {
                                  const startStr = format(new Date(vac.start), 'dd MMM', { locale: es })
                                  const endStr = format(new Date(vac.end), 'dd MMM', { locale: es })
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 rounded text-[10px] font-semibold border border-sky-200/50"
                                    >
                                      <Calendar className="h-3 w-3 text-sky-500" />
                                      {startStr} - {endStr}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveVacationFromResource(resource.id, idx)
                                        }}
                                        className="hover:text-red-500 rounded-full p-0.5 transition-colors"
                                        title="Eliminar estas vacaciones"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </span>
                                  )
                                })
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 italic">Sin vacaciones</span>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-full hover:bg-sky-100 dark:hover:bg-sky-950 text-sky-600 dark:text-sky-400"
                                onClick={() => setVacationsResource(resource)}
                                title="Gestionar vacaciones"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>

                          {/* Row Actions */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditResource(resource)}
                                title="Editar recurso"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteResource(resource.id)}
                                title="Eliminar recurso"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Heatmap */}
      {resources.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Mapa de Capacidad</CardTitle>
              <CardDescription>
                Visualización de la carga de trabajo por semana
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Fecha de inicio:</span>
              <input
                type="date"
                className="px-2 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                value={heatmapStartDate.toISOString().split('T')[0]}
                onChange={e => setHeatmapStartDate(e.target.value ? new Date(e.target.value) : new Date())}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResourceCapacityHeatmap
              resources={resources}
              assignments={assignments}
              tasks={allTasks}
              workingDaysPerWeek={currentProject?.config?.workingDays || [1, 2, 3, 4, 5]}
              holidays={combinedHolidays}
              startDate={heatmapStartDate}
              weekCount={12}
            />
          </CardContent>
        </Card>
      )}

      {/* Resource Form Dialog */}
      <ResourceFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        resource={selectedResource}
      />

      {/* Vacations Management Dialog */}
      <Dialog open={!!vacationsResource} onOpenChange={(open) => !open && setVacationsResource(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gestionar Vacaciones</DialogTitle>
            <DialogDescription>
              Planifica o elimina periodos de descanso para <span className="font-semibold text-foreground">{vacationsResource?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* List of current vacations */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vacaciones Registradas</h4>
              {vacationsResource?.calendar?.vacations && vacationsResource.calendar.vacations.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {vacationsResource.calendar.vacations.map((vac, idx) => {
                    const startStr = format(new Date(vac.start), 'dd MMM yyyy', { locale: es })
                    const endStr = format(new Date(vac.end), 'dd MMM yyyy', { locale: es })
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted text-xs">
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-sky-500" />
                          {startStr} - {endStr}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveVacationFromResource(vacationsResource.id, idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No hay vacaciones registradas.</p>
              )}
            </div>

            {/* Add new vacation form */}
            <div className="space-y-3 border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Añadir Nuevo Rango</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Desde</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs px-2"
                    value={newVacationStart}
                    onChange={e => setNewVacationStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hasta</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs px-2"
                    value={newVacationEnd}
                    onChange={e => setNewVacationEnd(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="w-full h-8 text-xs font-semibold mt-2"
                onClick={async () => {
                  if (!newVacationStart || !newVacationEnd) return
                  const start = new Date(newVacationStart)
                  const end = new Date(newVacationEnd)
                  if (start > end) {
                    alert('La fecha de inicio debe ser anterior a la de fin')
                    return
                  }
                  await handleAddVacationToResource(vacationsResource!.id, start, end)
                }}
              >
                Añadir Rango
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setVacationsResource(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

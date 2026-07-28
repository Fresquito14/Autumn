import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit, Trash2, Users, Search, CheckSquare, Square } from 'lucide-react'
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

export function ResourceManagement() {
  const { resources, isLoading, loadAllResources, deleteResource, deleteResources } = useResources()
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

              <div className="space-y-2">
                {filteredResources.map(resource => {
                  const isSelected = selectedResourceIds.has(resource.id)
                  return (
                    <div
                      key={resource.id}
                      className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Checkbox Button */}
                        <button
                          className="mt-1 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => toggleSelectResource(resource.id)}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-medium text-foreground">{resource.name}</h3>
                              {resource.email && (
                                <p className="text-sm text-muted-foreground truncate">{resource.email}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                            <span>{resource.maxHoursPerWeek}h/semana</span>
                            {resource.costPerHour && (
                              <span>{resource.costPerHour}€/hora</span>
                            )}
                            {resource.tags && resource.tags.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {resource.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditResource(resource)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteResource(resource.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
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
    </div>
  )
}

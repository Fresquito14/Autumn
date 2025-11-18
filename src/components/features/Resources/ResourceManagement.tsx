import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { ResourceCapacityHeatmap } from './ResourceCapacityHeatmap'
import { ResourceFormDialog } from './ResourceFormDialog'
import type { Resource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ResourceManagement() {
  const { resources, isLoading, loadAllResources, deleteResource } = useResources()
  const { assignments, loadAllAssignments } = useResourceAssignments()
  const { tasks } = useTasks()
  const { currentProject } = useProject()

  const [selectedResource, setSelectedResource] = useState<Resource | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [heatmapStartDate] = useState(new Date())

  // Load all resources and assignments on mount
  useEffect(() => {
    loadAllResources()
    loadAllAssignments()
  }, [loadAllResources, loadAllAssignments])

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
        <CardHeader>
          <CardTitle>Recursos Disponibles</CardTitle>
          <CardDescription>
            {resources.length} recurso{resources.length !== 1 ? 's' : ''} registrado{resources.length !== 1 ? 's' : ''}
          </CardDescription>
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
          ) : (
            <div className="space-y-2">
              {resources.map(resource => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium">{resource.name}</h3>
                        {resource.email && (
                          <p className="text-sm text-muted-foreground">{resource.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{resource.maxHoursPerWeek}h/semana</span>
                      {resource.costPerHour && (
                        <span>{resource.costPerHour}€/hora</span>
                      )}
                      {resource.tags && resource.tags.length > 0 && (
                        <div className="flex gap-1">
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

                  <div className="flex items-center gap-2">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Heatmap */}
      {resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapa de Capacidad</CardTitle>
            <CardDescription>
              Visualización de la carga de trabajo por semana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResourceCapacityHeatmap
              resources={resources}
              assignments={assignments}
              tasks={tasks}
              workingDaysPerWeek={currentProject?.config?.workingDays || [1, 2, 3, 4, 5]}
              holidays={currentProject?.config?.holidays || []}
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

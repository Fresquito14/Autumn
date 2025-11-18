import { useState, useEffect } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { useResources } from '@/hooks/useResources'
import { useResourceAssignments } from '@/hooks/useResourceAssignments'
import { useProject } from '@/hooks/useProject'
import type { Resource, TaskResourceAssignment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ResourceAssignmentSectionProps {
  taskId: string
  taskStart: Date
  taskEnd: Date
  workingDaysPerWeek: number[]
  onAssignmentsChange?: () => void
}

export function ResourceAssignmentSection({
  taskId,
  taskStart,
  taskEnd,
  workingDaysPerWeek,
  onAssignmentsChange
}: ResourceAssignmentSectionProps) {
  const { resources, loadAllResources } = useResources()
  const { currentProject } = useProject()
  const {
    assignments,
    loadTaskAssignments,
    createAssignment,
    deleteAssignment
  } = useResourceAssignments()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [plannedHours, setPlannedHours] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load resources and assignments
  useEffect(() => {
    loadAllResources()
    if (taskId) {
      loadTaskAssignments(taskId)
    }
  }, [taskId, loadAllResources, loadTaskAssignments])

  // Get available resources (not already assigned)
  const assignedResourceIds = assignments.map(a => a.resourceId)
  const availableResources = resources.filter(r => !assignedResourceIds.includes(r.id))

  const handleAddAssignment = async () => {
    if (!selectedResourceId || plannedHours <= 0) return

    setIsSubmitting(true)
    try {
      // Get the selected resource
      const resource = resources.find(r => r.id === selectedResourceId)
      const holidays = currentProject?.config?.holidays || []

      await createAssignment(
        {
          taskId,
          resourceId: selectedResourceId,
          plannedHours
        },
        taskStart,
        taskEnd,
        workingDaysPerWeek,
        resource,
        holidays
      )

      setIsAddDialogOpen(false)
      setSelectedResourceId('')
      setPlannedHours(0)
      onAssignmentsChange?.()
    } catch (error) {
      console.error('Error adding assignment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (confirm('¿Eliminar esta asignación de recurso?')) {
      await deleteAssignment(assignmentId)
      onAssignmentsChange?.()
    }
  }

  const getResourceById = (id: string): Resource | undefined => {
    return resources.find(r => r.id === id)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Recursos Asignados
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
          disabled={availableResources.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Asignar Recurso
        </Button>
      </div>

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
          No hay recursos asignados a esta tarea
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(assignment => {
            const resource = getResourceById(assignment.resourceId)
            if (!resource) return null

            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{resource.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {assignment.plannedHours}h planificadas
                    {assignment.actualHours !== undefined && (
                      <span className="ml-2">• {assignment.actualHours}h reales</span>
                    )}
                  </div>
                  {assignment.weeklyDistribution && assignment.weeklyDistribution.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Distribuido en {assignment.weeklyDistribution.length} semana
                      {assignment.weeklyDistribution.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteAssignment(assignment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Assignment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Recurso a Tarea</DialogTitle>
            <DialogDescription>
              Selecciona un recurso y especifica las horas planificadas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resource Selection */}
            <div className="space-y-2">
              <Label htmlFor="resource">Recurso</Label>
              <select
                id="resource"
                className="w-full px-3 py-2 border rounded-md"
                value={selectedResourceId}
                onChange={e => setSelectedResourceId(e.target.value)}
              >
                <option value="">Selecciona un recurso...</option>
                {availableResources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} ({resource.maxHoursPerWeek}h/semana)
                  </option>
                ))}
              </select>
            </div>

            {/* Planned Hours */}
            <div className="space-y-2">
              <Label htmlFor="hours">Horas Planificadas</Label>
              <Input
                id="hours"
                type="number"
                min="0.5"
                step="0.5"
                value={plannedHours || ''}
                onChange={e => setPlannedHours(parseFloat(e.target.value) || 0)}
                placeholder="Ej: 40"
              />
              <p className="text-xs text-muted-foreground">
                Las horas se distribuirán proporcionalmente entre las semanas que dura la tarea
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAddAssignment}
                disabled={!selectedResourceId || plannedHours <= 0 || isSubmitting}
              >
                {isSubmitting ? 'Asignando...' : 'Asignar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

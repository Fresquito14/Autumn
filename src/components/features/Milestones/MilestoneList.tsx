import { useEffect, useState } from 'react'
import { Flag, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MilestoneFormDialog } from './MilestoneFormDialog'
import { useMilestones } from '@/hooks/useMilestones'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Milestone } from '@/types'

export function MilestoneList() {
  const { milestones, loadMilestones, deleteMilestone, isLoading } = useMilestones()
  const { tasks } = useTasks()
  const { currentProject } = useProject()
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadMilestones(currentProject.id)
    }
  }, [currentProject, loadMilestones])

  const getTaskName = (taskId: string | undefined) => {
    if (!taskId) return null
    const task = tasks.find(t => t.id === taskId)
    return task ? `${task.wbsCode} - ${task.name}` : 'Tarea desconocida'
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este hito?')) {
      await deleteMilestone(id)
    }
  }

  const handleDoubleClick = (milestone: Milestone) => {
    setEditingMilestone(milestone)
    setIsEditDialogOpen(true)
  }

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false)
    setEditingMilestone(undefined)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando hitos...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Hitos del Proyecto</CardTitle>
            <CardDescription>
              {milestones.length} {milestones.length === 1 ? 'hito' : 'hitos'}
            </CardDescription>
          </div>
          <MilestoneFormDialog
            milestone={editingMilestone}
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) handleEditDialogClose()
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {milestones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">No hay hitos creados</p>
            <p className="text-xs">Los hitos marcan fechas clave en la línea temporal del proyecto</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
              <div className="flex-1">Nombre</div>
              <div className="w-24">Fecha</div>
              <div className="flex-1">Tarea vinculada</div>
              <div className="w-8" /> {/* Space for actions */}
            </div>

            {/* Milestones - scrollable container */}
            <div className="overflow-y-auto scrollbar-hide max-h-[40vh] space-y-1 p-2">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(milestone)}
                  title="Doble clic para editar"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <Flag className="h-3 w-3 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {milestone.name}
                      </p>
                      {milestone.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="w-24 flex-shrink-0">
                    <p className="text-xs font-mono">
                      {format(milestone.date, 'dd/MM/yy')}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {milestone.linkedTaskId ? (
                      <div>
                        <p className="text-xs text-muted-foreground truncate">
                          {getTaskName(milestone.linkedTaskId)}
                        </p>
                        {milestone.offsetDays !== undefined && milestone.offsetDays > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{milestone.offsetDays}d
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No vinculado
                      </p>
                    )}
                  </div>

                  <div className="w-8 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(milestone.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { useEffect, useState } from 'react'
import { Flag, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MilestoneFormDialog } from './MilestoneFormDialog'
import { useMilestones } from '@/hooks/useMilestones'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { Milestone } from '@/types'

interface MilestoneListProps {
  isCollapsible?: boolean
  defaultCollapsed?: boolean
}

export function MilestoneList({ isCollapsible = true, defaultCollapsed = false }: MilestoneListProps = {}) {
  const { milestones, loadMilestones, deleteMilestone, isLoading } = useMilestones()
  const { tasks } = useTasks()
  const { currentProject } = useProject()
  const { user } = useAuth()
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  const isReadOnly = Boolean(user && currentProject?.userId && currentProject.userId !== user.id)

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
    if (isReadOnly) return
    if (confirm('¿Eliminar este hito?')) {
      await deleteMilestone(id)
    }
  }

  const handleDoubleClick = (milestone: Milestone) => {
    if (isReadOnly) return
    setEditingMilestone(milestone)
    setIsEditDialogOpen(true)
  }

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false)
    setEditingMilestone(undefined)
  }

  if (isLoading && milestones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando hitos...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="transition-all duration-200">
      <CardHeader
        className={cn(
          "transition-colors",
          isCollapsible && "cursor-pointer select-none hover:bg-muted/30",
          isCollapsed && "pb-4"
        )}
        onClick={isCollapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Hitos</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {milestones.length}
                </span>
              </div>
              <CardDescription className="text-xs">
                {milestones.length === 1 ? '1 hito' : `${milestones.length} hitos`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {!isReadOnly && (
              <MilestoneFormDialog
                milestone={editingMilestone}
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                  setIsEditDialogOpen(open)
                  if (!open) handleEditDialogClose()
                }}
              />
            )}
            {isCollapsible && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCollapsed(!isCollapsed)
                }}
                title={isCollapsed ? 'Expandir hitos' : 'Colapsar hitos'}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
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
                  title={isReadOnly ? undefined : "Doble clic para editar"}
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
                    {!isReadOnly && (
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
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  )
}

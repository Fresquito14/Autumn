import { useEffect, useState } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DependencyDialog } from './DependencyDialog'
import { ScheduleRecalculateButton } from './ScheduleRecalculateButton'
import { useDependencies } from '@/hooks/useDependencies'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Dependency } from '@/types'

export function DependencyList() {
  const { dependencies, loadDependencies, deleteDependency, isLoading } = useDependencies()
  const { tasks } = useTasks()
  const { currentProject } = useProject()
  const [editingDependency, setEditingDependency] = useState<Dependency | undefined>(undefined)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadDependencies(currentProject.id)
    }
  }, [currentProject, loadDependencies])

  const getTaskName = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task ? `${task.wbsCode} - ${task.name}` : 'Desconocida'
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta dependencia?')) {
      await deleteDependency(id)
    }
  }

  const handleDoubleClick = (dep: Dependency) => {
    setEditingDependency(dep)
    setIsEditDialogOpen(true)
  }

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false)
    setEditingDependency(undefined)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando dependencias...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Dependencias del Proyecto</CardTitle>
            <CardDescription>
              {dependencies.length} {dependencies.length === 1 ? 'dependencia' : 'dependencias'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ScheduleRecalculateButton />
            <DependencyDialog
              dependency={editingDependency}
              open={isEditDialogOpen}
              onOpenChange={(open) => {
                setIsEditDialogOpen(open)
                if (!open) handleEditDialogClose()
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {dependencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">No hay dependencias creadas</p>
            <p className="text-xs">Las dependencias definen el orden en que deben ejecutarse las tareas</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
              <div className="flex-1">Predecesora</div>
              <div className="w-5 flex-shrink-0" />
              <div className="flex-1">Sucesora</div>
              <div className="w-16 text-center">Retraso</div>
              <div className="w-8" /> {/* Space for actions */}
            </div>

            {/* Dependencies - scrollable container */}
            <div className="overflow-y-auto scrollbar-hide max-h-[40vh] space-y-1 p-2">
              {dependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(dep)}
                  title="Doble clic para editar"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {getTaskName(dep.predecessorId)}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {getTaskName(dep.successorId)}
                    </p>
                  </div>
                  <div className="w-16 text-center flex-shrink-0">
                    <span className={dep.lag && dep.lag > 0 ? "text-xs font-medium" : "text-xs text-muted-foreground"}>
                      {dep.lag ? `+${dep.lag}d` : '0d'}
                    </span>
                  </div>
                  <div className="w-8 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(dep.id)
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

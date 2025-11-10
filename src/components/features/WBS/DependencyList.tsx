import { useEffect } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DependencyDialog } from './DependencyDialog'
import { useDependencies } from '@/hooks/useDependencies'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'

export function DependencyList() {
  const { dependencies, loadDependencies, deleteDependency, isLoading } = useDependencies()
  const { tasks } = useTasks()
  const { currentProject } = useProject()

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
            <CardTitle>Dependencias del Proyecto</CardTitle>
            <CardDescription>
              {dependencies.length} {dependencies.length === 1 ? 'dependencia' : 'dependencias'}
            </CardDescription>
          </div>
          <DependencyDialog />
        </div>
      </CardHeader>
      <CardContent>
        {dependencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">No hay dependencias creadas</p>
            <p className="text-sm">Las dependencias definen el orden en que deben ejecutarse las tareas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getTaskName(dep.predecessorId)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getTaskName(dep.successorId)}
                    </p>
                  </div>
                  {dep.lag !== undefined && dep.lag > 0 && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      +{dep.lag}d
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(dep.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

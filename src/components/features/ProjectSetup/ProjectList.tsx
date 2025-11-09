import { useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FolderOpen, Calendar, Trash2 } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ProjectList() {
  const { projects, loadProjects, setCurrentProject, deleteProject, isLoading } = useProject()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Cargando proyectos...</div>
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No hay proyectos</CardTitle>
          <CardDescription>
            Crea tu primer proyecto para comenzar a planificar
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setCurrentProject(project)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {project.name}
            </CardTitle>
            {project.description && (
              <CardDescription>{project.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Calendar className="h-4 w-4" />
              Inicio: {format(project.startDate, 'dd MMM yyyy', { locale: es })}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentProject(project)
                }}
              >
                Abrir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`¿Eliminar proyecto "${project.name}"?`)) {
                    deleteProject(project.id)
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

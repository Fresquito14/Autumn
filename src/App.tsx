import { ArrowLeft } from 'lucide-react'
import { useProject } from './hooks/useProject'
import { ProjectSetupDialog } from './components/features/ProjectSetup/ProjectSetupDialog'
import { ProjectList } from './components/features/ProjectSetup/ProjectList'
import { WBSTree } from './components/features/WBS/WBSTree'
import { Button } from './components/ui/button'

function App() {
  const { currentProject, setCurrentProject } = useProject()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍂</span>
              <h1 className="text-2xl font-bold text-primary">Autumn</h1>
              {currentProject && (
                <>
                  <span className="text-muted-foreground mx-2">/</span>
                  <span className="text-lg font-medium">{currentProject.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentProject && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentProject(null)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Proyectos
                </Button>
              )}
              <ProjectSetupDialog />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentProject ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Bienvenido a Autumn</h2>
              <p className="text-muted-foreground text-lg">
                Gestión profesional de proyectos con diagramas de Gantt
              </p>
            </div>
            <ProjectList />
          </div>
        ) : (
          <div className="space-y-6">
            <WBSTree />
          </div>
        )}
      </main>
    </div>
  )
}

export default App

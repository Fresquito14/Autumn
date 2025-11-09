import { useProject } from './hooks/useProject'
import { ProjectSetupDialog } from './components/features/ProjectSetup/ProjectSetupDialog'
import { ProjectList } from './components/features/ProjectSetup/ProjectList'

function App() {
  const { currentProject } = useProject()

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
            <ProjectSetupDialog />
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
          <div className="bg-card rounded-lg shadow-sm border p-8">
            <h2 className="text-xl font-semibold mb-4">
              Proyecto: {currentProject.name}
            </h2>
            <p className="text-muted-foreground">
              Vista de proyecto en desarrollo... (Fase 2)
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Trash2, Download, Upload, Users } from 'lucide-react'
import { Toaster } from 'sonner'
import { useProject } from './hooks/useProject'
import { useAutoRecalculate } from './hooks/useAutoRecalculate'
import { ProjectSetupDialog } from './components/features/ProjectSetup/ProjectSetupDialog'
import { ProjectList } from './components/features/ProjectSetup/ProjectList'
import { WBSTree } from './components/features/WBS/WBSTree'
import { DependencyList } from './components/features/WBS/DependencyList'
import { MilestoneList } from './components/features/Milestones/MilestoneList'
import { GanttChart } from './components/features/GanttChart/GanttChart'
import { ResourceManagement } from './components/features/Resources/ResourceManagement'
import { Button } from './components/ui/button'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { db, dbHelpers } from './lib/storage/db'
import { downloadProjectAsJSON, readProjectFile, importProject } from './lib/export/json'

type View = 'projects' | 'project' | 'resources'

function App() {
  const { currentProject, setCurrentProject } = useProject()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [currentView, setCurrentView] = useState<View>('projects')

  // Sync view with project state
  useEffect(() => {
    if (currentProject && currentView !== 'project') {
      setCurrentView('project')
    } else if (!currentProject && currentView === 'project') {
      setCurrentView('projects')
    }
  }, [currentProject, currentView])

  // Enable automatic reactive calculations
  useAutoRecalculate()

  const handleExport = async () => {
    if (!currentProject) return

    try {
      await downloadProjectAsJSON(currentProject.id)
      alert('✅ Proyecto exportado correctamente')
    } catch (error) {
      console.error('Error exporting project:', error)
      alert('❌ Error al exportar el proyecto: ' + (error as Error).message)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      // Read and parse file
      const data = await readProjectFile(file)

      // Confirm import
      const confirmed = confirm(
        `¿Importar proyecto "${data.project.name}"?\n\n` +
        `Tareas: ${data.tasks.length}\n` +
        `Dependencias: ${data.dependencies.length}\n` +
        `Hitos: ${data.milestones.length}\n` +
        `Recursos: ${data.resources.length}`
      )

      if (!confirmed) {
        setIsImporting(false)
        return
      }

      // Import project
      const projectId = await importProject(data)

      // Switch to imported project
      const importedProject = await db.projects.get(projectId)
      if (importedProject) {
        setCurrentProject(importedProject)
        alert('✅ Proyecto importado correctamente')
      }
    } catch (error) {
      console.error('Error importing project:', error)
      alert('❌ Error al importar el proyecto: ' + (error as Error).message)
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleResetDatabase = async () => {
    if (confirm('⚠️ ADVERTENCIA: Esto borrará TODOS los proyectos y datos. ¿Estás seguro?')) {
      if (confirm('Esta acción NO se puede deshacer. ¿Continuar?')) {
        try {
          await dbHelpers.clearAllData()
          setCurrentProject(null)
          window.location.reload()
        } catch (error) {
          console.error('Error al borrar la base de datos:', error)
          alert('Error al borrar los datos. Revisa la consola.')
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="bg-card shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍂</span>
              <h1 className="text-xl font-bold text-primary">Autumn</h1>
              {currentProject && (
                <>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-base font-medium">{currentProject.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentView === 'project' && currentProject ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    title="Exportar proyecto a JSON"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentProject(null)
                      setCurrentView('projects')
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Proyectos
                  </Button>
                </>
              ) : currentView === 'resources' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('projects')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Proyectos
                </Button>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportClick}
                    disabled={isImporting}
                    title="Importar proyecto desde JSON"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? 'Importando...' : 'Importar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentView('resources')}
                    title="Gestión de recursos globales"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Recursos
                  </Button>
                </>
              )}
              {currentView === 'projects' && <ProjectSetupDialog />}
              <ThemeToggle />
              {/* Development: Reset Database Button */}
              {import.meta.env.DEV && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetDatabase}
                  title="Borrar todos los datos (solo en desarrollo)"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {currentView === 'resources' ? (
          <ResourceManagement />
        ) : currentView === 'projects' ? (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Bienvenido a Autumn</h2>
              <p className="text-muted-foreground text-lg">
                Gestión profesional de proyectos con diagramas de Gantt
              </p>
            </div>
            <ProjectList />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Three column layout for WBS, Dependencies, and Milestones */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-[40%]">
                <WBSTree />
              </div>
              <div className="lg:w-[30%]">
                <DependencyList />
              </div>
              <div className="lg:w-[30%]">
                <MilestoneList />
              </div>
            </div>
            <GanttChart />
          </div>
        )}
      </main>
    </div>
  )
}

export default App

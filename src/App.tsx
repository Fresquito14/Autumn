import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Trash2,
  Download,
  Upload,
  Users,
  PartyPopper,
  Calendar,
  LogOut,
  Eye,
  Crown,
  ArrowRightLeft,
  HelpCircle,
} from 'lucide-react'
import { Toaster } from 'sonner'
import { useProject } from './hooks/useProject'
import { useAutoRecalculate } from './hooks/useAutoRecalculate'
import { useOrganization } from './hooks/useOrganization'
import { ProjectSetupDialog } from './components/features/ProjectSetup/ProjectSetupDialog'
import { ProjectList } from './components/features/ProjectSetup/ProjectList'
import { TransferProjectDialog } from './components/features/ProjectSetup/TransferProjectDialog'
import { ProjectStartDateDialog } from './components/features/ProjectSetup/ProjectStartDateDialog'
import { WBSTree } from './components/features/WBS/WBSTree'
import { DependencyList } from './components/features/WBS/DependencyList'
import { MilestoneList } from './components/features/Milestones/MilestoneList'
import { GanttChart } from './components/features/GanttChart/GanttChart'
import { ResourceManagement } from './components/features/Resources/ResourceManagement'
import { GlobalHolidaysManagement } from './components/features/GlobalHolidays/GlobalHolidaysManagement'
import { PortfolioTimeline } from './components/features/Portfolio/PortfolioTimeline'
import { OrganizationSwitcher } from './components/features/Organization/OrganizationSwitcher'
import { CreateOrganizationDialog } from './components/features/Organization/CreateOrganizationDialog'
import { WelcomeLanding } from './components/features/Welcome/WelcomeLanding'
import { PremiumPricingModal } from './components/features/Premium/PremiumPricingModal'
import { LoginModal } from './components/features/Auth/LoginModal'
import { Button } from './components/ui/button'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { db } from './lib/storage/db'
import { downloadProjectAsJSON, readProjectFile, importProject } from './lib/export/json'

// Supabase, Autosave, Realtime and Auth integration
import { useAuth } from './hooks/useAuth'
import { useAutosave } from './hooks/useAutosave'
import { useLiveProjectSync } from './hooks/useLiveProjectSync'
import { useTasks } from './hooks/useTasks'
import { useDependencies } from './hooks/useDependencies'
import { useMilestones } from './hooks/useMilestones'
import { supabaseSyncService } from './lib/supabase/db_service'
import { AutosaveStatusIndicator } from './components/features/Sync/AutosaveStatusIndicator'
import { ConflictResolutionModal } from './components/features/Sync/ConflictResolutionModal'
import { seedInitialPortfolioIfEmpty } from './lib/storage/seed'

type View = 'projects' | 'project' | 'resources' | 'holidays' | 'portfolio'

function App() {
  const { currentProject, setCurrentProject, updateProject } = useProject()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [currentView, setCurrentView] = useState<View>('projects')
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isLocalFreeMode, setIsLocalFreeMode] = useState(false)

  const { user, initializeAuth, logout } = useAuth()
  const { organizations, userRole, hasManagedOrganization, isLoading: isOrgLoading } = useOrganization()
  const { tasks, loadTasks } = useTasks()
  const { dependencies, loadDependencies } = useDependencies()
  const { milestones, loadMilestones } = useMilestones()

  const isOwner = Boolean(!currentProject?.userId || currentProject.userId === user?.id)
  const isProjectReadOnly = Boolean(
    user && currentProject && currentProject.userId && currentProject.userId !== user.id
  )

  // Auto-prompt mandatory onboarding if user is logged in but has no managed organization
  useEffect(() => {
    if (user && !isOrgLoading && !hasManagedOrganization && organizations.length > 0) {
      setIsOnboardingOpen(true)
    } else {
      setIsOnboardingOpen(false)
    }
  }, [user, isOrgLoading, hasManagedOrganization, organizations.length])

  // Initialize Supabase Authentication, seed portfolio dataset if empty & full database hydration
  useEffect(() => {
    const unsubscribe = initializeAuth()
    
    async function initApp() {
      const seeded = await seedInitialPortfolioIfEmpty()
      if (seeded) {
        useProject.getState().loadProjects()
      }
      supabaseSyncService.syncFullDatabaseFromCloud().catch(err => {
        console.warn('Initial cloud hydration skipped:', err)
      })
    }

    initApp()
    return unsubscribe
  }, [initializeAuth])

  // Sync view when currentProject is selected or cleared
  useEffect(() => {
    if (currentProject && currentView === 'projects') {
      setCurrentView('project')
    } else if (!currentProject && currentView === 'project') {
      setCurrentView('projects')
    }
  }, [currentProject])

  // Sync cloud project version when opening a project
  useEffect(() => {
    if (currentProject && user) {
      const projId = currentProject.id
      supabaseSyncService.loadProjectFromCloud(projId)
        .then(({ data: cloudData, version: cloudVersion }) => {
          const localVer = currentProject.version || 1
          if (cloudVersion > localVer && cloudData) {
            console.log(`Cloud version ${cloudVersion} is newer than local ${localVer}. Updating local DB...`)
            updateProject(projId, { version: cloudVersion }).then(() => {
              loadTasks(projId)
              loadDependencies(projId)
              loadMilestones(projId)
            })
          }
        })
        .catch(err => {
          console.warn('Could not check project version in cloud:', err)
        })
    }
  }, [currentProject?.id, user])

  // Enable automatic dependency-driven task rescheduling
  useAutoRecalculate()

  // Prepare autosave data payload
  const autosaveData = useMemo(() => {
    if (!currentProject) return null
    return {
      project: currentProject,
      tasks,
      dependencies,
      milestones,
    }
  }, [currentProject, tasks, dependencies, milestones])

  const currentVersion = currentProject?.version || 1

  // Hook up autosave engine (debounced 2.5s) - Strictly enabled only for Project Owners
  const {
    status: autosaveStatus,
    isConflictModalOpen,
    resolveConflict,
    triggerSave,
  } = useAutosave({
    projectId: currentProject?.id || '',
    data: autosaveData,
    version: currentVersion,
    enabled: isOwner && Boolean(user),
    onSave: async (dataToSave, ver) => {
      if (!dataToSave?.project) return { success: false, version: ver }
      const res = await supabaseSyncService.saveProjectToCloud(dataToSave.project.id, dataToSave as any, ver)
      return { success: true, version: res.version }
    },
    onLoadCloud: async () => {
      if (!currentProject) return { data: null as any, version: 1 }
      const res = await supabaseSyncService.loadProjectFromCloud(currentProject.id)
      return { data: res.data as any, version: res.version }
    },
    onLocalUpdate: (_cloudData, cloudVersion) => {
      if (currentProject) {
        updateProject(currentProject.id, { version: cloudVersion }).then(() => {
          loadTasks(currentProject.id)
          loadDependencies(currentProject.id)
          loadMilestones(currentProject.id)
        })
      }
    },
  })

  // Hook up Live Realtime & Window Focus Synchronization (especially for Read-Only viewers)
  useLiveProjectSync({
    projectId: currentProject?.id || null,
    isReadOnly: isProjectReadOnly,
    localVersion: currentVersion,
  })

  const handleExport = async () => {
    if (!currentProject) return
    try {
      await downloadProjectAsJSON(currentProject.id)
    } catch (error) {
      console.error('Failed to export project:', error)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const projectDataList = await readProjectFile(file)
      let lastId = ''
      for (const pData of projectDataList) {
        lastId = await importProject(pData)
      }
      await useProject.getState().loadProjects()
      if (lastId) {
        await useProject.getState().loadProject(lastId)
        setCurrentView('project')
      }
    } catch (error) {
      console.error('Failed to import project:', error)
      alert('Error al importar el archivo. Verifica que sea un JSON válido de Autumn.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleResetDatabase = async () => {
    if (!confirm('⚠️ ¿Estás seguro de que quieres borrar TODOS los datos locales? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      await db.delete()
      await db.open()
      window.location.reload()
    } catch (error) {
      console.error('Failed to reset database:', error)
      alert('Error al restablecer la base de datos')
    }
  }

  const canTransferCurrentProject = Boolean(
    user &&
    currentProject &&
    currentProject.userId === user.id &&
    currentProject.organizationId
  )

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Toaster position="top-right" richColors />

      {/* Top Navigation Header */}
      <header className="border-b bg-card shadow-xs sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left section: App Brand & View Navigation */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center gap-2">
                <h1
                  className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-amber-500 to-primary bg-clip-text text-transparent cursor-pointer"
                  onClick={() => {
                    if (user) {
                      setCurrentProject(null)
                      setCurrentView('projects')
                    } else {
                      setIsLocalFreeMode(false)
                    }
                  }}
                >
                  🍂 Autumn
                </h1>

                {/* Organization Switcher (when authenticated) */}
                {user && <OrganizationSwitcher />}
              </div>

              {/* In-Project Context Indicator */}
              {currentProject && currentView === 'project' && (
                <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-muted">
                  <span className="text-xs font-semibold text-foreground max-w-[180px] truncate">
                    {currentProject.name}
                  </span>
                  <ProjectStartDateDialog />
                  {isProjectReadOnly && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      title="Estás viendo este proyecto en modo Solo Lectura"
                    >
                      <Eye className="h-3 w-3" />
                      Solo Lectura
                    </span>
                  )}
                  {canTransferCurrentProject && (
                    <TransferProjectDialog
                      project={currentProject}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 px-2"
                          title="Traspasar propiedad del proyecto a otro gestor"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Traspasar
                        </Button>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* Right section: Action Buttons & Auth */}
            <div className="flex items-center space-x-2">
              {/* Navigation buttons when inside a project or subview */}
              {currentView === 'project' ? (
                <>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    title="Descargar proyecto como JSON"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </>
              ) : currentView === 'resources' || currentView === 'holidays' || currentView === 'portfolio' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('projects')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Proyectos
                </Button>
              ) : (
                /* Projects List view navigation */
                (user || isLocalFreeMode) && (
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
                      onClick={() => setCurrentView('portfolio')}
                      title="Timeline global de proyectos (Roadmap)"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Roadmap
                    </Button>
                    {(!user || userRole === 'manager' || userRole === 'admin') && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentView('resources')}
                          title="Gestión de recursos globales"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Recursos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentView('holidays')}
                          title="Gestión de festivos globales"
                        >
                          <PartyPopper className="h-4 w-4 mr-2" />
                          Festivos
                        </Button>
                      </>
                    )}
                  </>
                )
              )}

              {/* Sync Status Indicator */}
              {user && currentProject && (
                <AutosaveStatusIndicator
                  status={autosaveStatus}
                  lastSavedAt={null}
                  isReadOnly={isProjectReadOnly}
                  onRetry={() => autosaveData && triggerSave(autosaveData, currentVersion)}
                />
              )}

              {/* Authentication Actions */}
              {user ? (
                <div className="flex items-center gap-2 border-r pr-2 mr-1">
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    {user.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={async () => {
                      await logout()
                      setCurrentProject(null)
                      setCurrentView('projects')
                      setIsLocalFreeMode(false)
                    }}
                    title="Cerrar sesión"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isLocalFreeMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLocalFreeMode(false)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="h-3.5 w-3.5 mr-1" />
                      Conoce Autumn
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPricingOpen(true)}
                    className="h-8 text-xs font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
                  >
                    <Crown className="h-3.5 w-3.5 mr-1 text-amber-500" />
                    Pásate a Premium
                  </Button>
                  <LoginModal />
                </div>
              )}

              {/* New Project Setup Button */}
              {currentView === 'projects' && (user || isLocalFreeMode) && (
                <ProjectSetupDialog />
              )}

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

      {/* Main Content Area */}
      <main className="px-4 py-4">
        {!user && !isLocalFreeMode ? (
          <WelcomeLanding onStartFree={() => setIsLocalFreeMode(true)} />
        ) : currentView === 'holidays' ? (
          <GlobalHolidaysManagement />
        ) : currentView === 'resources' ? (
          <ResourceManagement />
        ) : currentView === 'portfolio' ? (
          <PortfolioTimeline 
            onOpenProject={(project) => {
              setCurrentProject(project)
              setCurrentView('project')
            }} 
          />
        ) : currentView === 'projects' ? (
          <div className="max-w-7xl mx-auto space-y-6">
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

      {/* UI Blocker Overlay */}
      {isImporting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg border max-w-sm w-full mx-4 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Importando proyecto...</h3>
              <p className="text-sm text-muted-foreground">
                Procesando tareas, dependencias e hitos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal for Cloud Sync (Strictly ONLY for Project Owners) */}
      {currentProject && isOwner && (
        <ConflictResolutionModal
          isOpen={isConflictModalOpen}
          projectId={currentProject.id}
          onResolve={resolveConflict}
          onExportBackup={handleExport}
        />
      )}

      {/* Premium Pricing Modal */}
      <PremiumPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />

      {/* Mandatory Onboarding for managers without organization */}
      {user && isOnboardingOpen && (
        <CreateOrganizationDialog
          open={isOnboardingOpen}
          onOpenChange={setIsOnboardingOpen}
          isMandatoryOnboarding={true}
        />
      )}
    </div>
  )
}

export default App

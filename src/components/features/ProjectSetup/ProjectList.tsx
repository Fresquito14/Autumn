import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FolderOpen,
  Calendar,
  CalendarCheck,
  Trash2,
  Database,
  Crown,
  Building2,
  Eye,
  ArrowRightLeft,
  UserCheck,
  RefreshCw,
  CloudDownload,
} from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { forceSeedPortfolioDataset } from '@/lib/storage/seed'
import { supabaseSyncService } from '@/infrastructure/supabase/db_service'
import { PremiumPricingModal } from '../Premium/PremiumPricingModal'
import { TransferProjectDialog } from './TransferProjectDialog'
import { calculateBusinessDays } from '@/lib/calculations/dates'
import { db } from '@/lib/storage/db'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ProjectMetric {
  startDate: Date | null
  endDate: Date | null
  deviationDays: number
}

export function ProjectList() {
  const { projects, loadProjects, setCurrentProject, deleteProject, isLoading } = useProject()
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  const [projectMetrics, setProjectMetrics] = useState<Record<string, ProjectMetric>>({})
  const [onlyMyProjects, setOnlyMyProjects] = useState(false)
  const hasAutoSyncedRef = useRef(false)

  // Initial local load
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Cloud sync handler
  const handleSyncFromCloud = async (isQuiet = false) => {
    if (!user) return
    try {
      setIsSyncing(true)
      const synced = await supabaseSyncService.fetchAllProjectsFromCloud()
      await loadProjects()
      if (!isQuiet) {
        if (synced && synced.length > 0) {
          toast.success(`¡${synced.length} proyectos sincronizados desde la base de datos!`)
        } else {
          toast.info('No se encontraron proyectos en la base de datos para tu cuenta u organización.')
        }
      }
    } catch (err: any) {
      console.error('Error al sincronizar proyectos de la base de datos:', err)
      if (!isQuiet) {
        toast.error(`Error al conectar con la base de datos: ${err.message || 'Error de conexión'}`)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // Auto-sync from cloud on login/mount when authenticated
  useEffect(() => {
    if (user && !hasAutoSyncedRef.current) {
      hasAutoSyncedRef.current = true
      handleSyncFromCloud(true)
    }
  }, [user])

  // Compute end dates and schedule deviations for all projects
  useEffect(() => {
    async function loadMetrics() {
      try {
        const allTasks = await db.tasks.toArray()
        const metrics: Record<string, ProjectMetric> = {}

        projects.forEach(project => {
          const tasks = allTasks.filter(t => t.projectId === project.id)
          const workingDays = project.config?.workingDays || [1, 2, 3, 4, 5]

          if (tasks.length === 0) {
            const startDate = project.startDate ? new Date(project.startDate) : null
            metrics[project.id] = {
              startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
              endDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
              deviationDays: 0,
            }
            return
          }

          // Compute planned start and end
          const startDates = tasks.map(t => new Date(t.startDate).getTime()).filter(t => !isNaN(t))
          const endDates = tasks.map(t => new Date(t.endDate).getTime()).filter(t => !isNaN(t))

          const minStart = startDates.length > 0
            ? new Date(Math.min(...startDates))
            : (project.startDate ? new Date(project.startDate) : null)
          const maxEnd = endDates.length > 0
            ? new Date(Math.max(...endDates))
            : minStart

          // Compute deviation (difference between actual and planned duration)
          let deviation = 0
          const leafTasks = tasks.filter(t => !tasks.some(child => child.parentId === t.id))
          let hasActualData = false

          leafTasks.forEach(t => {
            if (t.actualDuration !== undefined && t.actualDuration !== null) {
              hasActualData = true
              deviation += (t.actualDuration - t.duration)
            }
          })

          // If no actual duration recorded but project is overdue and unfinished
          if (!hasActualData && maxEnd) {
            const today = new Date()
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
            const endDay = new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate())
            if (todayStart > endDay) {
              const diffBusinessDays = calculateBusinessDays(endDay, todayStart, workingDays) - 1
              if (diffBusinessDays > 0) {
                deviation = diffBusinessDays
              }
            }
          }

          metrics[project.id] = {
            startDate: minStart,
            endDate: maxEnd,
            deviationDays: deviation,
          }
        })

        setProjectMetrics(metrics)
      } catch (err) {
        console.warn('Error loading project metrics:', err)
      }
    }

    if (projects.length > 0) {
      loadMetrics()
    }
  }, [projects])

  // Demo seed handler (only in local offline/free mode)
  const handleForceLoad = async () => {
    try {
      setIsSyncing(true)
      await forceSeedPortfolioDataset()
      await loadProjects()
      toast.success('¡Proyectos de ejemplo cargados con éxito!')
    } catch (err) {
      toast.error('Error al cargar proyectos de ejemplo')
      console.error(err)
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading && projects.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Cargando proyectos...</div>
  }

  // Filter projects by ownership if toggle is active
  const displayedProjects = projects.filter(project => {
    if (!onlyMyProjects || !user) return true
    return !project.userId || project.userId === user.id
  })

  // Empty state
  if (projects.length === 0) {
    return (
      <Card className="max-w-xl mx-auto my-8 border-dashed">
        <CardHeader className="text-center pb-2">
          {user ? (
            <CloudDownload className="h-12 w-12 mx-auto mb-2 text-primary opacity-80" />
          ) : (
            <Database className="h-12 w-12 mx-auto mb-2 text-primary opacity-80" />
          )}
          <CardTitle className="text-xl">
            {user ? 'Sincronización de Base de Datos' : 'No hay proyectos cargados'}
          </CardTitle>
          <CardDescription className="mt-2 text-sm">
            {user
              ? 'Haz clic a continuación para descargar y sincronizar todos los proyectos de tu organización y proyectos propios desde Supabase.'
              : 'Haz clic a continuación para cargar proyectos de ejemplo con tareas, dependencias e hitos para probar la herramienta en local.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          {user ? (
            <Button
              onClick={() => handleSyncFromCloud(false)}
              disabled={isSyncing}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2 gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Sincronizando...' : 'Cargar Proyectos de la Base de Datos'}
            </Button>
          ) : (
            <Button
              onClick={handleForceLoad}
              disabled={isSyncing}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2 gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              {isSyncing ? 'Cargando...' : 'Cargar Proyectos de Ejemplo'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Free Tier Local Mode Banner */}
      {!user && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-muted border border-amber-500/20 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">
                Versión Gratuita Local: {projects.length}/3 proyectos utilizados
              </span>
              <p className="text-muted-foreground">
                Almacenamiento privado en navegador sin conexión a base de datos.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPricingOpen(true)}
            className="h-7 text-xs font-semibold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          >
            <Crown className="h-3.5 w-3.5 mr-1" />
            Pásate a Premium
          </Button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {user && currentOrganization ? (
              <Building2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            )}
            <h2 className="font-bold text-lg text-foreground">
              {user && currentOrganization
                ? `Proyectos de ${currentOrganization.name} (${displayedProjects.length})`
                : `Proyectos Disponibles (${displayedProjects.length})`}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {user && currentOrganization
              ? 'Espacio corporativo compartido. Haz clic en cualquier proyecto para abrirlo.'
              : 'Haz clic en cualquier proyecto para abrirlo y gestionar su cronograma.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Toggle: Solo mis proyectos */}
          {user && (
            <Button
              variant={onlyMyProjects ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOnlyMyProjects(prev => !prev)}
              className={cn(
                'gap-1.5 text-xs font-semibold shrink-0 transition-all',
                onlyMyProjects
                  ? 'bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30 hover:bg-muted'
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              {onlyMyProjects ? 'Mis proyectos (Owner)' : 'Solo mis proyectos'}
            </Button>
          )}

          {/* Cloud Sync Button (Premium/Logged In) or Seed Button (Local) */}
          {user ? (
            <Button
              onClick={() => handleSyncFromCloud(false)}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 hover:bg-primary/10 text-xs font-semibold shrink-0"
              title="Sincronizar y recargar proyectos de la base de datos"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-primary', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Base de Datos'}
            </Button>
          ) : (
            <Button
              onClick={handleForceLoad}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 hover:bg-primary/10 text-xs font-semibold shrink-0"
            >
              <Database className="h-3.5 w-3.5 text-primary" />
              Cargar Proyectos de Ejemplo
            </Button>
          )}
        </div>
      </div>

      {/* Projects Grid or Empty Filter state */}
      {displayedProjects.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            No tienes proyectos propios (como creador/owner) en esta organización.
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setOnlyMyProjects(false)}
            className="mt-2 text-xs text-primary"
          >
            Ver todos los proyectos compartidos
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedProjects.map((project) => {
            const isOwner = !project.userId || project.userId === user?.id
            const isReadOnlyProject = user && project.userId && project.userId !== user.id
            const canTransfer = isOwner && user && project.organizationId
            const metric = projectMetrics[project.id]
            const deviation = metric?.deviationDays ?? 0

            return (
              <Card
                key={project.id}
                onClick={() => setCurrentProject(project)}
                className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border bg-card hover:border-primary/50 flex flex-col justify-between"
              >
                {/* Shimmer reflection sweep on hover */}
                <div className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-primary/10 dark:via-white/10 to-transparent skew-x-12 z-10" />

                <CardHeader className="pb-3 relative z-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base font-bold group-hover:text-primary transition-colors leading-tight">
                      <FolderOpen className="h-4.5 w-4.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="truncate">{project.name}</span>
                    </CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isReadOnlyProject && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          title="Proyecto compartido en modo solo lectura"
                        >
                          <Eye className="h-3 w-3" />
                          Lectura
                        </span>
                      )}
                    </div>
                  </div>
                  {project.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-1.5 leading-relaxed">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0 relative z-0">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs text-muted-foreground pt-3 border-t">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {/* Start Date */}
                      <div className="flex items-center gap-1" title="Fecha de inicio del proyecto">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                          <span className="font-medium text-foreground/80 mr-1">Inicio:</span>
                          {(() => {
                            const d = metric?.startDate || (project.startDate ? new Date(project.startDate) : null)
                            return d && !isNaN(d.getTime())
                              ? format(d, 'dd MMM yy', { locale: es })
                              : 'Sin fecha'
                          })()}
                        </span>
                      </div>

                      {/* End Date - directly to the right of Start Date */}
                      <div className="flex items-center gap-1" title="Fecha de fin planificada">
                        <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                          <span className="font-medium text-foreground/80 mr-1">Fin:</span>
                          {(() => {
                            const d = metric?.endDate
                            return d && !isNaN(d.getTime())
                              ? format(d, 'dd MMM yy', { locale: es })
                              : 'Sin fecha'
                          })()}
                        </span>
                      </div>

                      {/* Schedule Deviation (Desvío en días) */}
                      <div
                        className="flex items-center gap-1"
                        title="Desvío en días respecto a la duración planificada"
                      >
                        <span className="font-medium text-foreground/80">Desvío:</span>
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold',
                            deviation > 0
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold'
                              : deviation < 0
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground font-normal'
                          )}
                        >
                          {deviation > 0 ? `+${deviation}d` : `${deviation}d`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                      {/* Transfer ownership button */}
                      {canTransfer && (
                        <TransferProjectDialog
                          project={project}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                              title="Traspasar propiedad del proyecto"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}

                      {/* Delete button: only for owner/manager, stops propagation */}
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Eliminar proyecto"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`¿Eliminar proyecto "${project.name}"?`)) {
                              deleteProject(project.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PremiumPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />
    </div>
  )
}

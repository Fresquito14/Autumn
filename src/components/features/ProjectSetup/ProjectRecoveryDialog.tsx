import { useState, useEffect } from 'react'
import {
  Wrench,
  FolderOpen,
  ArrowRight,
  Sparkles,
  Trash2,
  Save,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { db } from '@/lib/storage/db'
import { useProject } from '@/hooks/useProject'
import { useTasks } from '@/hooks/useTasks'
import type { Project, Task } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TARGET_PROJECT_NAMES = [
  'Test Recursos',
  'Budget - Planning - Resourcing Internal Solution',
]

export function ProjectRecoveryDialog() {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { loadProjects, setCurrentProject } = useProject()

  // Load all local data when dialog opens
  const loadData = async () => {
    setIsLoading(true)
    try {
      let dbProjects = await db.projects.toArray()
      const dbTasks = await db.tasks.toArray()

      // Ensure the 2 target projects exist in local DB
      const targetProjectsMap = new Map<string, Project>()
      dbProjects.forEach((p) => {
        const matchedTarget = TARGET_PROJECT_NAMES.find(
          (name) => name.toLowerCase() === p.name.toLowerCase().trim()
        )
        if (matchedTarget) {
          targetProjectsMap.set(matchedTarget, p)
        }
      })

      // Create target projects if missing
      const newProjectsToCreate: Project[] = []
      for (const targetName of TARGET_PROJECT_NAMES) {
        if (!targetProjectsMap.has(targetName)) {
          const newProj: Project = {
            id: crypto.randomUUID(),
            name: targetName,
            description: `Proyecto ${targetName} recuperado`,
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            config: {
              workingDays: [1, 2, 3, 4, 5],
              hoursPerDay: 8,
              useGlobalHolidays: true,
              excludedGlobalHolidayIds: [],
              projectSpecificHolidays: [],
              skipHolidaysInScheduling: true,
              defaultDuration: 5,
            },
          }
          await db.projects.put(newProj)
          newProjectsToCreate.push(newProj)
          targetProjectsMap.set(targetName, newProj)
        }
      }

      if (newProjectsToCreate.length > 0) {
        dbProjects = await db.projects.toArray()
      }

      setProjects(dbProjects)
      setTasks(dbTasks)

      // Initial task assignment mapping
      const initialMap: Record<string, string> = {}
      const testRecursosProj = targetProjectsMap.get('Test Recursos')
      const budgetProj = targetProjectsMap.get('Budget - Planning - Resourcing Internal Solution')

      dbTasks.forEach((t) => {
        if (t.projectId) {
          initialMap[t.id] = t.projectId
        } else if (testRecursosProj) {
          initialMap[t.id] = testRecursosProj.id
        }
      })

      // Smart auto-suggestion based on task name keywords
      dbTasks.forEach((t) => {
        const lower = (t.name || '').toLowerCase()
        if (
          lower.includes('recurso') ||
          lower.includes('resource') ||
          lower.includes('test') ||
          lower.includes('asign')
        ) {
          if (testRecursosProj) initialMap[t.id] = testRecursosProj.id
        } else if (
          lower.includes('budget') ||
          lower.includes('planning') ||
          lower.includes('internal') ||
          lower.includes('presupuesto') ||
          lower.includes('solution') ||
          lower.includes('desarrollo') ||
          lower.includes('pipeline') ||
          lower.includes('api') ||
          lower.includes('erp')
        ) {
          if (budgetProj) initialMap[t.id] = budgetProj.id
        }
      })

      setTaskAssignments(initialMap)
    } catch (err) {
      console.error('Error loading recovery data:', err)
      toast.error('Error al inspeccionar la base de datos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const targetProjects = projects.filter((p) =>
    TARGET_PROJECT_NAMES.some((name) => name.toLowerCase() === p.name.toLowerCase().trim())
  )

  const otherProjects = projects.filter(
    (p) => !TARGET_PROJECT_NAMES.some((name) => name.toLowerCase() === p.name.toLowerCase().trim())
  )

  const handleAssignTask = (taskId: string, projectId: string) => {
    setTaskAssignments((prev) => ({
      ...prev,
      [taskId]: projectId,
    }))
  }

  const handleAssignAllTasksTo = (projectId: string) => {
    setTaskAssignments((prev) => {
      const next = { ...prev }
      tasks.forEach((t) => {
        next[t.id] = projectId
      })
      return next
    })
    toast.info('Todas las tareas asignadas al proyecto seleccionado')
  }

  // Delete unwanted demo projects
  const handleDeleteOtherProject = async (projectId: string) => {
    try {
      await db.projects.delete(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      toast.success('Proyecto eliminado')
    } catch (err) {
      console.error(err)
      toast.error('Error al eliminar proyecto')
    }
  }

  // Apply recovery and fix all database task associations
  const handleApplyRecovery = async () => {
    setIsSaving(true)
    try {
      // 1. Update task associations in Dexie
      for (const task of tasks) {
        const assignedProjId = taskAssignments[task.id]
        if (assignedProjId) {
          await db.tasks.update(task.id, {
            projectId: assignedProjId,
            updatedAt: new Date(),
          })
        }
      }

      // 2. Refresh project dependencies associations
      const allDeps = await db.dependencies.toArray()
      for (const dep of allDeps) {
        const succTask = tasks.find((t) => t.id === dep.successorId)
        const newProjId = succTask ? taskAssignments[succTask.id] : null
        if (newProjId && dep.projectId !== newProjId) {
          await db.dependencies.update(dep.id, {
            projectId: newProjId,
          })
        }
      }

      // 3. Refresh project milestones associations
      const allMilestones = await db.milestones.toArray()
      for (const m of allMilestones) {
        if (m.linkedTaskId) {
          const linked = tasks.find((t) => t.id === m.linkedTaskId)
          const newProjId = linked ? taskAssignments[linked.id] : null
          if (newProjId && m.projectId !== newProjId) {
            await db.milestones.update(m.id, {
              projectId: newProjId,
            })
          }
        }
      }

      // 4. Reload Zustand stores
      await loadProjects()
      const updatedProjects = await db.projects.toArray()
      const firstTarget = updatedProjects.find((p) =>
        TARGET_PROJECT_NAMES.some((name) => name.toLowerCase() === p.name.toLowerCase().trim())
      )
      if (firstTarget) {
        setCurrentProject(firstTarget)
        await useTasks.getState().loadTasks(firstTarget.id)
      }

      toast.success('¡Base de datos y proyectos restaurados con éxito!')
      setOpen(false)
    } catch (err) {
      console.error('Error applying recovery:', err)
      toast.error('Error al guardar la recuperación')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-medium text-xs shadow-xs"
        >
          <Wrench className="h-3.5 w-3.5 text-amber-500" />
          <span>Recuperar Mis Proyectos</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Wrench className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">
              Asistente de Recuperación y Reorganización de Proyectos
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Reasocia tus tareas locales a tus proyectos <strong>Test Recursos</strong> y{' '}
            <strong>Budget - Planning - Resourcing Internal Solution</strong>, y elimina cualquier proyecto no deseado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Inspeccionando tareas y proyectos en tu base de datos local...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Target Projects status cards */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tus 2 Proyectos Principales
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {targetProjects.map((proj) => {
                  const assignedCount = Object.values(taskAssignments).filter(
                    (id) => id === proj.id
                  ).length

                  return (
                    <Card key={proj.id} className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-semibold text-xs text-foreground truncate">
                              {proj.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            {assignedCount} tareas asignadas
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px] px-2.5 shrink-0 gap-1"
                          onClick={() => handleAssignAllTasksTo(proj.id)}
                          title="Asignar todas las tareas a este proyecto"
                        >
                          <Sparkles className="h-3 w-3 text-primary" />
                          Asignar todas
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Other unwanted projects to clean up */}
            {otherProjects.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Otros proyectos descargados ({otherProjects.length})
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Puedes eliminarlos si no te pertenecen
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {otherProjects.map((p) => (
                    <Badge
                      key={p.id}
                      variant="outline"
                      className="text-xs py-1 px-2.5 gap-2 bg-muted/30"
                    >
                      <span className="truncate max-w-[180px]">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteOtherProject(p.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                        title="Eliminar este proyecto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Task re-association table */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Listado de Tareas Locales ({tasks.length} tareas encontradas)
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Elige a qué proyecto pertenece cada tarea
                </span>
              </div>

              {tasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  No hay tareas registradas en IndexedDB.
                </div>
              ) : (
                <div className="border rounded-md divide-y max-h-[320px] overflow-y-auto bg-card">
                  {tasks.map((task) => {
                    const currentAssignedProjId = taskAssignments[task.id] || ''

                    return (
                      <div
                        key={task.id}
                        className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="font-mono text-muted-foreground text-[11px] shrink-0">
                            {task.wbsCode || '—'}
                          </span>
                          <span className="font-medium text-foreground truncate" title={task.name}>
                            {task.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            ({task.duration}d)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                          <select
                            value={currentAssignedProjId}
                            onChange={(e) => handleAssignTask(task.id, e.target.value)}
                            className={cn(
                              'h-7 rounded-md border text-xs px-2 py-0.5 bg-background shadow-xs font-medium cursor-pointer max-w-[240px]',
                              currentAssignedProjId === targetProjects[0]?.id
                                ? 'border-primary/50 text-primary'
                                : currentAssignedProjId === targetProjects[1]?.id
                                ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'border-input text-foreground'
                            )}
                          >
                            <option value="" disabled>
                              Selecciona proyecto...
                            </option>
                            {targetProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                📁 {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex sm:justify-between items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            size="sm"
            onClick={handleApplyRecovery}
            disabled={isSaving || tasks.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 px-4"
          >
            {isSaving ? (
              'Guardando recuperación...'
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Aplicar y Restaurar Base de Datos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

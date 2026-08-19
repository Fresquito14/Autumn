import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { CheckSquare, Link2, Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TaskChecklist } from './TaskChecklist'
import { ResourceAssignmentSection } from '@/components/features/Resources/ResourceAssignmentSection'
import { useTasks } from '@/hooks/useTasks'
import { useDependencies } from '@/hooks/useDependencies'
import { useProject } from '@/hooks/useProject'
import { generateWbsCode, getWbsLevel } from '@/lib/calculations/wbs'
import { addBusinessDays, isWorkingDay } from '@/lib/calculations/dates'
import type { Task, ChecklistItem } from '@/types'
import { addDays } from 'date-fns'

interface TaskFormData {
  name: string
  description: string
  duration: number
  startDate: string
  predecessorId: string
  lag: number
  actualLag?: number
}

interface TaskFormDialogProps {
  task?: Task
  parentTask?: Task
  onSuccess?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TaskFormDialog({ task, parentTask, onSuccess, trigger, open: controlledOpen, onOpenChange }: TaskFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist || [])
  const { createTask, updateTask, tasks } = useTasks()
  const { dependencies, createDependency, updateDependency } = useDependencies()
  const { currentProject } = useProject()

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const isEditing = !!task
  const isCreatingChild = !!parentTask
  const isLeafTask = task ? !tasks.some(t => t.parentId === task.id) : !isCreatingChild

  // Incoming dependencies for the task being edited
  const incomingDependencies = isEditing && task
    ? dependencies.filter(d => d.successorId === task.id)
    : []

  // Local state for editing incoming dependency lags
  const [dependencyLags, setDependencyLags] = useState<Record<string, { lag: number; actualLag?: number }>>({})

  const hasActual = Boolean(task?.actualDuration !== undefined && task?.actualDuration !== null)
  const [isCompleted, setIsCompleted] = useState<boolean>(hasActual)
  const [actualDuration, setActualDuration] = useState<number>(task?.actualDuration || task?.duration || 1)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      name: task?.name || '',
      description: task?.description || '',
      duration: task?.duration || 1,
      startDate: task?.startDate
        ? new Date(task.startDate).toISOString().split('T')[0]
        : currentProject?.startDate
        ? new Date(currentProject.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      predecessorId: '',
      lag: 0,
      actualLag: undefined,
    }
  })

  const predecessorId = watch('predecessorId')
  const plannedDuration = watch('duration') || 1

  useEffect(() => {
    if (task) {
      reset({
        name: task.name,
        description: task.description || '',
        duration: task.duration,
        startDate: new Date(task.startDate).toISOString().split('T')[0],
        predecessorId: '',
        lag: 0,
        actualLag: undefined,
      })
      setChecklist(task.checklist || [])
      const hasActualData = task.actualDuration !== undefined && task.actualDuration !== null
      setIsCompleted(hasActualData)
      const actDur = hasActualData ? task.actualDuration! : task.duration
      setActualDuration(actDur)

      // Initialize dependency lags
      const incoming = dependencies.filter(d => d.successorId === task.id)
      const initialLags: Record<string, { lag: number; actualLag?: number }> = {}
      incoming.forEach(dep => {
        initialLags[dep.id] = {
          lag: dep.lag || 0,
          actualLag: dep.actualLag,
        }
      })
      setDependencyLags(initialLags)
    }
  }, [task, dependencies, reset])

  // Checklist handlers
  const handleAddChecklistItem = (text: string) => {
    const newItem: ChecklistItem = {
      id: `checklist-${Date.now()}-${Math.random()}`,
      text,
      completed: false
    }
    setChecklist([...checklist, newItem])
  }

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklist(checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ))
  }

  const handleDeleteChecklistItem = (itemId: string) => {
    setChecklist(checklist.filter(item => item.id !== itemId))
  }

  const handleUpdateChecklistItem = (itemId: string, text: string) => {
    setChecklist(checklist.map(item =>
      item.id === itemId ? { ...item, text } : item
    ))
  }

  // Predecessor date calculation for new task creation
  useEffect(() => {
    if (predecessorId && !isEditing) {
      const predecessor = tasks.find((t) => t.id === predecessorId)
      if (predecessor && currentProject) {
        const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]
        const lagDays = watch('lag') || 0
        const calculatedStartDate = addBusinessDays(
          new Date(predecessor.endDate),
          lagDays + 1,
          workingDays
        )
        setValue('startDate', calculatedStartDate.toISOString().split('T')[0])
      }
    }
  }, [predecessorId, watch('lag'), tasks, isEditing, currentProject, setValue, watch])

  const onSubmit = async (data: TaskFormData) => {
    if (!currentProject) return

    let startDate = new Date(data.startDate)
    const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]

    // Move start date to next working day if it falls on weekend
    let safetyCounter = 0
    while (!isWorkingDay(startDate, workingDays) && safetyCounter < 7) {
      startDate = addDays(startDate, 1)
      safetyCounter++
    }

    // Calculate planned end date using business days
    const endDate = addBusinessDays(startDate, data.duration - 1, workingDays)

    // Update incoming dependencies if their lags were modified
    if (isEditing && incomingDependencies.length > 0) {
      for (const dep of incomingDependencies) {
        const currentLagState = dependencyLags[dep.id]
        if (currentLagState) {
          if (currentLagState.lag !== dep.lag || currentLagState.actualLag !== dep.actualLag) {
            await updateDependency(dep.id, {
              lag: currentLagState.lag,
              actualLag: currentLagState.actualLag,
            })
          }
        }
      }
    }

    // Determine actualStartDate based on predecessors + actualLag
    let actualStartDate: Date | undefined = undefined
    let actualEndDate: Date | undefined = undefined
    let finalActualDuration: number | undefined = undefined

    const relevantDeps = isEditing && task
      ? incomingDependencies
      : []

    if (relevantDeps.length > 0) {
      let earliestActualStart: Date | null = null

      relevantDeps.forEach(dep => {
        const pred = tasks.find(t => t.id === dep.predecessorId)
        if (pred) {
          const predEnd = pred.actualEndDate || pred.endDate
          const lagToUse = dependencyLags[dep.id]?.actualLag !== undefined
            ? dependencyLags[dep.id]?.actualLag!
            : (dependencyLags[dep.id]?.lag ?? dep.lag ?? 0)

          const predCalculatedStart = addBusinessDays(new Date(predEnd), lagToUse + 1, workingDays)
          if (!earliestActualStart || predCalculatedStart.getTime() > earliestActualStart.getTime()) {
            earliestActualStart = predCalculatedStart
          }
        }
      })

      if (earliestActualStart) {
        actualStartDate = earliestActualStart
      }
    } else {
      actualStartDate = task?.actualStartDate || startDate
    }

    if (isCompleted && isLeafTask) {
      finalActualDuration = actualDuration
      const start = actualStartDate || startDate
      actualEndDate = addBusinessDays(start, finalActualDuration - 1, workingDays)
    } else if (actualStartDate) {
      actualEndDate = addBusinessDays(actualStartDate, data.duration - 1, workingDays)
    }

    if (isEditing && task) {
      // Update existing task
      await updateTask(task.id, {
        name: data.name,
        description: data.description,
        duration: data.duration,
        startDate,
        endDate,
        checklist,
        actualDuration: isCompleted ? finalActualDuration : undefined,
        actualStartDate,
        actualEndDate: isCompleted ? actualEndDate : undefined,
      })
    } else {
      // Create new task
      const parentId = parentTask?.id
      const parentWbsCode = parentTask?.wbsCode

      // Count siblings to generate WBS code
      const siblings = tasks.filter((t) =>
        t.parentId === parentId && t.projectId === currentProject.id
      )

      const wbsCode = generateWbsCode(parentWbsCode, siblings.length)
      const level = getWbsLevel(wbsCode)

      const parsedActualLag = typeof data.actualLag === 'number' && !isNaN(data.actualLag)
        ? data.actualLag
        : undefined

      const newTask = await createTask({
        projectId: currentProject.id,
        name: data.name,
        description: data.description,
        wbsCode,
        parentId,
        level,
        duration: data.duration,
        startDate,
        endDate,
        assignedTo: [],
        checklist,
        actualDuration: isCompleted ? finalActualDuration : undefined,
        actualStartDate,
        actualEndDate: isCompleted ? actualEndDate : undefined,
      })

      // Create dependency if predecessor is selected
      if (data.predecessorId && newTask) {
        try {
          await createDependency({
            projectId: currentProject.id,
            predecessorId: data.predecessorId,
            successorId: newTask.id,
            type: 'FS',
            lag: data.lag || 0,
            actualLag: parsedActualLag,
          })
        } catch (err) {
          console.error('Error al crear la dependencia:', err)
        }
      }
    }

    setOpen(false)
    reset()
    onSuccess?.()
  }

  // Filter tasks to show only valid predecessors (exclude children, self, and parent tasks)
  const availablePredecessors = tasks.filter((t) => {
    if (task && t.id === task.id) return false
    const isParent = tasks.some(child => child.parentId === t.id)
    if (isParent) return false
    return true
  })

  const defaultTrigger = isCreatingChild ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 hover:text-primary hover:bg-primary/10"
      title={`Añadir subtarea a ${parentTask?.wbsCode}`}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  ) : !isEditing ? (
    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs">
      <Plus className="h-4 w-4" />
      Nueva Tarea
    </Button>
  ) : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(trigger || defaultTrigger) && (
        <DialogTrigger asChild onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {isEditing
                ? `Editar Tarea ${task?.wbsCode || ''}`
                : isCreatingChild
                ? `Nueva Subtarea de ${parentTask?.wbsCode}`
                : 'Nueva Tarea'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los detalles, dependencias, retraso real o avance de la tarea'
                : isCreatingChild
                ? `Creando subtarea bajo ${parentTask?.wbsCode} - ${parentTask?.name}`
                : 'Crea una nueva tarea en tu proyecto'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Task Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre de la Tarea <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Diseño de arquitectura"
                {...register('name', { required: 'El nombre es requerido' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción breve de la tarea"
                {...register('description')}
              />
            </div>

            {/* Duration & Start Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="duration">
                  Duración Planificada (días) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  {...register('duration', {
                    required: 'La duración es requerida',
                    min: { value: 1, message: 'Mínimo 1 día' },
                    valueAsNumber: true,
                  })}
                />
                {errors.duration && (
                  <p className="text-sm text-destructive">{errors.duration.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startDate">
                  Fecha de Inicio Planificada <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate', { required: 'La fecha es requerida' })}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">{errors.startDate.message}</p>
                )}
              </div>
            </div>

            {/* Predecessor Dependencies & Actual Start Delay (When Editing) */}
            {isEditing && incomingDependencies.length > 0 && (
              <div className="border rounded-xl p-3.5 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-xs text-foreground">
                    Dependencias de Inicio (Predecesoras y Retraso Real)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Controla el desfase planificado y el retraso real con el que se inicia la tarea respecto al fin de cada predecesora.
                </p>

                {incomingDependencies.map(dep => {
                  const pred = tasks.find(t => t.id === dep.predecessorId)
                  const lagState = dependencyLags[dep.id] || { lag: dep.lag || 0, actualLag: dep.actualLag }

                  return (
                    <div key={dep.id} className="p-2.5 rounded-lg border bg-card/60 space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>{pred ? `${pred.wbsCode} - ${pred.name}` : 'Predecesora'}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">Tipo: Finish-to-Start (FS)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1">
                          <Label className="text-[11px] text-muted-foreground">Retraso Planificado (días)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={lagState.lag}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0
                              setDependencyLags(prev => ({
                                ...prev,
                                [dep.id]: { ...prev[dep.id], lag: val }
                              }))
                            }}
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[11px] text-muted-foreground font-semibold text-primary">
                            Retraso Real de Inicio (días)
                          </Label>
                          <Input
                            type="number"
                            placeholder="Ej: 2 (retraso), -1 (adelanto)"
                            value={lagState.actualLag !== undefined ? lagState.actualLag : ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              const val = raw === '' ? undefined : parseInt(raw, 10)
                              setDependencyLags(prev => ({
                                ...prev,
                                [dep.id]: { ...prev[dep.id], actualLag: val }
                              }))
                            }}
                          />
                        </div>
                      </div>

                      {lagState.actualLag !== undefined && (
                        <p className="text-[11px] text-foreground/80 font-medium bg-muted/40 px-2 py-1 rounded">
                          {lagState.actualLag > (lagState.lag || 0) ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              ⚠️ Inicio retrasado en +{lagState.actualLag - (lagState.lag || 0)}d respecto al desfase planificado
                            </span>
                          ) : lagState.actualLag < (lagState.lag || 0) ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ✨ Inicio adelantado en {Math.abs(lagState.actualLag - (lagState.lag || 0))}d respecto al plan
                            </span>
                          ) : (
                            <span>✅ Iniciada exactamente con el desfase planificado ({lagState.actualLag}d)</span>
                          )}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Predecessors (Only on creation) */}
            {!isEditing && availablePredecessors.length > 0 && (
              <div className="grid gap-3 border rounded-xl p-3.5 bg-muted/20">
                <div className="grid gap-2">
                  <Label htmlFor="predecessorId">Tarea Predecesora (Opcional)</Label>
                  <select
                    id="predecessorId"
                    {...register('predecessorId')}
                    className="w-full flex h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sin predecesora</option>
                    {availablePredecessors.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.wbsCode} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {predecessorId && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="grid gap-1.5">
                      <Label htmlFor="lag" className="text-xs font-medium">Retraso Planificado (días)</Label>
                      <Input
                        id="lag"
                        type="number"
                        min="0"
                        placeholder="0"
                        {...register('lag', { valueAsNumber: true })}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="actualLag" className="text-xs font-medium">Retraso Real de Inicio (días)</Label>
                      <Input
                        id="actualLag"
                        type="number"
                        placeholder="Opcional"
                        {...register('actualLag', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actual Progress / Completion Section (for leaf tasks) */}
            {isLeafTask && (
              <div className="grid gap-3 border rounded-xl p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <label htmlFor="isCompleted" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="isCompleted"
                      checked={isCompleted}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setIsCompleted(checked)
                        if (checked && (!actualDuration || actualDuration === 0)) {
                          setActualDuration(plannedDuration)
                        }
                      }}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="font-semibold text-xs text-foreground">
                      Marcar tarea como completada (100% Avance)
                    </span>
                  </label>
                  {isCompleted && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      100% Completada
                    </span>
                  )}
                </div>

                {isCompleted && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="grid gap-1.5">
                      <Label htmlFor="actualDuration" className="text-xs font-medium">
                        Duración Real (días laborables)
                      </Label>
                      <Input
                        id="actualDuration"
                        type="number"
                        min="1"
                        value={actualDuration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1
                          setActualDuration(val)
                        }}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium">Desvío de Ejecución</Label>
                      <div className="flex items-center text-xs h-9 px-3 rounded-md border bg-card font-semibold">
                        {actualDuration - plannedDuration > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            +{actualDuration - plannedDuration}d ejecución
                          </span>
                        ) : actualDuration - plannedDuration < 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {actualDuration - plannedDuration}d ejecución
                          </span>
                        ) : (
                          <span className="text-foreground/80 font-normal">
                            Duración exacta ({actualDuration}d)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checklist - only for leaf tasks */}
            {isLeafTask && (
              <TaskChecklist
                checklist={checklist}
                onAddItem={handleAddChecklistItem}
                onToggleItem={handleToggleChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                onUpdateItem={handleUpdateChecklistItem}
                hasActualDuration={isCompleted}
              />
            )}

            {/* Resource Assignment - only for editing existing leaf tasks */}
            {isEditing && isLeafTask && task && currentProject && (
              <ResourceAssignmentSection
                taskId={task.id}
                taskStart={task.actualStartDate || new Date(watch('startDate'))}
                taskEnd={task.actualEndDate || addBusinessDays(
                  new Date(watch('startDate')),
                  watch('duration') - 1,
                  currentProject.config?.workingDays || [1, 2, 3, 4, 5]
                )}
                workingDaysPerWeek={currentProject.config?.workingDays || [1, 2, 3, 4, 5]}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing ? 'Guardar Cambios' : 'Crear Tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

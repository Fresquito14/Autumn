import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link2, AlertCircle } from 'lucide-react'
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
import { useDependencies } from '@/hooks/useDependencies'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Task, Dependency } from '@/types'

interface DependencyFormData {
  predecessorId: string
  successorId: string
  lag: number
  actualLag?: number
}

interface DependencyDialogProps {
  task?: Task
  dependency?: Dependency
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DependencyDialog({ task, dependency, open: controlledOpen, onOpenChange }: DependencyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createDependency, updateDependency, validateDependency } = useDependencies()
  const { tasks } = useTasks()
  const { currentProject } = useProject()

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const isEditing = !!dependency

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<DependencyFormData>({
    defaultValues: {
      predecessorId: dependency?.predecessorId || '',
      successorId: dependency?.successorId || task?.id || '',
      lag: dependency?.lag || 0,
      actualLag: dependency?.actualLag,
    }
  })

  // Reset form when dependency changes
  useEffect(() => {
    if (dependency) {
      reset({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        lag: dependency.lag || 0,
        actualLag: dependency.actualLag,
      })
    }
  }, [dependency, reset])

  const successorId = watch('successorId')
  const predecessorId = watch('predecessorId')

  const onSubmit = async (data: DependencyFormData) => {
    if (!currentProject) return
    setError(null)

    // Check if tasks are parent tasks (have children)
    const predecessorHasChildren = tasks.some(t => t.parentId === data.predecessorId)
    const successorHasChildren = tasks.some(t => t.parentId === data.successorId)

    if (predecessorHasChildren || successorHasChildren) {
      const taskType = predecessorHasChildren && successorHasChildren ? 'ambas tareas son' :
                       predecessorHasChildren ? 'la tarea predecesora es' : 'la tarea sucesora es'
      setError(`No se pueden crear dependencias en tareas padre: ${taskType} una tarea padre. Por favor, crea la dependencia en las subtareas de nivel más bajo.`)
      return
    }

    // Validate dependency (skip validation if editing and tasks haven't changed)
    const tasksChanged = isEditing && (dependency!.predecessorId !== data.predecessorId || dependency!.successorId !== data.successorId)
    if (!isEditing || tasksChanged) {
      const isValid = validateDependency(data.predecessorId, data.successorId)

      if (!isValid) {
        setError('Esta dependencia crearía un ciclo circular. No es posible crear una dependencia donde una tarea depende indirectamente de sí misma.')
        return
      }

      if (data.predecessorId === data.successorId) {
        setError('Una tarea no puede depender de sí misma')
        return
      }
    }

    try {
      const parsedActualLag = typeof data.actualLag === 'number' && !isNaN(data.actualLag) ? data.actualLag : undefined

      if (isEditing) {
        await updateDependency(dependency!.id, {
          predecessorId: data.predecessorId,
          successorId: data.successorId,
          lag: data.lag,
          actualLag: parsedActualLag,
        })
      } else {
        await createDependency({
          projectId: currentProject.id,
          predecessorId: data.predecessorId,
          successorId: data.successorId,
          type: 'FS',
          lag: data.lag,
          actualLag: parsedActualLag,
        })
      }

      setOpen(false)
      reset()
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Helper function to check if a task is a parent (has children)
  const isParentTask = (taskId: string) => {
    return tasks.some(t => t.parentId === taskId)
  }

  // Filter tasks to show only valid options (exclude parent tasks and self)
  const availablePredecessors = tasks.filter(t =>
    !isParentTask(t.id) && (task ? t.id !== task.id : t.id !== successorId)
  )

  const availableSuccessors = tasks.filter(t =>
    !isParentTask(t.id) && (task ? t.id === task.id : t.id !== predecessorId)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4 mr-2" />
          {task ? 'Agregar Dependencia' : 'Nueva Dependencia'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {isEditing ? 'Editar Dependencia' : 'Crear Dependencia'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isEditing
                    ? 'Modifica los detalles de la dependencia y sus retrasos'
                    : 'Define que una tarea debe completarse antes de que otra pueda iniciar (Finish-to-Start)'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="predecessorId">
                Tarea Predecesora (debe terminar primero) <span className="text-destructive">*</span>
              </Label>
              <select
                id="predecessorId"
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...register('predecessorId', { required: 'Selecciona una tarea predecesora' })}
              >
                <option value="">Selecciona una tarea...</option>
                {availablePredecessors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.wbsCode} - {t.name}
                  </option>
                ))}
              </select>
              {errors.predecessorId && (
                <p className="text-sm text-destructive">{errors.predecessorId.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="successorId">
                Tarea Sucesora (iniciará después) <span className="text-destructive">*</span>
              </Label>
              <select
                id="successorId"
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...register('successorId', { required: 'Selecciona una tarea sucesora' })}
                disabled={!!task}
              >
                <option value="">Selecciona una tarea...</option>
                {availableSuccessors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.wbsCode} - {t.name}
                  </option>
                ))}
              </select>
              {errors.successorId && (
                <p className="text-sm text-destructive">{errors.successorId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lag" className="text-xs font-medium">
                  Retraso Planificado (días)
                </Label>
                <Input
                  id="lag"
                  type="number"
                  min="0"
                  {...register('lag', { valueAsNumber: true, min: 0 })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="actualLag" className="text-xs font-medium">
                  Retraso Real (días)
                </Label>
                <Input
                  id="actualLag"
                  type="number"
                  min="0"
                  placeholder="Opcional"
                  {...register('actualLag', { valueAsNumber: true, min: 0 })}
                />
              </div>
            </div>

            <div className="bg-muted/40 border p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-foreground">Tipo de Dependencia: Finish-to-Start (FS)</p>
              <p className="text-muted-foreground">
                La tarea sucesora inicia tras finalizar la predecesora + los días de retraso o desfase definidos.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false)
                reset()
                setError(null)
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="text-xs font-semibold px-4">
              {isEditing ? 'Guardar Cambios' : 'Crear Dependencia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

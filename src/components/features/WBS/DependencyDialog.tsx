import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { useDependencies } from '@/hooks/useDependencies'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Task } from '@/types'

interface DependencyFormData {
  predecessorId: string
  successorId: string
  lag: number
}

interface DependencyDialogProps {
  task?: Task
}

export function DependencyDialog({ task }: DependencyDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createDependency, validateDependency } = useDependencies()
  const { tasks } = useTasks()
  const { currentProject } = useProject()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<DependencyFormData>({
    defaultValues: {
      predecessorId: '',
      successorId: task?.id || '',
      lag: 0,
    }
  })

  const successorId = watch('successorId')
  const predecessorId = watch('predecessorId')

  const onSubmit = async (data: DependencyFormData) => {
    if (!currentProject) return
    setError(null)

    // Validate dependency
    const isValid = validateDependency(data.predecessorId, data.successorId)

    if (!isValid) {
      setError('Esta dependencia crearía un ciclo circular. No es posible crear una dependencia donde una tarea depende indirectamente de sí misma.')
      return
    }

    if (data.predecessorId === data.successorId) {
      setError('Una tarea no puede depender de sí misma')
      return
    }

    try {
      await createDependency({
        projectId: currentProject.id,
        predecessorId: data.predecessorId,
        successorId: data.successorId,
        type: 'FS',
        lag: data.lag,
      })

      setOpen(false)
      reset()
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Filter tasks to show only valid options
  const availablePredecessors = tasks.filter(t =>
    task ? t.id !== task.id : t.id !== successorId
  )

  const availableSuccessors = tasks.filter(t =>
    task ? t.id === task.id : t.id !== predecessorId
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Crear Dependencia
            </DialogTitle>
            <DialogDescription>
              Define que una tarea debe completarse antes de que otra pueda iniciar (Finish-to-Start)
            </DialogDescription>
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="grid gap-2">
              <Label htmlFor="lag">
                Retraso (días)
              </Label>
              <input
                id="lag"
                type="number"
                min="0"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...register('lag', { valueAsNumber: true, min: 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Días de espera adicionales después de terminar la tarea predecesora
              </p>
            </div>

            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-1">Tipo de Dependencia:</p>
              <p className="text-muted-foreground">
                <strong>Finish-to-Start (FS)</strong>: La tarea sucesora solo puede comenzar cuando la predecesora termine
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                reset()
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Crear Dependencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

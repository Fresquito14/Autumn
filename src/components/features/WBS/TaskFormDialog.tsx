import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Edit, CheckSquare } from 'lucide-react'
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
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { generateWbsCode, getWbsLevel } from '@/lib/calculations/wbs'
import type { Task } from '@/types'
import { addDays } from 'date-fns'

interface TaskFormData {
  name: string
  description: string
  duration: number
  startDate: string
}

interface TaskFormDialogProps {
  task?: Task
  parentTask?: Task
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function TaskFormDialog({ task, parentTask, onSuccess, trigger }: TaskFormDialogProps) {
  const [open, setOpen] = useState(false)
  const { createTask, updateTask, tasks } = useTasks()
  const { currentProject } = useProject()

  const isEditing = !!task
  const isCreatingChild = !!parentTask

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      name: task?.name || '',
      description: task?.description || '',
      duration: task?.duration || 1,
      startDate: task?.startDate
        ? new Date(task.startDate).toISOString().split('T')[0]
        : currentProject?.startDate
        ? new Date(currentProject.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    }
  })

  useEffect(() => {
    if (task) {
      reset({
        name: task.name,
        description: task.description || '',
        duration: task.duration,
        startDate: new Date(task.startDate).toISOString().split('T')[0],
      })
    }
  }, [task, reset])

  const onSubmit = async (data: TaskFormData) => {
    if (!currentProject) return

    const startDate = new Date(data.startDate)
    const endDate = addDays(startDate, data.duration - 1)

    if (isEditing && task) {
      // Update existing task
      await updateTask(task.id, {
        name: data.name,
        description: data.description,
        duration: data.duration,
        startDate,
        endDate,
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

      await createTask({
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
        checklist: [],
      })
    }

    setOpen(false)
    reset()
    onSuccess?.()
  }

  const defaultTrigger = (
    <Button variant={isEditing ? 'ghost' : 'default'} size={isEditing ? 'sm' : 'default'}>
      {isEditing ? (
        <Edit className="h-4 w-4" />
      ) : isCreatingChild ? (
        <>
          <Plus className="h-4 w-4 mr-2" />
          Subtarea
        </>
      ) : (
        <>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </>
      )}
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {isEditing ? 'Editar Tarea' : isCreatingChild ? 'Nueva Subtarea' : 'Nueva Tarea'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los detalles de la tarea'
                : isCreatingChild
                ? `Crear una subtarea bajo "${parentTask?.name}"`
                : 'Crea una nueva tarea en tu proyecto'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción breve de la tarea"
                {...register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">
                  Fecha de Inicio <span className="text-destructive">*</span>
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

              <div className="grid gap-2">
                <Label htmlFor="duration">
                  Duración (días) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  {...register('duration', {
                    valueAsNumber: true,
                    required: 'La duración es requerida',
                    min: { value: 1, message: 'Mínimo 1 día' },
                  })}
                />
                {errors.duration && (
                  <p className="text-sm text-destructive">{errors.duration.message}</p>
                )}
              </div>
            </div>

            {parentTask && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-medium">Tarea Padre:</p>
                <p className="text-muted-foreground">
                  {parentTask.wbsCode} - {parentTask.name}
                </p>
              </div>
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

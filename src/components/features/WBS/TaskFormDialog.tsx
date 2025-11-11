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
import { TaskChecklist } from './TaskChecklist'
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
  const { createDependency, validateDependency } = useDependencies()
  const { currentProject } = useProject()

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const isEditing = !!task
  const isCreatingChild = !!parentTask

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
    }
  })

  const predecessorId = watch('predecessorId')

  useEffect(() => {
    if (task) {
      reset({
        name: task.name,
        description: task.description || '',
        duration: task.duration,
        startDate: new Date(task.startDate).toISOString().split('T')[0],
      })
      setChecklist(task.checklist || [])
    }
  }, [task, reset])

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

  // Check if task is a leaf task
  const isLeafTask = task ? !tasks.some(t => t.parentId === task.id) : !isCreatingChild

  const onSubmit = async (data: TaskFormData) => {
    if (!currentProject) return

    // Ensure start date is a working day
    let startDate = new Date(data.startDate)
    const workingDays = currentProject.config?.workingDays || [1, 2, 3, 4, 5]

    // Move start date to next working day if it falls on weekend
    let safetyCounter = 0
    while (!isWorkingDay(startDate, workingDays) && safetyCounter < 7) {
      startDate = addDays(startDate, 1)
      safetyCounter++
    }

    // Calculate end date using business days
    const endDate = addBusinessDays(startDate, data.duration - 1, workingDays)

    if (isEditing && task) {
      // Update existing task
      await updateTask(task.id, {
        name: data.name,
        description: data.description,
        duration: data.duration,
        startDate,
        endDate,
        checklist,
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
          })
        } catch (err) {
          console.error('Error al crear la dependencia:', err)
        }
      }
    }

    setOpen(false)
    reset()
    setChecklist([])
    onSuccess?.()
  }

  // Filter available predecessors (exclude parent tasks)
  const isParentTask = (taskId: string) => {
    return tasks.some(t => t.parentId === taskId)
  }

  const availablePredecessors = tasks.filter(t =>
    !isParentTask(t.id) && t.projectId === currentProject?.id
  )

  const defaultTrigger = (
    <Button variant={isEditing ? 'ghost' : 'default'} size={isEditing ? 'sm' : 'default'}>
      {isEditing ? (
        <Edit className="h-4 w-4" />
      ) : isCreatingChild ? (
        <Plus className="h-4 w-4" />
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

            {/* Checklist - only for leaf tasks */}
            {isLeafTask && (
              <TaskChecklist
                checklist={checklist}
                onAddItem={handleAddChecklistItem}
                onToggleItem={handleToggleChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                onUpdateItem={handleUpdateChecklistItem}
                hasActualDuration={false}
              />
            )}

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

            {!isEditing && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="predecessorId">Predecesor (opcional)</Label>
                  <select
                    id="predecessorId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...register('predecessorId')}
                  >
                    <option value="">Sin predecesor</option>
                    {availablePredecessors.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.wbsCode} - {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Esta tarea iniciará después de que termine la tarea predecesora
                  </p>
                </div>

                {predecessorId && (
                  <div className="grid gap-2">
                    <Label htmlFor="lag">Retraso (días)</Label>
                    <Input
                      id="lag"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register('lag', { valueAsNumber: true, min: 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Días de espera adicionales después de terminar el predecesor
                    </p>
                  </div>
                )}
              </>
            )}

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

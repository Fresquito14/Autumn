import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Flag, Plus } from 'lucide-react'
import { format } from 'date-fns'
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
import { useMilestones } from '@/hooks/useMilestones'
import { useTasks } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import type { Milestone, Task } from '@/types'
import { addBusinessDays } from '@/lib/calculations/dates'

interface MilestoneFormData {
  name: string
  date: string // Date input as string
  description?: string
  linkedTaskId?: string
  offsetDays?: number
}

interface MilestoneFormDialogProps {
  milestone?: Milestone
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MilestoneFormDialog({
  milestone,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: MilestoneFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const { createMilestone, updateMilestone } = useMilestones()
  const { tasks } = useTasks()
  const { currentProject } = useProject()

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const isEditing = !!milestone

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<MilestoneFormData>({
    defaultValues: {
      name: milestone?.name || '',
      date: milestone?.date ? format(milestone.date, 'yyyy-MM-dd') : '',
      description: milestone?.description || '',
      linkedTaskId: milestone?.linkedTaskId || '',
      offsetDays: milestone?.offsetDays || 0,
    }
  })

  const linkedTaskId = watch('linkedTaskId')
  const offsetDays = watch('offsetDays')

  // Reset form when milestone changes
  useEffect(() => {
    if (milestone) {
      reset({
        name: milestone.name,
        date: format(milestone.date, 'yyyy-MM-dd'),
        description: milestone.description || '',
        linkedTaskId: milestone.linkedTaskId || '',
        offsetDays: milestone.offsetDays || 0,
      })
    }
  }, [milestone, reset])

  // Auto-calculate date when task or offset changes
  useEffect(() => {
    if (linkedTaskId && linkedTaskId !== '') {
      const task = tasks.find(t => t.id === linkedTaskId)
      if (task) {
        const offset = offsetDays || 0
        const workingDays = currentProject?.config.workingDays || [1, 2, 3, 4, 5]
        const calculatedDate = addBusinessDays(task.endDate, offset, workingDays)
        setValue('date', format(calculatedDate, 'yyyy-MM-dd'))
      }
    }
  }, [linkedTaskId, offsetDays, tasks, currentProject, setValue])

  const onSubmit = async (data: MilestoneFormData) => {
    if (!currentProject) return

    const milestoneData = {
      projectId: currentProject.id,
      name: data.name,
      date: new Date(data.date),
      description: data.description || undefined,
      linkedTaskId: data.linkedTaskId || undefined,
      offsetDays: data.offsetDays || undefined,
    }

    try {
      if (isEditing) {
        await updateMilestone(milestone.id, milestoneData)
      } else {
        await createMilestone(milestoneData)
      }

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error saving milestone:', error)
    }
  }

  // Get leaf tasks only (tasks without children)
  const leafTasks = tasks.filter(task => {
    return !tasks.some(t => t.parentId === task.id)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Hito
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              {isEditing ? 'Editar Hito' : 'Crear Hito'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los detalles del hito'
                : 'Los hitos marcan fechas clave del proyecto'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Entrega final, Revisión de calidad"
                {...register('name', { required: 'El nombre es obligatorio' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Linked Task (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="linkedTaskId">
                Tarea vinculada (opcional)
              </Label>
              <select
                id="linkedTaskId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('linkedTaskId')}
              >
                <option value="">Sin vincular</option>
                {leafTasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.wbsCode} - {task.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Si vinculas una tarea, el hito se calculará automáticamente
              </p>
            </div>

            {/* Offset Days (only if linked) */}
            {linkedTaskId && linkedTaskId !== '' && (
              <div className="grid gap-2">
                <Label htmlFor="offsetDays">
                  Días después de la tarea
                </Label>
                <Input
                  id="offsetDays"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register('offsetDays', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Días laborables después del fin de la tarea
                </p>
              </div>
            )}

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="date">
                Fecha {linkedTaskId && linkedTaskId !== '' ? '(calculada automáticamente)' : <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="date"
                type="date"
                disabled={linkedTaskId && linkedTaskId !== ''}
                {...register('date', { required: 'La fecha es obligatoria' })}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <textarea
                id="description"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe el hito..."
                {...register('description')}
              />
            </div>
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
              {isEditing ? 'Guardar Cambios' : 'Crear Hito'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { CheckCircle2 } from 'lucide-react'
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
import { useDependencies } from '@/hooks/useDependencies'
import { useProject } from '@/hooks/useProject'
import { addBusinessDays } from '@/lib/calculations/dates'
import { TaskChecklist } from './TaskChecklist'
import type { Task, ChecklistItem } from '@/types'

interface ActualProgressFormData {
  actualDuration: number
}

interface ActualProgressDialogProps {
  task: Task
  trigger?: React.ReactNode
}

export function ActualProgressDialog({ task, trigger }: ActualProgressDialogProps) {
  const [open, setOpen] = useState(false)
  const { tasks, updateTask, getTask } = useTasks()
  const { dependencies } = useDependencies()
  const { currentProject } = useProject()

  // Get fresh task data from store
  const currentTask = getTask(task.id) || task

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ActualProgressFormData>({
    defaultValues: {
      actualDuration: currentTask.actualDuration || currentTask.duration,
    }
  })

  // Update form default value when currentTask changes
  useEffect(() => {
    if (currentTask.actualDuration) {
      setValue('actualDuration', currentTask.actualDuration)
    }
  }, [currentTask.actualDuration, setValue])

  // Check if task is a leaf task (no children)
  const isLeafTask = !tasks.some(t => t.parentId === currentTask.id)

  // Checklist handlers
  const handleAddChecklistItem = async (text: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const newItem: ChecklistItem = {
      id: `checklist-${Date.now()}-${Math.random()}`,
      text,
      completed: false
    }
    const updatedChecklist = [...(freshTask.checklist || []), newItem]
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleToggleChecklistItem = async (itemId: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleDeleteChecklistItem = async (itemId: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).filter(item => item.id !== itemId)
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleUpdateChecklistItem = async (itemId: string, text: string) => {
    const freshTask = getTask(task.id)
    if (!freshTask) return

    const updatedChecklist = (freshTask.checklist || []).map(item =>
      item.id === itemId ? { ...item, text } : item
    )
    await updateTask(task.id, { checklist: updatedChecklist })
  }

  const handleAllChecklistCompleted = () => {
    // Auto-focus on actual duration field
    const durationInput = document.getElementById('actualDuration')
    if (durationInput) {
      setTimeout(() => {
        durationInput.focus()
      }, 100)
    }
  }

  const onSubmit = async (data: ActualProgressFormData) => {
    try {
      // Calculate actual dates based on actualDuration
      const workingDays = currentProject?.config?.workingDays || [1, 2, 3, 4, 5]

      // Find predecessor dependencies
      const predecessors = dependencies.filter(dep => dep.successorId === task.id)

      // Determine actualStartDate
      let actualStartDate: Date

      if (predecessors.length === 0) {
        // No predecessors - use planned start date or existing actualStartDate
        actualStartDate = task.actualStartDate || task.startDate
      } else {
        // Has predecessors - use the latest predecessor's actualEndDate
        let latestPredecessorEnd: Date | null = null

        predecessors.forEach(dep => {
          const predecessor = tasks.find(t => t.id === dep.predecessorId)
          if (!predecessor) return

          // Use predecessor's actualEndDate if available, otherwise fall back to planned endDate
          const predecessorEnd = predecessor.actualEndDate || predecessor.endDate

          if (!latestPredecessorEnd || predecessorEnd > latestPredecessorEnd) {
            latestPredecessorEnd = predecessorEnd
          }
        })

        if (latestPredecessorEnd) {
          // Start the day after predecessor ends
          actualStartDate = new Date(latestPredecessorEnd)
          actualStartDate.setDate(actualStartDate.getDate() + 1)
        } else {
          // Fallback to planned start date
          actualStartDate = task.actualStartDate || task.startDate
        }
      }

      // Calculate actualEndDate from actualStartDate + actualDuration
      const actualEndDate = addBusinessDays(actualStartDate, data.actualDuration - 1, workingDays)

      await updateTask(task.id, {
        actualDuration: data.actualDuration,
        actualStartDate,
        actualEndDate,
      })

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error updating actual progress:', error)
      alert('❌ Error al actualizar el avance real')
    }
  }

  const handleClear = async () => {
    try {
      await updateTask(task.id, {
        actualDuration: undefined,
        actualStartDate: undefined,
        actualEndDate: undefined,
      })

      setOpen(false)
      reset()
    } catch (error) {
      console.error('Error clearing actual progress:', error)
    }
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Registrar avance real">
      <CheckCircle2 className="h-3 w-3" />
    </Button>
  )

  const variance = currentTask.actualDuration ? currentTask.actualDuration - currentTask.duration : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Registrar Avance Real
            </DialogTitle>
            <DialogDescription>
              {task.wbsCode} - {task.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Checklist - only for leaf tasks */}
            {isLeafTask && (
              <TaskChecklist
                checklist={currentTask.checklist || []}
                onAddItem={handleAddChecklistItem}
                onToggleItem={handleToggleChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                onUpdateItem={handleUpdateChecklistItem}
                onAllCompleted={handleAllChecklistCompleted}
                hasActualDuration={currentTask.actualDuration !== undefined && currentTask.actualDuration !== null}
              />
            )}

            {/* Planned Duration */}
            <div className="grid gap-2">
              <Label>Duración Planificada</Label>
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {currentTask.duration} días laborables
              </div>
            </div>

            {/* Actual Duration */}
            <div className="grid gap-2">
              <Label htmlFor="actualDuration">
                Duración Real <span className="text-destructive">*</span>
              </Label>
              <Input
                id="actualDuration"
                type="number"
                min="1"
                placeholder={`${task.duration}`}
                {...register('actualDuration', {
                  valueAsNumber: true,
                  required: 'La duración real es obligatoria',
                  min: { value: 1, message: 'Mínimo 1 día' },
                })}
              />
              {errors.actualDuration && (
                <p className="text-sm text-destructive">{errors.actualDuration.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Días laborables que realmente tomó completar la tarea
              </p>
            </div>

            {/* Current Variance */}
            {currentTask.actualDuration !== undefined && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-medium mb-1">Variación Actual:</p>
                <p className={variance === 0 ? 'text-muted-foreground' : variance > 0 ? 'text-destructive' : 'text-green-600'}>
                  {variance === 0 ? 'En plazo' : variance > 0 ? `+${variance} días (retraso)` : `${variance} días (adelanto)`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {currentTask.actualDuration !== undefined && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
              >
                Limpiar
              </Button>
            )}
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
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
